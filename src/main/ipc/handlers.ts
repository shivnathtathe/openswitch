import { BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import type {
  AppError,
  AppResult,
  AppSettings,
  AppearanceTheme,
  ConfigFileSelection,
  ConnectionState,
  CreateVpnProfileInput,
  UpdateVpnProfileInput,
  UpdateAppSettingsInput,
  VpnProfile,
} from '../../shared/contracts'
import { IPC_CHANNELS } from '../../shared/ipc'

export interface IpcActions {
  listProfiles(): Promise<readonly VpnProfile[]>
  createProfile(input: CreateVpnProfileInput): Promise<VpnProfile>
  updateProfile(profileId: string, input: UpdateVpnProfileInput): Promise<VpnProfile>
  removeProfile(profileId: string): Promise<void>
  connect(profileId: string): Promise<ConnectionState>
  disconnect(): Promise<ConnectionState>
  getState(): ConnectionState
  getSettings(): AppSettings
  updateSettings(input: UpdateAppSettingsInput): AppSettings
  hide(): void
  quit(): void
}

function toError(error: unknown): AppError {
  const message = error instanceof Error ? error.message : String(error)
  const notFound = /not found|unknown profile/i.test(message)
  return {
    code: notFound ? 'PROFILE_NOT_FOUND' : 'INTERNAL_ERROR',
    message,
    retryable: !notFound,
  }
}

async function result<Value>(operation: () => Value | Promise<Value>): Promise<AppResult<Value>> {
  try {
    return { ok: true, value: await operation() }
  } catch (error) {
    return { ok: false, error: toError(error) }
  }
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const owner = BrowserWindow.fromWebContents(event.sender)
  const senderFrame = event.senderFrame
  const mainFrame = event.sender.mainFrame
  if (
    !owner ||
    !senderFrame ||
    owner.isDestroyed() ||
    owner.webContents.id !== event.sender.id ||
    senderFrame.processId !== mainFrame.processId ||
    senderFrame.routingId !== mainFrame.routingId
  ) {
    throw new Error('IPC request was rejected.')
  }
}

function validateId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 128) {
    throw new TypeError('A valid profile ID is required.')
  }
}

function validateCredentials(value: unknown): void {
  if (!isRecord(value)) throw new TypeError('Credentials must be an object.')
  if (
    typeof value.username !== 'string' ||
    !value.username.trim() ||
    value.username.length > 256 ||
    /[\r\n\0]/.test(value.username)
  ) {
    throw new TypeError('A valid username is required.')
  }
  if (
    typeof value.password !== 'string' ||
    !value.password ||
    value.password.length > 4096 ||
    /[\r\n\0]/.test(value.password)
  ) {
    throw new TypeError('A valid password is required.')
  }
}

function validateCreateInput(value: unknown): asserts value is CreateVpnProfileInput {
  if (!isRecord(value)) throw new TypeError('Profile input must be an object.')
  if (typeof value.name !== 'string' || typeof value.configFilePath !== 'string') {
    throw new TypeError('Profile name and configuration path are required.')
  }
  if (value.credentials !== undefined) validateCredentials(value.credentials)
}

function validateUpdateInput(value: unknown): asserts value is UpdateVpnProfileInput {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    throw new TypeError('At least one profile field is required.')
  }
  if (value.name !== undefined && typeof value.name !== 'string') {
    throw new TypeError('Profile name must be a string.')
  }
  if (value.configFilePath !== undefined && typeof value.configFilePath !== 'string') {
    throw new TypeError('Configuration path must be a string.')
  }
  if (value.credentials !== undefined) {
    if (
      !isRecord(value.credentials) ||
      !['set', 'clear'].includes(String(value.credentials.action))
    ) {
      throw new TypeError('Credential update is invalid.')
    }
    if (value.credentials.action === 'set') validateCredentials(value.credentials.value)
  }
}

function validateSettingsInput(value: unknown): asserts value is UpdateAppSettingsInput {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    throw new TypeError('At least one setting is required.')
  }
  const allowed = new Set(['launchAtLogin', 'closeToTray', 'diagnosticLogging'])
  for (const [key, setting] of Object.entries(value)) {
    if (!allowed.has(key) || typeof setting !== 'boolean') {
      throw new TypeError('Settings update is invalid.')
    }
  }
}

