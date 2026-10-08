import type {
  AppSettings,
  AppearanceTheme,
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

export const IPC_CHANNELS = {
  profiles: {
    list: 'open-switch:profiles:list',
    create: 'open-switch:profiles:create',
    update: 'open-switch:profiles:update',
    remove: 'open-switch:profiles:remove',
    selectConfigFile: 'open-switch:profiles:select-config-file',
    selectBundleForImport: 'open-switch:profiles:select-bundle-for-import',
    importBundle: 'open-switch:profiles:import-bundle',
    discardBundleImport: 'open-switch:profiles:discard-bundle-import',
    exportBundle: 'open-switch:profiles:export-bundle',
  },
  settings: {
    get: 'open-switch:settings:get',
    update: 'open-switch:settings:update',
    setTheme: 'open-switch:settings:set-theme',
  },
  connection: {
    connect: 'open-switch:connection:connect',
    disconnect: 'open-switch:connection:disconnect',
    getState: 'open-switch:connection:get-state',
    stateChanged: 'open-switch:connection:state-changed',
  },
  app: {
    hideWindow: 'open-switch:app:hide-window',
    quit: 'open-switch:app:quit',
  },
} as const

export type IpcInvokeChannel =
  | (typeof IPC_CHANNELS.profiles)[keyof typeof IPC_CHANNELS.profiles]
  | (typeof IPC_CHANNELS.settings)[keyof typeof IPC_CHANNELS.settings]
  | Exclude<
      (typeof IPC_CHANNELS.connection)[keyof typeof IPC_CHANNELS.connection],
      typeof IPC_CHANNELS.connection.stateChanged
    >
  | (typeof IPC_CHANNELS.app)[keyof typeof IPC_CHANNELS.app]

export type IpcEventChannel = typeof IPC_CHANNELS.connection.stateChanged

export interface IpcInvokeContract {
  readonly [IPC_CHANNELS.profiles.list]: {
    readonly args: readonly []
    readonly value: readonly VpnProfile[]
  }
  readonly [IPC_CHANNELS.profiles.create]: {
    readonly args: readonly [input: CreateVpnProfileInput]
    readonly value: VpnProfile
  }
  readonly [IPC_CHANNELS.profiles.update]: {
    readonly args: readonly [profileId: VpnProfileId, input: UpdateVpnProfileInput]
    readonly value: VpnProfile
  }
  readonly [IPC_CHANNELS.profiles.remove]: {
    readonly args: readonly [profileId: VpnProfileId]
    readonly value: void
  }
  readonly [IPC_CHANNELS.profiles.selectConfigFile]: {
    readonly args: readonly []
    readonly value: ConfigFileSelection | null
  }
  readonly [IPC_CHANNELS.profiles.selectBundleForImport]: {
    readonly args: readonly []
    readonly value: BundleImportPreview | null
  }
  readonly [IPC_CHANNELS.profiles.importBundle]: {
    readonly args: readonly [sessionId: string, profileKeys: readonly string[]]
    readonly value: BundleImportResult
  }
  readonly [IPC_CHANNELS.profiles.discardBundleImport]: {
    readonly args: readonly [sessionId: string]
    readonly value: void
  }
  readonly [IPC_CHANNELS.profiles.exportBundle]: {
    readonly args: readonly [profileIds: readonly VpnProfileId[]]
    readonly value: BundleExportResult | null
  }
  readonly [IPC_CHANNELS.settings.get]: {
    readonly args: readonly []
    readonly value: AppSettings
  }
  readonly [IPC_CHANNELS.settings.update]: {
    readonly args: readonly [input: UpdateAppSettingsInput]
    readonly value: AppSettings
  }
  readonly [IPC_CHANNELS.settings.setTheme]: {
    readonly args: readonly [theme: AppearanceTheme]
    readonly value: AppSettings
  }
  readonly [IPC_CHANNELS.connection.connect]: {
    readonly args: readonly [profileId: VpnProfileId]
    readonly value: ConnectionState
  }
  readonly [IPC_CHANNELS.connection.disconnect]: {
    readonly args: readonly []
    readonly value: ConnectionState
  }
  readonly [IPC_CHANNELS.connection.getState]: {
    readonly args: readonly []
    readonly value: ConnectionState
  }
  readonly [IPC_CHANNELS.app.hideWindow]: {
    readonly args: readonly []
    readonly value: void
  }
  readonly [IPC_CHANNELS.app.quit]: {
    readonly args: readonly []
    readonly value: void
  }
}

export interface IpcEventContract {
  readonly [IPC_CHANNELS.connection.stateChanged]: ConnectionState
}
