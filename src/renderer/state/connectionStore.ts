import type { ConnectionState, VpnProfileId } from './types'
import { formatError } from '../utils/errors'
import { getOpenSwitchApi } from '../utils/openSwitch'

export interface ConnectionSnapshot {
  state: ConnectionState
  isLoading: boolean
  isConnecting: boolean
  isDisconnecting: boolean
  actionError: string | null
  isStateErrorDismissed: boolean
}

const INITIAL_STATE: ConnectionState = { status: 'disconnected', profileId: null }

let snapshot: ConnectionSnapshot = {
  state: INITIAL_STATE,
  isLoading: true,
  isConnecting: false,
  isDisconnecting: false,
  actionError: null,
  isStateErrorDismissed: false,
}
let unsubscribeBridge: (() => void) | null = null
let startSequence = 0
let eventSequence = 0
let actionSequence = 0
const listeners = new Set<() => void>()

function publish(change: Partial<ConnectionSnapshot>): void {
  snapshot = { ...snapshot, ...change }
  listeners.forEach((listener) => listener())
}

function acceptAuthoritativeState(state: ConnectionState): void {
  eventSequence += 1
  publish({
    state,
    isLoading: false,
    isConnecting: state.status === 'connecting',
    isDisconnecting: state.status === 'disconnecting',
    actionError: null,
    isStateErrorDismissed: false,
  })
}

async function startConnectionState(): Promise<void> {
  if (unsubscribeBridge) return

  const sequence = ++startSequence
  const eventsBeforeLoad = eventSequence
  try {
    const api = getOpenSwitchApi()
    unsubscribeBridge = api.onConnectionStateChange(acceptAuthoritativeState)
    const result = await api.getState()
    if (sequence !== startSequence || eventsBeforeLoad !== eventSequence) return
    if (result.ok) acceptAuthoritativeState(result.value)
    else publish({ isLoading: false, actionError: formatError(result.error) })
  } catch (error) {
    if (sequence === startSequence) {
      publish({
        isLoading: false,
        actionError: formatError(error, 'Connection status is unavailable.'),
      })
    }
  }
}

export function getConnectionSnapshot(): ConnectionSnapshot {
  return snapshot
}

export function subscribeConnection(listener: () => void): () => void {
  listeners.add(listener)
  void startConnectionState()

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      startSequence += 1
      unsubscribeBridge?.()
      unsubscribeBridge = null
    }
  }
}

export async function connect(profileId: VpnProfileId): Promise<boolean> {
  const sequence = ++actionSequence
  publish({ isConnecting: true, isDisconnecting: false, actionError: null })

  try {
    const result = await getOpenSwitchApi().connect(profileId)
    if (sequence !== actionSequence) return result.ok
    if (result.ok) {
      acceptAuthoritativeState(result.value)
      return true
    }
    publish({ isConnecting: false, actionError: formatError(result.error) })
    return false
  } catch (error) {
    if (sequence === actionSequence) {
      publish({
        isConnecting: false,
        actionError: formatError(error, 'The connection could not be established.'),
      })
    }
    return false
  }
}

export async function disconnect(): Promise<boolean> {
  const sequence = ++actionSequence
  publish({ isConnecting: false, isDisconnecting: true, actionError: null })

  try {
    const result = await getOpenSwitchApi().disconnect()
    if (sequence !== actionSequence) return result.ok
    if (result.ok) {
      acceptAuthoritativeState(result.value)
      return true
    }
    publish({ isDisconnecting: false, actionError: formatError(result.error) })
    return false
  } catch (error) {
    if (sequence === actionSequence) {
      publish({
        isDisconnecting: false,
        actionError: formatError(error, 'The connection could not be closed.'),
      })
    }
    return false
  }
}

export function clearConnectionError(): void {
  if (snapshot.actionError || snapshot.state.status === 'error') {
    publish({ actionError: null, isStateErrorDismissed: true })
  }
}
