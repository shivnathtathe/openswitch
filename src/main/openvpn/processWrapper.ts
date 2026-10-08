import { spawn } from 'node:child_process'
import type { ProcessFactory, SpawnedProcess } from './types'

export class NodeProcessFactory implements ProcessFactory {
  spawn(executable: string, args: readonly string[]): SpawnedProcess {
    return spawn(executable, [...args], {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }) as SpawnedProcess
  }
}
