import { createServer, type Server, type Socket } from 'node:net'

import type { ManagementChannel, ManagementChannelEvents, ManagementChannelFactory } from './types'

const LOOPBACK_ADDRESS = '127.0.0.1'

export class NodeManagementChannelFactory implements ManagementChannelFactory {
  listen(events: ManagementChannelEvents): Promise<ManagementChannel> {
    return new Promise((resolve, reject) => {
      let settled = false
      const server = createServer()
      const failToListen = (error: Error): void => {
        if (!settled) reject(error)
        else events.onError(error)
      }

      server.once('error', failToListen)
      server.listen(0, LOOPBACK_ADDRESS, () => {
        settled = true
        server.off('error', failToListen)
        server.on('error', events.onError)
        const address = server.address()
        if (!address || typeof address === 'string') {
          server.close()
          reject(new Error('Unable to allocate an OpenVPN management port'))
          return
        }
        resolve(new NodeManagementChannel(server, address.port, events))
      })
    })
  }
}

class NodeManagementChannel implements ManagementChannel {
  readonly connected: Promise<void>
  private socket?: Socket
  private pending = ''
  private closed = false
  private resolveConnected!: () => void
  private rejectConnected!: (error: Error) => void

  constructor(
    private readonly server: Server,
    readonly port: number,
    private readonly events: ManagementChannelEvents,
  ) {
    this.connected = new Promise<void>((resolve, reject) => {
      this.resolveConnected = resolve
      this.rejectConnected = reject
    })
    void this.connected.catch(() => undefined)
    server.on('connection', (socket) => this.accept(socket))
  }

  send(command: string): void {
    if (/\r|\n|\0/.test(command)) {
      throw new Error('OpenVPN management commands must contain exactly one line')
    }
    if (!this.socket || this.socket.destroyed) {
      throw new Error('OpenVPN management channel is not connected')
    }
    this.socket.write(`${command}\n`, 'utf8')
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    if (!this.socket) this.rejectConnected(new Error('OpenVPN management channel was closed'))
    this.socket?.destroy()
    await closeServer(this.server)
  }

  private accept(socket: Socket): void {
    if (this.socket || this.closed) {
      socket.destroy()
      return
    }

    this.socket = socket
    socket.setEncoding('utf8')
    socket.on('data', (chunk: string) => this.receive(chunk))
    socket.on('error', this.events.onError)
    socket.on('close', () => {
      if (this.pending) this.events.onLine(this.pending)
      this.pending = ''
      this.events.onClose()
    })
    this.resolveConnected()
    this.server.close()
  }

  private receive(chunk: string): void {
    this.pending += chunk
    const lines = this.pending.split(/\r?\n/)
    this.pending = lines.pop() ?? ''
    for (const line of lines) this.events.onLine(line)
  }
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve()
      return
    }
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

export function quoteManagementValue(value: string, name: string): string {
  if (!value || /[\r\n\0]/.test(value)) {
    throw new Error(`OpenVPN ${name} must be non-empty and cannot contain line breaks or NUL bytes`)
  }
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
