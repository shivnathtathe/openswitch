const SENSITIVE_VALUE =
  /\b(password|passwd|username|user|token|secret|auth-user-pass)\b(\s*[=:]\s*|\s+)("[^"]*"|'[^']*'|[^\s,;]+)/gi
const MANAGEMENT_PASSWORD = /^>PASSWORD:.*$/gim
const INLINE_CREDENTIALS = /([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+(?::[^\s/@]*)?@/gi
const PEM_PRIVATE_KEY =
  /-----BEGIN (?:ENCRYPTED )?PRIVATE KEY-----[\s\S]*?-----END (?:ENCRYPTED )?PRIVATE KEY-----/g

export interface LogRedactor {
  redact(value: string): string
}

/** Redacts known values as well as common credential-bearing log formats. */
export class SensitiveDataRedactor implements LogRedactor {
  private readonly secrets: string[]

  constructor(secrets: readonly (string | undefined)[] = []) {
    this.secrets = [...new Set(secrets.filter((value): value is string => Boolean(value)))].sort(
      (left, right) => right.length - left.length,
    )
  }

  redact(value: string): string {
    let result = value

    for (const secret of this.secrets) {
      result = result.replace(new RegExp(escapeRegExp(secret), 'g'), '[REDACTED]')
    }

    return result
      .replace(PEM_PRIVATE_KEY, '[REDACTED PRIVATE KEY]')
      .replace(MANAGEMENT_PASSWORD, '>PASSWORD:[REDACTED]')
      .replace(INLINE_CREDENTIALS, '$1[REDACTED]@')
      .replace(SENSITIVE_VALUE, '$1$2[REDACTED]')
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
