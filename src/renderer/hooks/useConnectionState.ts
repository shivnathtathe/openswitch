import { useSyncExternalStore } from 'react'
import {
  clearConnectionError,
  connect,
  disconnect,
  getConnectionSnapshot,
  subscribeConnection,
} from '../state/connectionStore'
import type { ConnectionState, ConnectionStatus, VpnProfileId } from '../state/types'
import { formatError } from '../utils/errors'
import { formatConnectionStatus } from '../utils/status'

export interface UseConnectionStateResult {
  state: ConnectionState
  status: ConnectionStatus
  statusLabel: string
  profileId: VpnProfileId | null
  error: string | null
  isLoading: boolean
  isConnecting: boolean
  isDisconnecting: boolean
  connect: (profileId: VpnProfileId) => Promise<boolean>
  disconnect: () => Promise<boolean>
  clearError: () => void
}

export function useConnectionState(): UseConnectionStateResult {
  const state = useSyncExternalStore(
    subscribeConnection,
    getConnectionSnapshot,
    getConnectionSnapshot,
  )

  return {
    state: state.state,
    status: state.state.status,
    statusLabel: formatConnectionStatus(state.state),
    profileId: state.state.profileId,
    error:
      state.actionError ??
      (state.state.status === 'error' && !state.isStateErrorDismissed
        ? formatError(state.state.error)
        : null),
    isLoading: state.isLoading,
    isConnecting: state.isConnecting,
    isDisconnecting: state.isDisconnecting,
    connect,
    disconnect,
    clearError: clearConnectionError,
  }
}
