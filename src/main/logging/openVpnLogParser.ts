export type OpenVpnLogEvent =
  | { type: 'initialized' }
  | { type: 'auth-error'; message: string }
  | { type: 'config-error'; message: string }
  | { type: 'tls-error'; message: string }
  | { type: 'process-error'; message: string }
  | { type: 'log'; message: string }

const AUTH_ERROR =
  /AUTH_FAILED|authentication failed|auth credentials|username\/password verification failed|private key password verification failed|>PASSWORD:Verification Failed/i
const CONFIG_ERROR =
  /options error|unrecognized option|error opening configuration file|cannot load config|cannot open.*(?:\.ovpn|\.conf)|you must define|use --help for more information/i
const TLS_ERROR =
  /TLS Error|certificate verify failed|cannot load certificate|cannot load private key|VERIFY ERROR|SSL_CTX_use_/i
const PROCESS_ERROR =
  /exiting due to fatal error|fatal error|process terminated|cannot resolve host address|connection timed out|connection refused|no route to host/i

export function parseOpenVpnLogLine(line: string): OpenVpnLogEvent {
  const message = line.trim()

  if (/Initialization Sequence Completed/i.test(message)) {
    return { type: 'initialized' }
  }
  if (AUTH_ERROR.test(message)) {
    return { type: 'auth-error', message }
  }
  if (CONFIG_ERROR.test(message)) {
    return { type: 'config-error', message }
  }
  if (TLS_ERROR.test(message)) {
    return { type: 'tls-error', message }
  }
  if (PROCESS_ERROR.test(message)) {
    return { type: 'process-error', message }
  }

  return { type: 'log', message }
}
