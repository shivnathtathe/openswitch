import { contextBridge, ipcRenderer } from 'electron'

import type { ConnectionStateListener, OpenSwitchApi } from '../shared/api'
import type {
  AppSettings,
  AppResult,
  AppearanceTheme,
  ConnectionState,
  CreateVpnProfileInput,
  UpdateVpnProfileInput,
  UpdateAppSettingsInput,
  VpnProfileId,
} from '../shared/contracts'
import type { IpcInvokeChannel, IpcInvokeContract } from '../shared/ipc'

// Sandboxed preloads cannot load local runtime modules, so keep this bridge self-contained.
const IPC_CHANNELS = {
  profiles: {
    list: 'open-switch:profiles:list',
    create: 'open-switch:profiles:create',
    update: 'open-switch:profiles:update',
    remove: 'open-switch:profiles:remove',
    selectConfigFile: 'open-switch:profiles:select-config-file',
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
} as const satisfies typeof import('../shared/ipc').IPC_CHANNELS

const invoke = <Channel extends IpcInvokeChannel>(
  channel: Channel,
  ...args: IpcInvokeContract[Channel]['args']
): Promise<AppResult<IpcInvokeContract[Channel]['value']>> =>
  ipcRenderer.invoke(channel, ...args) as Promise<AppResult<IpcInvokeContract[Channel]['value']>>

const profiles: OpenSwitchApi['profiles'] = Object.freeze({
  list: () => invoke(IPC_CHANNELS.profiles.list),
  create: (input: CreateVpnProfileInput) => invoke(IPC_CHANNELS.profiles.create, input),
  update: (profileId: VpnProfileId, input: UpdateVpnProfileInput) =>
    invoke(IPC_CHANNELS.profiles.update, profileId, input),
  remove: (profileId: VpnProfileId) => invoke(IPC_CHANNELS.profiles.remove, profileId),
  selectConfigFile: () => invoke(IPC_CHANNELS.profiles.selectConfigFile),
})

const settings: OpenSwitchApi['settings'] = Object.freeze({
  get: () => invoke(IPC_CHANNELS.settings.get),
  update: async (input: UpdateAppSettingsInput): Promise<AppResult<AppSettings>> => {
    const { theme, ...behaviorSettings } = input
    let result: AppResult<AppSettings> | undefined

    if (Object.keys(behaviorSettings).length > 0) {
      result = await invoke(
        IPC_CHANNELS.settings.update,
        behaviorSettings as UpdateAppSettingsInput,
      )
      if (!result.ok) return result
    }

    if (theme !== undefined) {
      result = await invoke(IPC_CHANNELS.settings.setTheme, theme as AppearanceTheme)
    }

    return (
      result ?? {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'At least one setting is required.',
          retryable: false,
        },
      }
    )
  },
})

const openSwitchApi: OpenSwitchApi = Object.freeze({
  profiles,
  settings,
  connect: (profileId: VpnProfileId) => invoke(IPC_CHANNELS.connection.connect, profileId),
  disconnect: () => invoke(IPC_CHANNELS.connection.disconnect),
  getState: () => invoke(IPC_CHANNELS.connection.getState),
  onConnectionStateChange: (listener: ConnectionStateListener) => {
    const handler = (_event: Electron.IpcRendererEvent, state: ConnectionState) => {
      listener(state)
    }

    ipcRenderer.on(IPC_CHANNELS.connection.stateChanged, handler)

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.connection.stateChanged, handler)
    }
  },
  hideWindow: () => invoke(IPC_CHANNELS.app.hideWindow),
  quit: () => invoke(IPC_CHANNELS.app.quit),
})

contextBridge.exposeInMainWorld('openSwitch', openSwitchApi)
