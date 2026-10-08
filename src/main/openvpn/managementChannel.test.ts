import { createConnection } from 'node:net'

import { describe, expect, it, vi } from 'vitest'

import { TemporaryAuthFileStore } from './credentialStore'
import { NodeManagementChannelFactory } from './managementChannel'

describe('NodeManagementChannelFactory', () => {
  it('binds an ephemeral loopback port and exchanges line-framed commands', async () => {
    const receivedLines: string[] = []
    const channel = await new NodeManagementChannelFactory().listen({
      onLine: (line) => receivedLines.push(line),
      onError: (error) => {
        throw error
      },
      onClose: () => undefined,
    })

    expect(channel.port).toBeGreaterThan(0)
    const socket = createConnection({ host: '127.0.0.1', port: channel.port })
    socket.setEncoding('utf8')
    await channel.connected
    const response = new Promise<string>((resolve) => socket.once('data', resolve))

    socket.write('first\r\nsecond\n')
    channel.send('hold release')

    await expect(response).resolves.toBe('hold release\n')
    await vi.waitFor(() => expect(receivedLines).toEqual(['first', 'second']))

    const socketClosed = new Promise<void>((resolve) => socket.once('close', resolve))
    await channel.close()
    await socketClosed
    expect(socket.destroyed).toBe(true)
  })

  it('rejects multi-line commands', async () => {
    const channel = await new NodeManagementChannelFactory().listen({
      onLine: () => undefined,
      onError: () => undefined,
      onClose: () => undefined,
    })
    const socket = createConnection({ host: '127.0.0.1', port: channel.port })
    await channel.connected

    expect(() => channel.send('state on\nsignal SIGTERM')).toThrow('exactly one line')

    await channel.close()
    socket.destroy()
  })
})

describe('TemporaryAuthFileStore', () => {
  it('cannot persist credentials through the legacy API', async () => {
    await expect(
      new TemporaryAuthFileStore().create({ username: 'alice', password: 'secret' }),
    ).rejects.toThrow('credential files are disabled')
  })
})