function validateTheme(value: unknown): asserts value is AppearanceTheme {
  if (value !== 'system' && value !== 'light' && value !== 'dark') {
    throw new TypeError('Theme must be system, light, or dark.')
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function chooseOvpnFile(event: IpcMainInvokeEvent): Promise<ConfigFileSelection | null> {
  const options: Electron.OpenDialogOptions = {
    title: 'Select OpenVPN profile',
    properties: ['openFile'],
    filters: [{ name: 'OpenVPN profiles', extensions: ['ovpn'] }],
  }
  const owner = BrowserWindow.fromWebContents(event.sender)
  const selection = owner
    ? await dialog.showOpenDialog(owner, options)
    : await dialog.showOpenDialog(options)
  const filePath = selection.filePaths[0]
  if (selection.canceled || !filePath) return null
  return { path: filePath, fileName: filePath.split(/[\\/]/).pop() ?? filePath }
}

export function registerIpcHandlers(actions: IpcActions): () => void {
  ipcMain.handle(IPC_CHANNELS.profiles.list, (event) => {
    assertTrustedSender(event)
    return result(() => actions.listProfiles())
  })
  ipcMain.handle(IPC_CHANNELS.profiles.create, (event, input: unknown) => {
    assertTrustedSender(event)
    validateCreateInput(input)
    return result(() => actions.createProfile(input))
  })
  ipcMain.handle(IPC_CHANNELS.profiles.update, (event, id: unknown, input: unknown) => {
    assertTrustedSender(event)
    validateId(id)
    validateUpdateInput(input)
    return result(() => actions.updateProfile(id, input))
  })
  ipcMain.handle(IPC_CHANNELS.profiles.remove, (event, id: unknown) => {
    assertTrustedSender(event)
    validateId(id)
    return result(() => actions.removeProfile(id))
  })
  ipcMain.handle(IPC_CHANNELS.profiles.selectConfigFile, (event) => {
    assertTrustedSender(event)
    return result(() => chooseOvpnFile(event))
  })
  ipcMain.handle(IPC_CHANNELS.settings.get, (event) => {
    assertTrustedSender(event)
    return result(() => actions.getSettings())
  })
  ipcMain.handle(IPC_CHANNELS.settings.update, (event, input: unknown) => {
    assertTrustedSender(event)
    validateSettingsInput(input)
    return result(() => actions.updateSettings(input))
  })
  ipcMain.handle(IPC_CHANNELS.settings.setTheme, (event, theme: unknown) => {
    assertTrustedSender(event)
    validateTheme(theme)
    return result(() => actions.updateSettings({ theme }))
  })
  ipcMain.handle(IPC_CHANNELS.connection.connect, (event, id: unknown) => {
    assertTrustedSender(event)
    validateId(id)
    return result(() => actions.connect(id))
  })
  ipcMain.handle(IPC_CHANNELS.connection.disconnect, (event) => {
    assertTrustedSender(event)
    return result(() => actions.disconnect())
  })
  ipcMain.handle(IPC_CHANNELS.connection.getState, (event) => {
    assertTrustedSender(event)
    return result(() => actions.getState())
  })
  ipcMain.handle(IPC_CHANNELS.app.hideWindow, (event) => {
    assertTrustedSender(event)
    return result(() => actions.hide())
  })
  ipcMain.handle(IPC_CHANNELS.app.quit, (event) => {
    assertTrustedSender(event)
    return result(() => actions.quit())
  })

  const channels = [
    IPC_CHANNELS.profiles.list,
    IPC_CHANNELS.profiles.create,
    IPC_CHANNELS.profiles.update,
    IPC_CHANNELS.profiles.remove,
    IPC_CHANNELS.profiles.selectConfigFile,
    IPC_CHANNELS.settings.get,
    IPC_CHANNELS.settings.update,
    IPC_CHANNELS.settings.setTheme,
    IPC_CHANNELS.connection.connect,
    IPC_CHANNELS.connection.disconnect,
    IPC_CHANNELS.connection.getState,
    IPC_CHANNELS.app.hideWindow,
    IPC_CHANNELS.app.quit,
  ]
  return () => channels.forEach((channel) => ipcMain.removeHandler(channel))
}
