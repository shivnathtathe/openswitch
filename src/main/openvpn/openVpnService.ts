import { EventEmitter } from 'node:events'
import { parseOpenVpnLogLine, SensitiveDataRedactor } from '../logging'
import type { LogRedactor, OpenVpnLogEvent } from '../logging'
import { NodeManagementChannelFactory, quoteManagementValue } from './managementChannel'
import type {
  ManagementChannel,
  ManagementChannelFactory,
  OpenVpnCredentials,
  OpenVpnErrorKind,
  OpenVpnErrorState,
  OpenVpnProfile,
  OpenVpnServiceDependencies,
  OpenVpnState,
  SpawnedProcess,
} from './types'

interface Session {
  token: number
  profileId: string
  process: SpawnedProcess
  management: ManagementChannel
  credentials?: OpenVpnCredentials
  redactor: LogRedactor
  initialized: boolean
  expectedStop: boolean
  failure?: OpenVpnErrorState
  initialization: Promise<void>
  resolveInitialization: () => void
  rejectInitialization: (error: Error) => void
  exit: Promise<void>
  resolveExit: () => void
  exitSettled: boolean
  recentLines: string[]
}

const DEFAULT_INITIALIZATION_TIMEOUT_MS = 30_000
const DEFAULT_STOP_TIMEOUT_MS = 8_000
const DEFAULT_HARD_KILL_TIMEOUT_MS = 2_000

