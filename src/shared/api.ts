import type {
  AppSettings,
  AppResult,
  ConfigFileSelection,
  ConnectionState,
  CreateVpnProfileInput,
  UpdateVpnProfileInput,
  UpdateAppSettingsInput,
  VpnProfile,
  VpnProfileId,
} from './contracts'

export interface OpenSwitchProfileApi {
  list(): Promise<AppResult<readonly VpnProfile[]>>
  create(input: CreateVpnProfileInput): Promise<AppResult<VpnProfile>>
  update(profileId: VpnProfileId, input: UpdateVpnProfileInput): Promise<AppResult<VpnProfile>>
  remove(profileId: VpnProfileId): Promise<AppResult<void>>
  selectConfigFile(): Promise<AppResult<ConfigFileSelection | null>>
}

export type ConnectionStateListener = (state: ConnectionState) => void
export type Unsubscribe = () => void

export interface OpenSwitchSettingsApi {
  get(): Promise<AppResult<AppSettings>>
  update(input: UpdateAppSettingsInput): Promise<AppResult<AppSettings>>
}

export interface OpenSwitchApi {
  readonly profiles: OpenSwitchProfileApi
  readonly settings: OpenSwitchSettingsApi
  connect(profileId: VpnProfileId): Promise<AppResult<ConnectionState>>
  disconnect(): Promise<AppResult<ConnectionState>>
  getState(): Promise<AppResult<ConnectionState>>
  onConnectionStateChange(listener: ConnectionStateListener): Unsubscribe
  hideWindow(): Promise<AppResult<void>>
  quit(): Promise<AppResult<void>>
}
