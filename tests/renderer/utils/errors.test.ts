import { describe, expect, it } from 'vitest'

import { formatError } from '../../../src/renderer/utils/errors'

describe('formatError', () => {
  it.each([
    ['CONFIG_FILE_INVALID', 'The selected configuration file is not valid.'],
    ['CONFIG_FILE_NOT_FOUND', 'The selected configuration file could not be found.'],
    ['CONNECTION_BUSY', 'Another connection action is already in progress.'],
    ['CREDENTIALS_REQUIRED', 'This profile requires a username and password.'],
    ['INTERNAL_ERROR', 'OpenSwitch encountered an unexpected error. Please try again.'],
    ['PERMISSION_DENIED', 'OpenSwitch does not have permission to complete this action.'],
    ['PROFILE_NOT_FOUND', 'This profile no longer exists.'],
    ['VALIDATION_ERROR', 'Check the profile details and try again.'],
  ])('uses friendly copy for %s instead of technical detail', (code, friendlyMessage) => {
    expect(formatError({ code, message: 'low-level implementation detail' })).toBe(friendlyMessage)
  })

  it('retains actionable VPN process detail', () => {
    expect(
      formatError({
        code: 'VPN_PROCESS_FAILED',
        message: 'TLS handshake failed: certificate has expired',
      }),
    ).toBe('TLS handshake failed: certificate has expired')
  })

  it('falls back safely for empty and unstructured values', () => {
    expect(formatError('  ', 'Safe fallback')).toBe('Safe fallback')
    expect(formatError({}, 'Safe fallback')).toBe('Safe fallback')
    expect(formatError(null, 'Safe fallback')).toBe('Safe fallback')
  })

  it('preserves a useful message for an unknown error code', () => {
    expect(formatError({ code: 'FUTURE_ERROR', message: 'Useful context' })).toBe('Useful context')
  })
})
