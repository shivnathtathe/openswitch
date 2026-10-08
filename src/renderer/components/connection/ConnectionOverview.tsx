import { useEffect, useState } from 'react'
import type { ConnectionStatus } from '../../state/types'

interface ConnectionOverviewProps {
  status: ConnectionStatus
  statusLabel: string
  profileName?: string
  isLoading?: boolean
  connectedAt?: string
  error?: string | null
  technicalDetails?: string | null
  onDismissError?: () => void
}

function formatDuration(connectedAt: string, now: number) {
  const elapsedSeconds = Math.max(0, Math.floor((now - Date.parse(connectedAt)) / 1000))
  const hours = Math.floor(elapsedSeconds / 3600)
  const minutes = Math.floor((elapsedSeconds % 3600) / 60)
  const seconds = elapsedSeconds % 60

  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    : `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function ConnectionOverview({
  status,
  statusLabel,
  profileName,
  isLoading = false,
  connectedAt,
  error,
  technicalDetails,
  onDismissError,
}: ConnectionOverviewProps) {
  const [now, setNow] = useState(() => Date.now())
  const showDuration = status === 'connected' && connectedAt

  useEffect(() => {
    if (!showDuration) return
    setNow(Date.now())
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [showDuration])

  const displayStatus = isLoading ? 'Loading status' : statusLabel
  const detail = isLoading
    ? 'Checking the OpenVPN process'
    : profileName
      ? `via ${profileName}`
      : status === 'error'
        ? 'Connection needs attention'
        : 'No active tunnel'

  return (
    <section className="connection-overview" data-status={status}>
      <div className="connection-overview__main">
        <span className="connection-overview__signal" aria-hidden="true">
          <span className="connection-overview__dot" />
        </span>
        <div>
          <p className="eyebrow">Connection</p>
          <div className="connection-overview__status" role="status" aria-live="polite">
            <h2>{displayStatus}</h2>
            <span className="connection-overview__detail">{detail}</span>
          </div>
        </div>
      </div>
      {showDuration ? (
        <div className="connection-overview__duration">
          <span className="eyebrow">Connected for</span>
          <strong>{formatDuration(connectedAt, now)}</strong>
        </div>
      ) : null}
      {error ? (
        <div className="connection-error" role="alert">
          <div className="connection-error__summary">
            <strong>Connection needs attention</strong>
            <span>{error}</span>
          </div>
          <div className="connection-error__actions">
            {technicalDetails ? (
              <details>
                <summary>Technical details</summary>
                <pre>{technicalDetails}</pre>
              </details>
            ) : null}
            {onDismissError ? (
              <button type="button" onClick={onDismissError}>
                Dismiss
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
