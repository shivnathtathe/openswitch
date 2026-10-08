const FRIENDLY_ERRORS: Readonly<Record<string, string>> = {
  CONFIG_FILE_INVALID: 'The selected configuration file is not valid.',
  CONFIG_FILE_NOT_FOUND: 'The selected configuration file could not be found.',
  CONNECTION_BUSY: 'Another connection action is already in progress.',
  CREDENTIALS_REQUIRED: 'This profile requires a username and password.',
  INTERNAL_ERROR: 'OpenSwitch encountered an unexpected error. Please try again.',
  PERMISSION_DENIED: 'OpenSwitch does not have permission to complete this action.',
  PROFILE_NOT_FOUND: 'This profile no longer exists.',
  VALIDATION_ERROR: 'Check the profile details and try again.',
  VPN_PROCESS_FAILED: 'The VPN process stopped unexpectedly. Please try again.',
}

interface ErrorLike {
  code?: unknown
  message?: unknown
}

export function formatError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (typeof error === 'string') {
    return error.trim() || fallback
  }

  if (error && typeof error === 'object') {
    const { code, message } = error as ErrorLike
    if (code === 'VPN_PROCESS_FAILED' && typeof message === 'string' && message.trim()) {
      return message
    }
    if (typeof code === 'string' && FRIENDLY_ERRORS[code]) {
      return FRIENDLY_ERRORS[code]
    }
    if (typeof message === 'string' && message.trim()) {
      return message
    }
  }

  return fallback
}
