import type { ConnectionState } from '../../../shared'
import { ProfileActions } from './ProfileActions'
import { ProfileStatus } from './ProfileStatus'
import type { ProfileListItem } from './types'

export interface ProfileRowProps {
  profile: ProfileListItem
  connectionState: ConnectionState
  onConnect: (profile: ProfileListItem) => void
  onDisconnect: (profile: ProfileListItem) => void
  onEdit: (profile: ProfileListItem) => void
  onDelete: (profile: ProfileListItem) => void
  disabled?: boolean
}

export function ProfileRow({
  profile,
  connectionState,
  onConnect,
  onDisconnect,
  onEdit,
  onDelete,
  disabled,
}: ProfileRowProps) {
  const isCurrentProfile = connectionState.profileId === profile.id
  const status = isCurrentProfile ? connectionState.status : 'disconnected'
  const statusMessage =
    isCurrentProfile && connectionState.status === 'error'
      ? connectionState.error.message
      : undefined

  return (
    <li className="profile-row" data-profile-id={profile.id}>
      <div className="profile-row__details">
        <div className="profile-row__heading">
          <h3 className="profile-row__name" title={profile.name}>
            {profile.name}
          </h3>
          <ProfileStatus status={status} message={statusMessage} />
        </div>
        <div className="profile-row__path" title={profile.configFilePath}>
          {profile.configFileName}
        </div>
        {profile.credentials.usernameConfigured && profile.credentials.passwordConfigured ? (
          <div className="profile-row__credentials">Credentials saved</div>
        ) : profile.credentials.usernameConfigured || profile.credentials.passwordConfigured ? (
          <div className="profile-row__credentials profile-row__credentials--warning">
            Credentials need attention
          </div>
        ) : null}
      </div>
      <ProfileActions
        profileName={profile.name}
        status={status}
        onConnect={() => onConnect(profile)}
        onDisconnect={() => onDisconnect(profile)}
        onEdit={() => onEdit(profile)}
        onDelete={() => onDelete(profile)}
        disabled={disabled}
      />
    </li>
  )
}
