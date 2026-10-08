#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import path from 'node:path'

const candidates = []

if (process.env.OPENVPN_PATH) {
  candidates.push({ source: 'OPENVPN_PATH', command: process.env.OPENVPN_PATH })
}

candidates.push({ source: 'PATH', command: 'openvpn' })

if (process.platform === 'win32') {
  for (const root of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']]) {
    if (root) {
      candidates.push({
        source: 'standard installation',
        command: path.join(root, 'OpenVPN', 'bin', 'openvpn.exe'),
      })
    }
  }
}

const seen = new Set()
const failures = []

for (const candidate of candidates) {
  const key = process.platform === 'win32' ? candidate.command.toLowerCase() : candidate.command

  if (seen.has(key)) {
    continue
  }
  seen.add(key)

  const result = spawnSync(candidate.command, ['--version'], {
    encoding: 'utf8',
    shell: false,
    timeout: 5000,
    windowsHide: true,
  })

  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()
  const versionLine = output.split(/\r?\n/).find((line) => /openvpn/i.test(line))

  if (!result.error && result.status === 0 && versionLine) {
    console.log(`OpenVPN available: ${versionLine.trim()}`)
    console.log(`Executable: ${candidate.command} (${candidate.source})`)
    process.exit(0)
  }

  const reason = result.error?.code
    ? String(result.error.code)
    : `exit ${result.status ?? 'unknown'}`
  failures.push(`${candidate.command}: ${reason}`)
}

console.error('OpenVPN was not found or could not be executed.')
console.error('Install OpenVPN, add it to PATH, or set OPENVPN_PATH to its executable.')

if (process.env.OPENVPN_VERIFY_DEBUG === '1') {
  console.error(`Attempts:\n- ${failures.join('\n- ')}`)
}

process.exit(1)
