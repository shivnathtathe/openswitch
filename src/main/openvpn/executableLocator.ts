import { constants } from 'node:fs'
import { access } from 'node:fs/promises'
import { delimiter, join } from 'node:path'
import type { OpenVpnExecutableLocator } from './types'

export interface ExecutableLocatorOptions {
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
}

export class DefaultOpenVpnExecutableLocator implements OpenVpnExecutableLocator {
  private readonly env: NodeJS.ProcessEnv
  private readonly platform: NodeJS.Platform

  constructor(options: ExecutableLocatorOptions = {}) {
    this.env = options.env ?? process.env
    this.platform = options.platform ?? process.platform
  }

  async locate(): Promise<string> {
    const configured = this.env.OPENVPN_PATH?.trim()
    if (configured) {
      if (await isExecutable(configured)) {
        return configured
      }
      throw new Error(`OPENVPN_PATH does not point to an executable file: ${configured}`)
    }

    for (const candidate of this.commonCandidates()) {
      if (await isExecutable(candidate)) {
        return candidate
      }
    }

    const fromPath = await this.findOnPath()
    if (fromPath) {
      return fromPath
    }

    throw new Error('OpenVPN executable not found. Install OpenVPN or set OPENVPN_PATH.')
  }

  private commonCandidates(): string[] {
    if (this.platform === 'win32') {
      return unique([
        this.env.ProgramFiles && join(this.env.ProgramFiles, 'OpenVPN', 'bin', 'openvpn.exe'),
        this.env['ProgramFiles(x86)'] &&
          join(this.env['ProgramFiles(x86)']!, 'OpenVPN', 'bin', 'openvpn.exe'),
        'C:\\Program Files\\OpenVPN\\bin\\openvpn.exe',
        'C:\\Program Files (x86)\\OpenVPN\\bin\\openvpn.exe',
      ])
    }
    if (this.platform === 'darwin') {
      return [
        '/opt/homebrew/sbin/openvpn',
        '/usr/local/sbin/openvpn',
        '/opt/local/sbin/openvpn',
        '/usr/sbin/openvpn',
      ]
    }
    return ['/usr/sbin/openvpn', '/usr/local/sbin/openvpn', '/usr/bin/openvpn', '/snap/bin/openvpn']
  }

  private async findOnPath(): Promise<string | undefined> {
    const directories = (this.env.PATH ?? this.env.Path ?? '').split(delimiter).filter(Boolean)
    const names =
      this.platform === 'win32' ? executableNames('openvpn', this.env.PATHEXT) : ['openvpn']

    for (const directory of directories) {
      for (const name of names) {
        const candidate = join(directory.replace(/^"|"$/g, ''), name)
        if (await isExecutable(candidate)) {
          return candidate
        }
      }
    }
    return undefined
  }
}

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function executableNames(command: string, pathExt: string | undefined): string[] {
  const extensions = (pathExt || '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)
  return extensions.map((extension) => `${command}${extension.toLowerCase()}`)
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}
