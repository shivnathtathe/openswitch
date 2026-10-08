import { beforeEach, describe, expect, it, vi } from 'vitest'

const electron = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      electron.handlers.set(channel, handler)
    }),
    removeHandler: vi.fn((channel: string) => electron.handlers.delete(channel)),
  },
  dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() },
  BrowserWindow: { fromWebContents: vi.fn() },
}))

vi.mock('electron', () => electron)

import { registerIpcHandlers, type IpcActions } from '../../../src/main/ipc/handlers'
import { IPC_CHANNELS } from '../../../src/shared/ipc'

function trustedEvent() {
  const mainFrame = { processId: 10, routingId: 20 }
  const sender = { id: 30, mainFrame }
  const event = { sender, senderFrame: { processId: 10, routingId: 20 } }
  electron.BrowserWindow.fromWebContents.mockReturnValue({
    isDestroyed: () => false,
    webContents: sender,
  })
  return event
}

function actions(): IpcActions {
  return {
    listProfiles: vi.fn(async () => []),
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
    removeProfile: vi.fn(async () => undefined),
    previewBundle: vi.fn(),
    importBundle: vi.fn(),
    discardBundleImport: vi.fn(),
    exportBundle: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    getState: vi.fn(() => ({ status: 'disconnected', profileId: null })),
    getSettings: vi.fn(() => ({
      theme: 'system',
      launchAtLogin: false,
      closeToTray: true,
      diagnosticLogging: false,
    })),
    updateSettings: vi.fn((input) => ({
      theme: 'system',
      launchAtLogin: false,
      closeToTray: true,
      diagnosticLogging: false,
      ...input,
    })),
    hide: vi.fn(),
    quit: vi.fn(),
  }
}

