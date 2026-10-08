import type {
  AppSettings,
  ConnectionState,
  CreateVpnProfileInput,
  UpdateVpnProfileInput,
  UpdateAppSettingsInput,
  VpnCredentialsInput,
  VpnProfile,
} from '../../shared/contracts'

export interface ProfileStorePort {
  list(): Promise<readonly VpnProfile[]>
  get(profileId: string): Promise<VpnProfile | undefined>
  create(input: CreateVpnProfileInput): Promise<VpnProfile>
  update(profileId: string, input: UpdateVpnProfileInput): Promise<VpnProfile>
  remove(profileId: string): Promise<void>
}

export interface CredentialVaultPort {
  get(profileId: string): Promise<VpnCredentialsInput | undefined>
}

export interface OpenVpnPort {
  connect(profile: VpnProfile, credentials?: VpnCredentialsInput): Promise<void>
  disconnect(): Promise<void>
  onStateChanged?(listener: (state: ConnectionState) => void): () => void
}

export interface SettingsPort {
  get(): AppSettings
  update(input: UpdateAppSettingsInput): AppSettings
}

export interface MainServices {
  profiles: ProfileStorePort
  credentials: CredentialVaultPort
  vpn: OpenVpnPort
  settings: SettingsPort
}
