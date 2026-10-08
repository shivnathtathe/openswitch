import type { ConnectionState } from '../../../shared'
import { ProfileEmptyState } from './ProfileEmptyState'
import { ProfileRow } from './ProfileRow'
import type { ProfileListItem } from './types'

export interface ProfileListProps {
  profiles: readonly ProfileListItem[]
  connectionState: ConnectionState
  onAdd: () => void
  onConnect: (profile: ProfileListItem) => void
  onDisconnect: (profile: ProfileListItem) => void
  onEdit: (profile: ProfileListItem) => void
  onDelete: (profile: ProfileListItem) => void
  disabled?: boolean
  label?: string
}

export function ProfileList({
  profiles,
  connectionState,
  onAdd,
  onConnect,
  onDisconnect,
  onEdit,
  onDelete,
  disabled,
  label = 'VPN profiles',
}: ProfileListProps) {
  if (profiles.length === 0) return <ProfileEmptyState onAdd={onAdd} disabled={disabled} />

  const connectionChanging =
    connectionState.status === 'connecting' || connectionState.status === 'disconnecting'

  return (
    <ul className="profile-list" aria-label={label}>
      {profiles.map((profile) => (
        <ProfileRow
          key={profile.id}
          profile={profile}
          connectionState={connectionState}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onEdit={onEdit}
          onDelete={onDelete}
          disabled={disabled || connectionChanging}
        />
      ))}
    </ul>
  )
}