describe('registerIpcHandlers validation', () => {
  beforeEach(() => {
    electron.handlers.clear()
    vi.clearAllMocks()
  })

  it('registers and removes every invoke channel', () => {
    const dispose = registerIpcHandlers(actions())
    const registered = [...electron.handlers.keys()]

    expect(registered).toContain(IPC_CHANNELS.profiles.create)
    expect(registered).toContain(IPC_CHANNELS.settings.get)
    expect(registered).toContain(IPC_CHANNELS.connection.connect)
    expect(registered).toContain(IPC_CHANNELS.app.quit)

    dispose()
    expect(electron.handlers.size).toBe(0)
  })

  it('validates and applies settings updates', async () => {
    const service = actions()
    registerIpcHandlers(service)
    const handler = electron.handlers.get(IPC_CHANNELS.settings.update)

    await expect(handler?.(trustedEvent(), { closeToTray: false })).resolves.toMatchObject({
      ok: true,
      value: { closeToTray: false },
    })
    expect(service.updateSettings).toHaveBeenCalledWith({ closeToTray: false })
  })

  it('validates and applies appearance theme updates', async () => {
    const service = actions()
    registerIpcHandlers(service)
    const handler = electron.handlers.get(IPC_CHANNELS.settings.setTheme)

    await expect(handler?.(trustedEvent(), 'dark')).resolves.toMatchObject({
      ok: true,
      value: { theme: 'dark' },
    })
    expect(service.updateSettings).toHaveBeenCalledWith({ theme: 'dark' })

    expect(() => handler?.(trustedEvent(), 'contrast')).toThrow(
      'Theme must be system, light, or dark.',
    )
  })

  it.each([{}, { unknown: true }, { launchAtLogin: 'yes' }])(
    'rejects invalid settings updates: %j',
    (input) => {
      const service = actions()
      registerIpcHandlers(service)
      const handler = electron.handlers.get(IPC_CHANNELS.settings.update)

      expect(() => handler?.(trustedEvent(), input)).toThrow()
      expect(service.updateSettings).not.toHaveBeenCalled()
    },
  )

  it('rejects requests not sent by the owning main frame', () => {
    const service = actions()
    registerIpcHandlers(service)
    const event = trustedEvent()
    event.senderFrame.routingId = 999

    expect(() => electron.handlers.get(IPC_CHANNELS.profiles.list)?.(event)).toThrow(
      'IPC request was rejected.',
    )
    expect(service.listProfiles).not.toHaveBeenCalled()
  })

  it.each([null, '', '   ', 'x'.repeat(129)])('rejects invalid profile IDs: %j', (id) => {
    const service = actions()
    registerIpcHandlers(service)
    const handler = electron.handlers.get(IPC_CHANNELS.connection.connect)

    expect(() => handler?.(trustedEvent(), id)).toThrow('A valid profile ID is required.')
    expect(service.connect).not.toHaveBeenCalled()
  })

  it.each([
    ['missing input', undefined],
    ['non-string fields', { name: 42, configFilePath: 'office.ovpn' }],
    [
      'newline in username',
      {
        name: 'Office',
        configFilePath: 'office.ovpn',
        credentials: { username: 'alice\nadmin', password: 'secret' },
      },
    ],
    [
      'newline in password',
      {
        name: 'Office',
        configFilePath: 'office.ovpn',
        credentials: { username: 'alice', password: 'secret\nvalue' },
      },
    ],
  ])('rejects invalid create payloads: %s', (_label, input) => {
    const service = actions()
    registerIpcHandlers(service)
    const handler = electron.handlers.get(IPC_CHANNELS.profiles.create)

    expect(() => handler?.(trustedEvent(), input)).toThrow()
    expect(service.createProfile).not.toHaveBeenCalled()
  })

  it.each([
    ['empty update', {}],
    ['wrong field type', { name: false }],
    ['unknown credential action', { credentials: { action: 'replace' } }],
    ['missing set value', { credentials: { action: 'set' } }],
  ])('rejects invalid update payloads: %s', (_label, input) => {
    const service = actions()
    registerIpcHandlers(service)
    const handler = electron.handlers.get(IPC_CHANNELS.profiles.update)

    expect(() => handler?.(trustedEvent(), 'profile-1', input)).toThrow()
    expect(service.updateProfile).not.toHaveBeenCalled()
  })

  it('passes valid input to the action and serializes action failures', async () => {
    const service = actions()
    vi.mocked(service.createProfile).mockRejectedValue(new Error('database unavailable'))
    registerIpcHandlers(service)
    const input = {
      name: 'Office',
      configFilePath: String.raw`C:\VPN\office.ovpn`,
      credentials: { username: 'alice', password: 'secret' },
    }

    const response = await electron.handlers.get(IPC_CHANNELS.profiles.create)?.(
      trustedEvent(),
      input,
    )

    expect(service.createProfile).toHaveBeenCalledWith(input)
    expect(response).toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'database unavailable', retryable: true },
    })
  })

  it('returns null when bundle open and save dialogs are cancelled', async () => {
    const service = actions()
    electron.dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })
    electron.dialog.showSaveDialog.mockResolvedValue({ canceled: true })
    registerIpcHandlers(service)

    await expect(
      electron.handlers.get(IPC_CHANNELS.profiles.selectBundleForImport)?.(trustedEvent()),
    ).resolves.toEqual({ ok: true, value: null })
    await expect(
      electron.handlers.get(IPC_CHANNELS.profiles.exportBundle)?.(trustedEvent(), ['profile-1']),
    ).resolves.toEqual({ ok: true, value: null })
    expect(service.previewBundle).not.toHaveBeenCalled()
    expect(service.exportBundle).not.toHaveBeenCalled()
  })

  it.each([
    ['empty import selection', IPC_CHANNELS.profiles.importBundle, ['session', []]],
    ['duplicate import keys', IPC_CHANNELS.profiles.importBundle, ['session', ['one', 'one']]],
    ['empty export selection', IPC_CHANNELS.profiles.exportBundle, [[]]],
  ])('rejects invalid bundle IPC input: %s', (_label, channel, args) => {
    const service = actions()
    registerIpcHandlers(service)
    expect(() => electron.handlers.get(channel)?.(trustedEvent(), ...args)).toThrow()
    expect(service.importBundle).not.toHaveBeenCalled()
    expect(service.exportBundle).not.toHaveBeenCalled()
  })
})
