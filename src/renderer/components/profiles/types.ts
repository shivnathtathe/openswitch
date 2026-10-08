import type {
  ConnectionState,
  CreateVpnProfileInput,
  UpdateVpnProfileInput,
  VpnCredentialsInput,
  VpnProfile,
} from '../../../shared'

export type ProfileConnectionStatus = ConnectionState['status']
export type ProfileListItem = VpnProfile

export interface ProfileEditorValue {
  name: string
  configFilePath: string
  credentials?: VpnCredentialsInput
  credentialChange: 'keep' | 'set' | 'clear'
}

export type ProfileEditorInitialValue = Pick<
  VpnProfile,
  'name' | 'configFilePath' | 'configFileName' | 'credentials'
>

export function toCreateVpnProfileInput(value: ProfileEditorValue): CreateVpnProfileInput {
  return {
    name: value.name,
    configFilePath: value.configFilePath,
    ...(value.credentialChange === 'set' && value.credentials
      ? { credentials: value.credentials }
      : {}),
  }
}

export function toUpdateVpnProfileInput(value: ProfileEditorValue): UpdateVpnProfileInput {
  return {
    name: value.name,
    configFilePath: value.configFilePath,
    ...(value.credentialChange === 'set' && value.credentials
      ? { credentials: { action: 'set' as const, value: value.credentials } }
      : value.credentialChange === 'clear'
        ? { credentials: { action: 'clear' as const } }
        : {}),
  }
}
