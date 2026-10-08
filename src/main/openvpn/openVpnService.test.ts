import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'

import { describe, expect, it } from 'vitest'

import { quoteManagementValue } from './managementChannel'
import { OpenVpnService } from './openVpnService'
import type {
  ManagementChannel,
  ManagementChannelEvents,
  ProcessFactory,
  SpawnedProcess,
} from './types'

class FakeProcess extends EventEmitter implements SpawnedProcess {
  readonly pid = 123
  readonly stdout = new PassThrough()
  readonly stderr = new PassThrough()
  readonly signals: Array<NodeJS.Signals | number | undefined> = []

  constructor(private readonly closeOnSignal: NodeJS.Signals = 'SIGTERM') {
    super()
  }

  kill(signal?: NodeJS.Signals | number): boolean {
    this.signals.push(signal)
    if (signal === this.closeOnSignal) queueMicrotask(() => this.emit('close', 0, signal))
    return true
  }
}

class FakeManagementChannel implements ManagementChannel {
  readonly port = 49152
  readonly connected = Promise.resolve()
  readonly commands: string[] = []
  closed = false
  events?: ManagementChannelEvents

  constructor(
    private readonly process: FakeProcess,
    private readonly exitsOnManagementSignal = true,
  ) {}

  send(command: string): void {
    this.commands.push(command)
    if (command === 'signal SIGTERM' && this.exitsOnManagementSignal) {
      queueMicrotask(() => this.process.emit('close', 0, 'SIGTERM'))
    }
  }

  async close(): Promise<void> {
    this.closed = true
  }

  receive(line: string): void {
    this.events?.onLine(line)
  }
}

function createHarness(
  processes: FakeProcess[],
  eventLog: string[] = [],
  channels = processes.map((process) => new FakeManagementChannel(process)),
) {
  const processFactory: ProcessFactory = {
    spawn: (_executable, args) => {
      eventLog.push(`spawn:${args[1]}`)
      const process = processes.shift()
      if (!process) throw new Error('No fake process available')
      return process
    },
  }
  let channelIndex = 0
  const service = new OpenVpnService({
    locator: { locate: async () => '/usr/sbin/openvpn' },
    processFactory,
    managementChannelFactory: {
      listen: async (events) => {
        const channel = channels[channelIndex++]
        if (!channel) throw new Error('No fake management channel available')
        channel.events = events
        return channel
      },
    },
    initializationTimeoutMs: 100,
    stopTimeoutMs: 2,
    hardKillTimeoutMs: 20,
  })

  return { service, channels }
}

