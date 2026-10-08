import { beforeEach, describe, expect, it, vi } from 'vitest'

const electron = vi.hoisted(() => {
  const trayInstances: Array<{
    setToolTip: ReturnType<typeof vi.fn>
    setImage: ReturnType<typeof vi.fn>
    setContextMenu: ReturnType<typeof vi.fn>
    on: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
  }> = []
  const Tray = vi.fn(function () {
    const instance = {
      setToolTip: vi.fn(),
      setImage: vi.fn(),
      setContextMenu: vi.fn(),
      on: vi.fn(),
      destroy: vi.fn(),
    }
    trayInstances.push(instance)
    return instance
  })
  return {
    trayInstances,
    Tray,
    app: {
      isPackaged: false,
      getAppPath: vi.fn(() => String.raw`C:\app`),
      getPath: vi.fn(() => String.raw`C:\logs`),
    },
    shell: { openPath: vi.fn(async () => '') },
    Menu: { buildFromTemplate: vi.fn((template) => template) },
    nativeImage: {
      createFromPath: vi.fn(() => ({ isEmpty: () => false, setTemplateImage: vi.fn() })),
      createFromDataURL: vi.fn(() => ({ isEmpty: () => false, setTemplateImage: vi.fn() })),
    },
  }
})

vi.mock('electron', () => electron)

import { TrayService } from '../../../src/main/tray/tray-service'

function profile(id: string, name: string) {
  return {
    id,
    name,
    configFilePath: `${id}.ovpn`,
    configFileName: `${id}.ovpn`,
    credentials: { usernameConfigured: false, passwordConfigured: false },
    createdAt: '2026-10-08T10:00:00.000Z',
    updatedAt: '2026-10-08T10:00:00.000Z',
  }
}

describe('TrayService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    electron.trayInstances.length = 0
  })

  it('builds connected profile actions and delegates menu callbacks', async () => {
    const connect = vi.fn()
    const disconnect = vi.fn()
    const quit = vi.fn()
    const window = { show: vi.fn(), focus: vi.fn(), hide: vi.fn(), isVisible: vi.fn() }
    const service = new TrayService({
      getWindow: () => window as never,
      getProfiles: async () => [profile('one', 'Office'), profile('two', 'Backup')],
      getStatus: () => ({
        status: 'connected',
        profileId: 'two',
        connectedAt: '2026-10-08T10:01:00.000Z',
      }),
      connect: async (id) => connect(id),
      disconnect: async () => disconnect(),
      quit,
    })

    await service.start()

    const tray = electron.trayInstances[0]
    const template = tray.setContextMenu.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(template.map((item) => item.label).filter(Boolean)).toEqual([
      'Connected: Backup',
      'Open OpenSwitch',
      'Open logs',
      'Office',
      'Backup',
      'Disconnect Backup',
      'Quit OpenSwitch',
    ])
    expect(template.find((item) => item.label === 'Backup')?.checked).toBe(true)
    expect(template.find((item) => item.label === 'Office')?.checked).toBe(false)

    ;(template.find((item) => item.label === 'Office')?.click as () => void)()
    ;(template.find((item) => item.label === 'Disconnect Backup')?.click as () => void)()
    ;(template.find((item) => item.label === 'Quit OpenSwitch')?.click as () => void)()
    ;(template.find((item) => item.label === 'Open OpenSwitch')?.click as () => void)()

    expect(connect).toHaveBeenCalledWith('one')
    expect(disconnect).toHaveBeenCalledOnce()
    expect(quit).toHaveBeenCalledOnce()
    expect(window.show).toHaveBeenCalledOnce()
    expect(window.focus).toHaveBeenCalledOnce()
    expect(tray.setToolTip).toHaveBeenLastCalledWith('OpenSwitch - Connected: Backup')
  })

  it('provides a safe empty menu when profiles cannot be loaded', async () => {
    const service = new TrayService({
      getWindow: () => null,
      getProfiles: async () => Promise.reject(new Error('store unavailable')),
      getStatus: () => ({ status: 'disconnected', profileId: null }),
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      quit: vi.fn(),
    })

    await service.start()

    const template = electron.trayInstances[0].setContextMenu.mock.calls[0][0] as Array<
      Record<string, unknown>
    >
    expect(template.find((item) => item.label === 'No profiles imported')?.enabled).toBe(false)
    expect(template.find((item) => item.label === 'Disconnect')?.enabled).toBe(false)
  })

  it('toggles window visibility from the tray click and destroys idempotently', async () => {
    const window = { show: vi.fn(), focus: vi.fn(), hide: vi.fn(), isVisible: vi.fn() }
    const service = new TrayService({
      getWindow: () => window as never,
      getProfiles: async () => [],
      getStatus: () => ({ status: 'disconnected', profileId: null }),
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      quit: vi.fn(),
    })
    await service.start()
    const tray = electron.trayInstances[0]
    const click = tray.on.mock.calls.find(([event]) => event === 'click')?.[1] as () => void

    window.isVisible.mockReturnValueOnce(true).mockReturnValueOnce(false)
    click()
    click()
    expect(window.hide).toHaveBeenCalledOnce()
    expect(window.show).toHaveBeenCalledOnce()
    expect(window.focus).toHaveBeenCalledOnce()

    service.destroy()
    service.destroy()
    expect(tray.destroy).toHaveBeenCalledOnce()
  })
})
