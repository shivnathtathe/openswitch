import { Button } from '../ui'
import type { ProfileConnectionStatus } from './types'

export interface ProfileActionsProps {
  profileName: string
  status: ProfileConnectionStatus
  onConnect: () => void
  onDisconnect: () => void
  onEdit: () => void
  onDelete: () => void
  disabled?: boolean
}

export function ProfileActions({
  profileName,
  status,
  onConnect,
  onDisconnect,
  onEdit,
  onDelete,
  disabled = false,
}: ProfileActionsProps) {
  const connected = status === 'connected'
  const changing = status === 'connecting' || status === 'disconnecting'

  return (
    <div className="profile-actions" aria-label={`Actions for ${profileName}`}>
      {connected || status === 'disconnecting' ? (
        <Button
          variant="secondary"
          onClick={onDisconnect}
          disabled={disabled || changing}
          busy={status === 'disconnecting'}
          busyLabel="Disconnecting..."
          aria-label={`Disconnect ${profileName}`}
        >
          Disconnect
        </Button>
      ) : (
        <Button
          variant="primary"
          onClick={onConnect}
          disabled={disabled || changing}
          busy={status === 'connecting'}
          busyLabel="Connecting..."
          aria-label={`Connect ${profileName}`}
        >
          Connect
        </Button>
      )}
      <Button
        variant="quiet"
        onClick={onEdit}
        disabled={disabled || changing}
        aria-label={`Edit ${profileName}`}
      >
        Edit
      </Button>
      <Button
        variant="quiet"
        onClick={onDelete}
        disabled={disabled || changing}
        aria-label={`Delete ${profileName}`}
      >
        Delete
      </Button>
    </div>
  )
}
