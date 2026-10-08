import { describe, expect, it } from 'vitest'

import { SensitiveDataRedactor } from '../../../src/main/logging/redactor'

describe('SensitiveDataRedactor', () => {
  it.each([
    ['password assignment', 'password=hunter2', 'hunter2'],
    [
      'quoted password assignment',
      'password: "correct horse battery staple"',
      'correct horse battery staple',
    ],
    [
      'token assignment',
      'token=eyJhbGciOiJIUzI1NiJ9.payload.signature',
      'eyJhbGciOiJIUzI1NiJ9.payload.signature',
    ],
    ['space-delimited secret', 'secret client-secret-123', 'client-secret-123'],
    ['auth-user-pass value', 'auth-user-pass credentials.txt', 'credentials.txt'],
    ['URL credentials', 'https://alice:url-secret@example.test/vpn', 'alice:url-secret'],
  ])('removes %s while retaining useful context', (_case, input, secret) => {
    const result = new SensitiveDataRedactor().redact(input)

    expect(result).not.toContain(secret)
    expect(result).toContain('[REDACTED]')
  })

  it('redacts OpenVPN management password prompts as a whole line', () => {
    const result = new SensitiveDataRedactor().redact(
      ['Waiting for credentials', ">PASSWORD:Need 'Auth' username/password", 'Prompt handled'].join(
        '\n',
      ),
    )

    expect(result).not.toContain("Need 'Auth'")
    expect(result).toContain('Waiting for credentials')
    expect(result).toContain('Prompt handled')
  })

  it('redacts an entire inline private key while preserving surrounding logs', () => {
    const result = new SensitiveDataRedactor().redact(
      [
        'Loading client identity',
        '-----BEGIN PRIVATE KEY-----',
        'c3VwZXItc2VjcmV0LWtleS1tYXRlcmlhbA==',
        '-----END PRIVATE KEY-----',
        'Identity load complete',
      ].join('\n'),
    )

    expect(result).not.toContain('c3VwZXItc2VjcmV0LWtleS1tYXRlcmlhbA==')
    expect(result).toContain('[REDACTED PRIVATE KEY]')
    expect(result).toContain('Loading client identity')
    expect(result).toContain('Identity load complete')
  })

  it('redacts configured runtime secrets, including regular-expression characters', () => {
    const result = new SensitiveDataRedactor(['p@ss.*[word]', undefined, '']).redact(
      'OpenVPN command used p@ss.*[word] twice: p@ss.*[word]',
    )

    expect(result).toBe('OpenVPN command used [REDACTED] twice: [REDACTED]')
  })

  it('redacts longer configured secrets before substrings', () => {
    const result = new SensitiveDataRedactor(['secret', 'secret-suffix']).redact(
      'value=secret-suffix',
    )

    expect(result).toBe('value=[REDACTED]')
  })

  it('does not alter ordinary diagnostic output', () => {
    const input = '2026-10-08 12:34:56 UDP link remote: [AF_INET]198.51.100.7:1194'

    expect(new SensitiveDataRedactor().redact(input)).toBe(input)
  })
})