export class OpenVpnService extends EventEmitter<{
  state: [state: Readonly<OpenVpnState>]
  log: [line: string]
}> {
  private state: OpenVpnState = { status: 'disconnected', changedAt: new Date().toISOString() }
  private active?: Session
  private operationTail: Promise<void> = Promise.resolve()
  private nextToken = 0
  private readonly managementChannelFactory: ManagementChannelFactory

  constructor(private readonly dependencies: OpenVpnServiceDependencies) {
    super()
    this.managementChannelFactory =
      dependencies.managementChannelFactory ?? new NodeManagementChannelFactory()
  }

  getState(): Readonly<OpenVpnState> {
    return { ...this.state, error: this.state.error && { ...this.state.error } }
  }

  connect(profile: OpenVpnProfile, credentials?: OpenVpnCredentials): Promise<void> {
    return this.enqueue(async () => {
      validateProfile(profile)
      await this.disconnectActive()
      await this.start(profile, credentials)
    })
  }

  disconnect(): Promise<void> {
    return this.enqueue(() => this.disconnectActive())
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationTail.then(operation, operation)
    this.operationTail = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  private async start(profile: OpenVpnProfile, credentials?: OpenVpnCredentials): Promise<void> {
    this.setState({ status: 'connecting', profileId: profile.id })

    let management: ManagementChannel | undefined
    let session: Session | undefined
    try {
      if (credentials) {
        quoteManagementValue(credentials.username, 'username')
        quoteManagementValue(credentials.password, 'password')
      }
      const executable = await this.dependencies.locator.locate()
      management = await this.managementChannelFactory.listen({
        onLine: (line) => {
          if (session) this.handleManagementLine(session, line)
        },
        onError: (error) => {
          if (session) this.handleManagementFailure(session, error)
        },
        onClose: () => {
          if (session && !session.expectedStop && !session.exitSettled) {
            this.handleManagementFailure(session, new Error('OpenVPN management channel closed'))
          }
        },
      })
      const args = [
        '--config',
        profile.configPath,
        ...(profile.arguments ?? []),
        '--script-security',
        '1',
      ]
      if (credentials) args.push('--auth-user-pass')
      args.push(
        '--management',
        '127.0.0.1',
        String(management.port),
        '--management-client',
        '--management-query-passwords',
        '--management-hold',
      )

      const process = this.dependencies.processFactory.spawn(executable, args)
      session = createSession(++this.nextToken, profile.id, process, management, credentials)
      this.active = session
      this.observe(session)
      this.dependencies.logger?.info?.(`Starting OpenVPN for profile ${profile.id}`)

      await withTimeout(
        this.initialize(session),
        this.dependencies.initializationTimeoutMs ?? DEFAULT_INITIALIZATION_TIMEOUT_MS,
        'OpenVPN initialization timed out',
      )
    } catch (cause) {
      const activeSession = this.active
      let stopError: unknown
      if (activeSession?.profileId === profile.id) {
        try {
          await this.stopSession(activeSession)
        } catch (error) {
          stopError = error
        }
      } else if (management) {
        try {
          await management.close()
        } catch (error) {
          stopError = error
        }
      }

      const message = errorMessage(stopError ?? cause)
      const error =
        activeSession?.failure ??
        ({
          kind:
            message.includes('not found') || message.includes('OPENVPN_PATH')
              ? 'executable'
              : message.includes('timed out')
                ? 'timeout'
                : 'process',
          message,
        } as OpenVpnErrorState)
      this.setState({ status: 'error', profileId: profile.id, error })
      throw new Error(error.message, { cause: stopError ?? cause })
    }
  }

  private async initialize(session: Session): Promise<void> {
    await session.management.connected
    if (this.active?.token !== session.token) throw new Error('OpenVPN connection was stopped')
    session.management.send('state on')
    session.management.send('hold release')
    await session.initialization
  }

  private observe(session: Session): void {
    pipeLines(session.process.stdout, (line) => this.handleLine(session, line))
    pipeLines(session.process.stderr, (line) => this.handleLine(session, line))

    session.process.once('error', (error: Error) => {
      this.recordFailure(session, 'process', `OpenVPN process error: ${error.message}`)
      session.rejectInitialization(error)
      this.settleExit(session)
      void this.handleUnexpectedEnd(session)
    })
    session.process.once('close', (code: number | null, signal: NodeJS.Signals | null) => {
      this.settleExit(session)
      if (!session.expectedStop) {
        const detail = signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`
        this.recordFailure(session, 'process', `OpenVPN exited with ${detail}`)
        session.rejectInitialization(new Error(session.failure!.message))
        void this.handleUnexpectedEnd(session)
      }
    })
  }

  private handleLine(session: Session, rawLine: string): void {
    if (this.active?.token !== session.token) return

    const event = parseOpenVpnLogLine(rawLine)
    const line = session.redactor.redact(rawLine)
    if (!line) return
    const context = [...session.recentLines]
    session.recentLines.push(line)
    if (session.recentLines.length > 20) session.recentLines.shift()
    this.emit('log', line)
    this.dependencies.logger?.debug?.(line)

    if (event.type === 'initialized') {
      if (!session.initialized) {
        session.initialized = true
        session.resolveInitialization()
        this.setState({ status: 'connected', profileId: session.profileId })
      }
      return
    }

    const failure = parserFailure(event)
    if (failure?.kind === 'process' && /(?:exiting due to )?fatal error/i.test(failure.message)) {
      if (
        context.some((line) => /\bNETSH:/i.test(line)) &&
        context.some((line) => /command failed|error code 1/i.test(line))
      ) {
        failure.message =
          'Windows could not configure the VPN adapter. Restart OpenSwitch as administrator.'
      } else {
        const detail = findDiagnosticContext(context)
        if (detail) failure.message = detail
      }
    }
    if (failure) {
      this.recordFailure(session, failure.kind, failure.message)
      if (!session.initialized) {
        session.rejectInitialization(new Error(failure.message))
      } else {
        void this.enqueue(() => this.failConnectedSession(session))
      }
    }
  }

  private handleManagementLine(session: Session, line: string): void {
    if (this.active?.token !== session.token) return

    const prompt = /^>PASSWORD:Need '([^']+)' username\/password\s*$/i.exec(line)
    if (prompt) {
      if (!session.credentials) {
        this.handleManagementFailure(
          session,
          new Error(`OpenVPN requested ${prompt[1]} credentials but none were provided`),
          'auth',
        )
        return
      }
      try {
        const type = quoteManagementValue(prompt[1], 'credential type')
        session.management.send(
          `username ${type} ${quoteManagementValue(session.credentials.username, 'username')}`,
        )
        session.management.send(
          `password ${type} ${quoteManagementValue(session.credentials.password, 'password')}`,
        )
      } catch (error) {
        this.handleManagementFailure(session, error, 'auth')
      }
      return
    }

    if (/^>PASSWORD:Verification Failed:/i.test(line)) {
      this.handleManagementFailure(session, new Error('OpenVPN authentication failed'), 'auth')
      return
    }

    if (/^>STATE:[^,]*,CONNECTED,/i.test(line) && !session.initialized) {
      session.initialized = true
      session.resolveInitialization()
      this.setState({ status: 'connected', profileId: session.profileId })
    }
  }

  private handleManagementFailure(
    session: Session,
    cause: unknown,
    kind: OpenVpnErrorKind = 'process',
  ): void {
    if (this.active?.token !== session.token || session.expectedStop) return
    const message = session.redactor.redact(errorMessage(cause))
    this.recordFailure(session, kind, message)
    if (!session.initialized) {
      session.rejectInitialization(new Error(message))
    } else {
      void this.enqueue(() => this.failConnectedSession(session))
    }
  }

  private async failConnectedSession(session: Session): Promise<void> {
    if (this.active?.token !== session.token) return
    const failure = session.failure ?? { kind: 'process', message: 'OpenVPN connection failed' }
    try {
      await this.stopSession(session)
    } catch (error) {
      failure.message = `${failure.message}; ${errorMessage(error)}`
    }
    this.setState({ status: 'error', profileId: session.profileId, error: failure })
  }

  private async handleUnexpectedEnd(session: Session): Promise<void> {
    if (this.active?.token !== session.token || session.expectedStop) return
    session.credentials = undefined
    await session.management.close().catch((error) => {
      this.dependencies.logger?.warn?.(
        `Failed to close OpenVPN management channel: ${errorMessage(error)}`,
      )
    })
    if (this.active?.token !== session.token) return
    this.active = undefined
    const failure = session.failure ?? { kind: 'process', message: 'OpenVPN stopped unexpectedly' }
    this.setState({ status: 'error', profileId: session.profileId, error: failure })
  }

  private async disconnectActive(): Promise<void> {
    const session = this.active
    if (!session) {
      this.setState({ status: 'disconnected' })
      return
    }

    this.setState({ status: 'disconnecting', profileId: session.profileId })
    try {
      await this.stopSession(session)
      this.setState({ status: 'disconnected' })
    } catch (cause) {
      const error = { kind: 'process' as const, message: errorMessage(cause) }
      this.setState({ status: 'error', profileId: session.profileId, error })
      throw cause
    }
  }

  private async stopSession(session: Session): Promise<void> {
    if (this.active?.token !== session.token) return
    session.expectedStop = true
    session.rejectInitialization(new Error('OpenVPN connection was stopped'))

    try {
      try {
        session.management.send('signal SIGTERM')
      } catch {
        session.process.kill('SIGTERM')
      }
      const exitedGracefully = await settlesWithin(
        session.exit,
        this.dependencies.stopTimeoutMs ?? DEFAULT_STOP_TIMEOUT_MS,
      )
      if (!exitedGracefully) {
        this.dependencies.logger?.warn?.(
          `OpenVPN did not stop gracefully; killing PID ${session.process.pid ?? 'unknown'}`,
        )
        session.process.kill('SIGKILL')
        const killed = await settlesWithin(
          session.exit,
          this.dependencies.hardKillTimeoutMs ?? DEFAULT_HARD_KILL_TIMEOUT_MS,
        )
        if (!killed) throw new Error('OpenVPN process did not exit after forced termination')
      }
    } finally {
      session.credentials = undefined
      await session.management.close().catch((error) => {
        this.dependencies.logger?.warn?.(
          `Failed to close OpenVPN management channel: ${errorMessage(error)}`,
        )
      })
    }

    if (this.active?.token === session.token) this.active = undefined
  }

  private recordFailure(session: Session, kind: OpenVpnErrorKind, message: string): void {
    if (!session.failure) session.failure = { kind, message: session.redactor.redact(message) }
  }

  private settleExit(session: Session): void {
    if (!session.exitSettled) {
      session.exitSettled = true
      session.resolveExit()
    }
  }

  private setState(next: Omit<OpenVpnState, 'changedAt'>): void {
    this.state = { ...next, changedAt: new Date().toISOString() }
    this.emit('state', this.getState())
  }
}

function createSession(
  token: number,
  profileId: string,
  process: SpawnedProcess,
  management: ManagementChannel,
  credentials: OpenVpnCredentials | undefined,
): Session {
  let resolveInitialization!: () => void
  let rejectInitialization!: (error: Error) => void
  const initialization = new Promise<void>((resolve, reject) => {
    resolveInitialization = resolve
    rejectInitialization = reject
  })
  // A late rejection after successful initialization is otherwise unhandled.
  void initialization.catch(() => undefined)

  let resolveExit!: () => void
  const exit = new Promise<void>((resolve) => {
    resolveExit = resolve
  })
  return {
    token,
    profileId,
    process,
    management,
    credentials,
    redactor: new SensitiveDataRedactor(
      credentials ? [credentials.username, credentials.password] : [],
    ),
    initialized: false,
    expectedStop: false,
    initialization,
    resolveInitialization,
    rejectInitialization,
    exit,
    resolveExit,
    exitSettled: false,
    recentLines: [],
  }
}

function findDiagnosticContext(lines: readonly string[]): string | undefined {
  return [...lines]
    .reverse()
    .find(
      (line) =>
        /\b(?:error|failed|cannot|unable|denied|unsupported|missing|required|requires)\b/i.test(
          line,
        ) && !/(?:exiting due to )?fatal error/i.test(line),
    )
}

function pipeLines(stream: NodeJS.ReadableStream | null, onLine: (line: string) => void): void {
  if (!stream) return
  let pending = ''
  stream.setEncoding('utf8')
  stream.on('data', (chunk: string) => {
    pending += chunk
    const lines = pending.split(/\r?\n/)
    pending = lines.pop() ?? ''
    for (const line of lines) onLine(line)
  })
  stream.on('end', () => {
    if (pending) onLine(pending)
    pending = ''
  })
}

function parserFailure(event: OpenVpnLogEvent): OpenVpnErrorState | undefined {
  switch (event.type) {
    case 'auth-error':
      return { kind: 'auth', message: event.message }
    case 'config-error':
      return { kind: 'config', message: event.message }
    case 'tls-error':
      return { kind: 'tls', message: event.message }
    case 'process-error':
      return { kind: 'process', message: event.message }
    default:
      return undefined
  }
}

function validateProfile(profile: OpenVpnProfile): void {
  if (!profile.id.trim()) throw new Error('OpenVPN profile id is required')
  if (!profile.configPath.trim()) throw new Error('OpenVPN profile config path is required')
  if (profile.arguments?.some((argument) => argument.includes('\0'))) {
    throw new Error('OpenVPN arguments cannot contain NUL bytes')
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function settlesWithin(promise: Promise<void>, timeoutMs: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      promise.then(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
