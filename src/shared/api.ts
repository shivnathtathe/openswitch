import type {
  AppSettings,
  AppResult,
  BundleExportResult,
  BundleImportPreview,
  BundleImportResult,
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
  selectBundleForImport(): Promise<AppResult<BundleImportPreview | null>>
  importBundle(
    sessionId: string,
    profileKeys: readonly string[],
  ): Promise<AppResult<BundleImportResult>>
  discardBundleImport(sessionId: string): Promise<AppResult<void>>
  exportBundle(profileIds: readonly VpnProfileId[]): Promise<AppResult<BundleExportResult | null>>
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
