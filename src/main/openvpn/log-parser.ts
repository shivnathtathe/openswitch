export type OpenVpnLogLevel = 'info' | 'warning' | 'error'
export type OpenVpnLifecycleEvent = 'connected' | 'auth-failed' | 'reconnecting' | 'disconnected'

export interface ParsedOpenVpnLogLine {
  timestamp: string | null
  level: OpenVpnLogLevel
  message: string
  event: OpenVpnLifecycleEvent | null
}

const TIMESTAMP = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})(?: us=\d+)?\s+(.*)$/

/** Parses OpenVPN output without dropping unknown diagnostic lines. */
export function parseOpenVpnLogLine(line: string): ParsedOpenVpnLogLine | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  const timestampMatch = TIMESTAMP.exec(trimmed)
  const timestamp = timestampMatch?.[1] ?? null
  const message = timestampMatch?.[2] ?? trimmed

  if (/Initialization Sequence Completed/i.test(message)) {
    return { timestamp, level: 'info', message, event: 'connected' }
  }
  if (
    /AUTH_FAILED|authentication failed|username\/password verification failed|>PASSWORD:Verification Failed/i.test(
      message,
    )
  ) {
    return { timestamp, level: 'error', message, event: 'auth-failed' }
  }
  if (/SIGUSR1.*process restarting/i.test(message)) {
    return { timestamp, level: 'warning', message, event: 'reconnecting' }
  }
  if (/SIGTERM.*process exiting/i.test(message)) {
    return { timestamp, level: 'info', message, event: 'disconnected' }
  }

  const level: OpenVpnLogLevel =
    /options error|TLS Error|fatal error|VERIFY ERROR|certificate verify failed/i.test(message)
      ? 'error'
      : /\bWARNING\b|\bWARN\b/i.test(message)
        ? 'warning'
        : 'info'

  return { timestamp, level, message, event: null }
}
