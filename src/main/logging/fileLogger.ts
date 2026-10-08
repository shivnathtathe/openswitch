import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'

import type { OpenVpnLogger } from '../openvpn/types'

const MAX_LOG_SIZE = 1024 * 1024

export class FileLogger implements OpenVpnLogger {
  constructor(
    private readonly getLogDirectory: () => string,
    private readonly isEnabled: () => boolean = () => true,
  ) {}

  debug(message: string): void {
    this.write('DEBUG', message)
  }

  info(message: string): void {
    this.write('INFO', message)
  }

  warn(message: string): void {
    this.write('WARN', message)
  }

  error(message: string): void {
    this.write('ERROR', message)
  }

  private write(level: string, message: string): void {
    try {
      if (!this.isEnabled()) return
      const directory = this.getLogDirectory()
      mkdirSync(directory, { recursive: true })
      const logPath = join(directory, 'openvpn.log')
      if (existsSync(logPath) && statSync(logPath).size >= MAX_LOG_SIZE) {
        renameSync(logPath, join(directory, 'openvpn.previous.log'))
      }
      appendFileSync(logPath, `${new Date().toISOString()} [${level}] ${message}\n`, 'utf8')
    } catch {
      // Diagnostics must never interrupt a connection attempt.
    }
  }
}
