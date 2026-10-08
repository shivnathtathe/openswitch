import type { EventEmitter } from 'node:events'

export type OpenVpnStatus = 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'error'
export type OpenVpnErrorKind = 'auth' | 'config' | 'tls' | 'process' | 'timeout' | 'executable'

export interface OpenVpnProfile {
  id: string
  configPath: string
  /** Additional trusted OpenVPN arguments. The service appends its auth option last. */
  arguments?: readonly string[]
}

export interface OpenVpnCredentials {
  username: string
  password: string
}

export interface OpenVpnErrorState {
  kind: OpenVpnErrorKind
  message: string
}

export interface OpenVpnState {
  status: OpenVpnStatus
  profileId?: string
  error?: OpenVpnErrorState
  changedAt: string
}

export interface OpenVpnLogger {
  debug?(message: string): void
  info?(message: string): void
  warn?(message: string): void
  error?(message: string): void
}

export interface SpawnedProcess extends EventEmitter {
  readonly pid?: number
  readonly stdout: NodeJS.ReadableStream | null
  readonly stderr: NodeJS.ReadableStream | null
  kill(signal?: NodeJS.Signals | number): boolean
}

export interface ProcessFactory {
  spawn(executable: string, args: readonly string[]): SpawnedProcess
}

export interface OpenVpnExecutableLocator {
  locate(): Promise<string>
}

export interface CredentialHandle {
  readonly path: string
  cleanup(): Promise<void>
}

export interface CredentialStore {
  create(credentials: OpenVpnCredentials): Promise<CredentialHandle>
}

export interface ManagementChannel {
  readonly port: number
  readonly connected: Promise<void>
  send(command: string): void
  close(): Promise<void>
}

export interface ManagementChannelEvents {
  onLine(line: string): void
  onError(error: Error): void
  onClose(): void
}

export interface ManagementChannelFactory {
  listen(events: ManagementChannelEvents): Promise<ManagementChannel>
}

export interface OpenVpnServiceDependencies {
  locator: OpenVpnExecutableLocator
  processFactory: ProcessFactory
  managementChannelFactory?: ManagementChannelFactory
  /** @deprecated Credentials are no longer persisted. Retained for bootstrap compatibility only. */
  credentialStore?: CredentialStore
  logger?: OpenVpnLogger
  initializationTimeoutMs?: number
  stopTimeoutMs?: number
  hardKillTimeoutMs?: number
}
