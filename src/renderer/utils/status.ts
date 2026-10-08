import type { ConnectionState, ConnectionStatus } from '../state/types'

const STATUS_LABELS: Readonly<Record<ConnectionStatus, string>> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting...',
  connected: 'Connected',
  disconnecting: 'Disconnecting...',
  error: 'Connection error',
}

export function formatConnectionStatus(stateOrStatus: ConnectionState | ConnectionStatus): string {
  const status = typeof stateOrStatus === 'string' ? stateOrStatus : stateOrStatus.status
  return STATUS_LABELS[status]
}
