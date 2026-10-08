export type {
  AppError,
  AppErrorCode,
  AppResult,
  ConfigFileSelection,
  ConnectionState,
  CreateVpnProfileInput,
  BundleExportResult,
  BundleImportPreview,
  BundleImportResult,
  UpdateVpnProfileInput,
  VpnCredentialsInput,
  VpnCredentialsUpdate,
  VpnProfile,
  VpnProfileId,
} from '../../shared/contracts'
export type { OpenSwitchApi } from '../../shared/api'

import type { ConnectionState } from '../../shared/contracts'

export type ConnectionStatus = ConnectionState['status']
