import { StatusMark, TechnicalDetails, type StatusTone } from '../ui'
import type { ProfileConnectionStatus } from './types'

const STATUS_DETAILS: Record<ProfileConnectionStatus, { label: string; tone: StatusTone }> = {
  connected: { label: 'Connected', tone: 'positive' },
  connecting: { label: 'Connecting', tone: 'progress' },
  disconnecting: { label: 'Disconnecting', tone: 'progress' },
  disconnected: { label: 'Disconnected', tone: 'neutral' },
  error: { label: 'Needs attention', tone: 'negative' },
}

export interface ProfileStatusProps {
  status: ProfileConnectionStatus
  message?: string
}

export function ProfileStatus({ status, message }: ProfileStatusProps) {
  const details = STATUS_DETAILS[status]
  return (
    <div className="profile-status-wrap" role="status" aria-live="polite">
      <StatusMark className="profile-status" label={details.label} tone={details.tone} />
      {message ? <TechnicalDetails>{message}</TechnicalDetails> : null}
    </div>
  )
}