describe('OpenVpnService', () => {
  it('waits for initialization and redacts credentials from broadcast logs', async () => {
    const process = new FakeProcess()
    const { service } = createHarness([process])
    const logs: string[] = []
    service.on('log', (line) => logs.push(line))

    const connected = service.connect(
      { id: 'office', configPath: '/profiles/office.ovpn' },
      { username: 'alice', password: 'very-secret' },
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    process.stdout.write('username=alice password=very-secret\n')
    process.stdout.write('Initialization Sequence Completed\n')
    await connected

    expect(service.getState()).toMatchObject({ status: 'connected', profileId: 'office' })
    expect(logs.join('\n')).not.toContain('alice')
    expect(logs.join('\n')).not.toContain('very-secret')
  })

  it('fully stops the current process before spawning an auto-switched profile', async () => {
    const events: string[] = []
    const first = new FakeProcess()
    const second = new FakeProcess()
    const originalKill = first.kill.bind(first)
    first.kill = (signal) => {
      events.push(`kill:${String(signal)}`)
      return originalKill(signal)
    }
    const { service } = createHarness([first, second], events)

    const firstConnect = service.connect({ id: 'first', configPath: 'first.ovpn' })
    first.stdout.write('Initialization Sequence Completed\n')
    await firstConnect

    const secondConnect = service.connect({ id: 'second', configPath: 'second.ovpn' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    second.stdout.write('Initialization Sequence Completed\n')
    await secondConnect

    expect(events).toEqual(['spawn:first.ovpn', 'spawn:second.ovpn'])
  })

  it('force-kills after the management stop timeout and closes the channel', async () => {
    const process = new FakeProcess('SIGKILL')
    const channel = new FakeManagementChannel(process, false)
    const { service } = createHarness([process], [], [channel])
    const connected = service.connect(
      { id: 'office', configPath: 'office.ovpn' },
      { username: 'alice', password: 'secret' },
    )
    process.stdout.write('Initialization Sequence Completed\n')
    await connected

    await service.disconnect()

    expect(channel.commands).toContain('signal SIGTERM')
    expect(process.signals).toEqual(['SIGKILL'])
    expect(channel.closed).toBe(true)
    expect(service.getState().status).toBe('disconnected')
  })

  it('classifies authentication failures and closes the management channel', async () => {
    const process = new FakeProcess()
    const { service, channels } = createHarness([process])
    const connected = service.connect(
      { id: 'office', configPath: 'office.ovpn' },
      { username: 'alice', password: 'wrong' },
    )
    process.stderr.write('AUTH: Received control message: AUTH_FAILED\n')

    await expect(connected).rejects.toThrow('AUTH_FAILED')
    expect(service.getState()).toMatchObject({ status: 'error', error: { kind: 'auth' } })
    expect(channels[0].closed).toBe(true)
  })

  it('reports the diagnostic preceding a generic fatal exit', async () => {
    const process = new FakeProcess()
    const { service } = createHarness([process])
    const connected = service.connect({ id: 'office', configPath: 'office.ovpn' })
    process.stderr.write('ERROR: Cannot open TUN adapter\n')
    process.stderr.write('Exiting due to fatal error\n')

    await expect(connected).rejects.toThrow('Cannot open TUN adapter')
    expect(service.getState()).toMatchObject({
      status: 'error',
      error: { message: 'ERROR: Cannot open TUN adapter' },
    })
  })

  it('explains Windows adapter permission failures', async () => {
    const process = new FakeProcess()
    const { service } = createHarness([process])
    const connected = service.connect({ id: 'office', configPath: 'office.ovpn' })
    process.stderr.write('NETSH: netsh.exe interface ip set address 16 dhcp\n')
    process.stderr.write('ERROR: command failed: returned error code 1\n')
    process.stderr.write('Exiting due to fatal error\n')

    await expect(connected).rejects.toThrow('Restart OpenSwitch as administrator')
  })

  it('supplies escaped credentials only after a management auth prompt', async () => {
    const process = new FakeProcess()
    const argsSeen: string[][] = []
    const channel = new FakeManagementChannel(process)
    const service = new OpenVpnService({
      locator: { locate: async () => '/usr/sbin/openvpn' },
      processFactory: {
        spawn: (_executable, args) => {
          argsSeen.push([...args])
          return process
        },
      },
      managementChannelFactory: {
        listen: async (events) => {
          channel.events = events
          return channel
        },
      },
      initializationTimeoutMs: 100,
    })

    const connected = service.connect(
      { id: 'office', configPath: 'office.ovpn' },
      { username: 'a"lice\\admin', password: 's"ecret\\value' },
    )
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(channel.commands).toEqual(['state on', 'hold release'])
    expect(argsSeen[0]).toEqual([
      '--config',
      'office.ovpn',
      '--script-security',
      '1',
      '--auth-user-pass',
      '--management',
      '127.0.0.1',
      '49152',
      '--management-client',
      '--management-query-passwords',
      '--management-hold',
    ])

    channel.receive(">PASSWORD:Need 'Auth' username/password")
    expect(channel.commands.slice(2)).toEqual([
      'username "Auth" "a\\"lice\\\\admin"',
      'password "Auth" "s\\"ecret\\\\value"',
    ])
    channel.receive('>STATE:1,CONNECTED,SUCCESS,10.0.0.2,server,1194,')
    await connected
  })

  it('rejects credentials that cannot be represented as one management command', async () => {
    const process = new FakeProcess()
    const { service } = createHarness([process])

    await expect(
      service.connect(
        { id: 'office', configPath: 'office.ovpn' },
        { username: 'alice\nadmin', password: 'secret' },
      ),
    ).rejects.toThrow('cannot contain line breaks')
    expect(process.listenerCount('close')).toBe(0)
  })
})

describe('quoteManagementValue', () => {
  it('quotes backslashes and double quotes for the OpenVPN command parser', () => {
    expect(quoteManagementValue('a"b\\c', 'value')).toBe('"a\\"b\\\\c"')
  })
})
