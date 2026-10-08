export type VpnProfileId = string
export type IsoDateTime = string

export interface CredentialStatus {
  readonly usernameConfigured: boolean
  readonly passwordConfigured: boolean
}

export interface VpnProfile {
  readonly id: VpnProfileId
  readonly name: string
  readonly configFilePath: string
  readonly configFileName: string
  readonly credentials: CredentialStatus
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
}

/** Credentials are accepted as write-only input and must never be included in a response. */
export interface VpnCredentialsInput {
  readonly username: string
  readonly password: string
}

export interface CreateVpnProfileInput {
  readonly name: string
  readonly configFilePath: string
  readonly credentials?: VpnCredentialsInput
}

export type VpnCredentialsUpdate =
  { readonly action: 'set'; readonly value: VpnCredentialsInput } | { readonly action: 'clear' }

interface VpnProfileUpdateFields {
  readonly name: string
  readonly configFilePath: string
  readonly credentials: VpnCredentialsUpdate
}

export type UpdateVpnProfileInput = {
  [Field in keyof VpnProfileUpdateFields]: Pick<VpnProfileUpdateFields, Field> &
    Partial<Omit<VpnProfileUpdateFields, Field>>
}[keyof VpnProfileUpdateFields]

export interface ConfigFileSelection {
  readonly path: string
  readonly fileName: string
}

export interface BundleProfilePreview {
  readonly key: string
  readonly name: string
  readonly username: string
  readonly includedFileCount: number
  readonly containsPrivateKey: boolean
}

export interface BundleImportPreview {
  readonly sessionId: string
  readonly fileName: string
  readonly profiles: readonly BundleProfilePreview[]
}

export interface BundleImportResult {
  readonly importedCount: number
  readonly profiles: readonly VpnProfile[]
}

export interface BundleExportResult {
  readonly exportedCount: number
  readonly fileName: string
}

export type ProfileBundlePreview = BundleImportPreview
export type ProfileBundleImportResult = BundleImportResult
export type ProfileBundleExportResult = BundleExportResult

export type AppearanceTheme = 'system' | 'light' | 'dark'

export interface AppSettings {
  readonly theme: AppearanceTheme
  readonly launchAtLogin: boolean
  readonly closeToTray: boolean
  readonly diagnosticLogging: boolean
}

export const DEFAULT_APP_SETTINGS: AppSettings = Object.freeze({
  theme: 'system',
  launchAtLogin: false,
  closeToTray: true,
  diagnosticLogging: false,
})

type AppSettingsUpdateFields = AppSettings

export type UpdateAppSettingsInput = {
  [Field in keyof AppSettingsUpdateFields]: Pick<AppSettingsUpdateFields, Field> &
    Partial<Omit<AppSettingsUpdateFields, Field>>
}[keyof AppSettingsUpdateFields]

export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'PROFILE_NOT_FOUND'
  | 'CONFIG_FILE_NOT_FOUND'
  | 'CONFIG_FILE_INVALID'
  | 'CREDENTIALS_REQUIRED'
  | 'CONNECTION_BUSY'
  | 'VPN_PROCESS_FAILED'
  | 'PERMISSION_DENIED'
  | 'INTERNAL_ERROR'

export interface AppError {
  readonly code: AppErrorCode
  readonly message: string
  readonly retryable: boolean
}

export type AppResult<Value> =
  { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly error: AppError }

export interface DisconnectedConnectionState {
  readonly status: 'disconnected'
  readonly profileId: null
}

export interface ConnectingConnectionState {
  readonly status: 'connecting'
  readonly profileId: VpnProfileId
  readonly startedAt: IsoDateTime
}

export interface ConnectedConnectionState {
  readonly status: 'connected'
  readonly profileId: VpnProfileId
  readonly connectedAt: IsoDateTime
}

export interface DisconnectingConnectionState {
  readonly status: 'disconnecting'
  readonly profileId: VpnProfileId
  readonly startedAt: IsoDateTime
}

export interface ErrorConnectionState {
  readonly status: 'error'
  readonly profileId: VpnProfileId | null
  readonly occurredAt: IsoDateTime
  readonly error: AppError
}

export type ConnectionState =
  | DisconnectedConnectionState
  | ConnectingConnectionState
  | ConnectedConnectionState
  | DisconnectingConnectionState
  | ErrorConnectionState
