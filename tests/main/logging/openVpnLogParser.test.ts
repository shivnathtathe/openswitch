import { describe, expect, it } from 'vitest'

import { parseOpenVpnLogLine } from '../../../src/main/logging/openVpnLogParser'

describe('parseOpenVpnLogLine', () => {
  it('recognizes successful initialization despite timestamp and casing', () => {
    expect(
      parseOpenVpnLogLine('2026-10-08 12:34:56 us=123456 initialization sequence completed'),
    ).toEqual({ type: 'initialized' })
  })

  it.each([
    ['AUTH_FAILED', 'auth-error'],
    ['username/password verification failed', 'auth-error'],
    ['Options error: Unrecognized option or missing parameter(s)', 'config-error'],
    ['Error opening configuration file: office.ovpn', 'config-error'],
    ['TLS Error: TLS key negotiation failed', 'tls-error'],
    ['VERIFY ERROR: depth=0, certificate has expired', 'tls-error'],
    ['Exiting due to fatal error', 'process-error'],
    ['Cannot resolve host address: vpn.example.test', 'process-error'],
  ] as const)('classifies %s as %s', (line, type) => {
    expect(parseOpenVpnLogLine(line)).toEqual({ type, message: line })
  })

  it('gives a specific error precedence over generic fatal text', () => {
    const line = 'TLS Error: fatal error while loading certificate'

    expect(parseOpenVpnLogLine(line)).toEqual({ type: 'tls-error', message: line })
  })

  it('trims output before returning a diagnostic log event', () => {
    expect(parseOpenVpnLogLine('  Management Interface listening  \r\n')).toEqual({
      type: 'log',
      message: 'Management Interface listening',
    })
  })

  it('handles an empty line without throwing', () => {
    expect(parseOpenVpnLogLine('')).toEqual({ type: 'log', message: '' })
  })
})
