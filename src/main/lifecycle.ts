import { app, BrowserWindow, Notification } from 'electron'
import { createAppWindow } from './app-window'
import { installAppMenu } from './app-menu'
import type { ConnectionState } from '../shared/contracts'
import { IPC_CHANNELS } from '../shared/ipc'
import { registerIpcHandlers } from './ipc/handlers'
import type { MainServices } from './ipc/types'
import { TrayService } from './tray'
import { BundleService } from './bundles'

export class MainLifecycle {
  private window: BrowserWindow | null = null
  private tray: TrayService | null = null
  private status: ConnectionState = { status: 'disconnected', profileId: null }
  private quitting = false
  private shutdownStarted = false
  private shutdownComplete = false
  private closeNoticeShown = false
  private removeIpcHandlers: (() => void) | null = null
  private removeVpnListener: (() => void) | null = null
  private readonly bundles: BundleService

  constructor(private readonly services: MainServices) {
    this.bundles = new BundleService(services.profiles, () => app.getPath('userData'))
  }

  async start(): Promise<void> {
    if (!app.requestSingleInstanceLock()) {
      app.quit()
      return
    }

    app.on('second-instance', () => this.showWindow())
    app.on('before-quit', (event) => {
      if (this.shutdownComplete) return
      event.preventDefault()
      if (!this.shutdownStarted) void this.shutdown()
    })
    app.on('window-all-closed', () => {
      if (!this.services.settings.get().closeToTray) this.requestQuit()
    })
    app.on('activate', () => {
      if (this.window?.isDestroyed() !== false) void this.createWindow()
      else this.showWindow()
    })

    await app.whenReady()
    this.applyLoginSetting(this.services.settings.get().launchAtLogin)
    installAppMenu()
    this.removeVpnListener =
      this.services.vpn.onStateChanged?.((state) => this.setStatus(state)) ?? null
    this.registerIpc()
    await this.createWindow()
    this.tray = new TrayService({
      getWindow: () => this.window,
      getProfiles: () => this.services.profiles.list(),
      getStatus: () => this.status,
      connect: (profileId) => this.connect(profileId),
      disconnect: () => this.disconnect(),
      quit: () => this.requestQuit(),
    })
    await this.tray.start()
    await this.refreshMenus()
  }

  private async createWindow(): Promise<void> {
    this.window = await createAppWindow({
      onCloseToTray: () => this.notifyCloseToTray(),
      shouldCloseToTray: () => this.services.settings.get().closeToTray,
    })
    this.window.on('closed', () => {
      this.window = null
    })
  }

  private registerIpc(): void {
    this.removeIpcHandlers = registerIpcHandlers({
      listProfiles: () => this.services.profiles.list(),
      createProfile: async (input) => {
        const profile = await this.services.profiles.create(input)
        await this.refreshMenus()
        return profile
      },
      updateProfile: async (profileId, input) => {
        const profile = await this.services.profiles.update(profileId, input)
        await this.refreshMenus()
        return profile
      },
      removeProfile: async (profileId) => {
        if (this.status.profileId === profileId) await this.disconnect()
        await this.services.profiles.remove(profileId)
        await this.refreshMenus()
      },
      previewBundle: (filePath) => this.bundles.preview(filePath),
      importBundle: async (sessionId, profileKeys) => {
        const imported = await this.bundles.import(sessionId, profileKeys)
        await this.refreshMenus()
        return imported
      },
      discardBundleImport: (sessionId) => this.bundles.discard(sessionId),
      exportBundle: (profileIds, destinationPath) =>
        this.bundles.export(profileIds, destinationPath),
      connect: (profileId) => this.connect(profileId),
      disconnect: () => this.disconnect(),
      getState: () => this.status,
      getSettings: () => this.services.settings.get(),
      updateSettings: (input) => {
        const settings = this.services.settings.update(input)
        this.applyLoginSetting(settings.launchAtLogin)
        return settings
      },
      hide: () => this.window?.hide(),
      quit: () => this.requestQuit(),
    })
  }

  private async connect(profileId: string): Promise<ConnectionState> {
    if (this.status.status === 'connected' && this.status.profileId === profileId)
      return this.status
    if (this.status.status !== 'disconnected') {
      await this.disconnect()
    }

    const profile = await this.services.profiles.get(profileId)
    if (!profile) throw new Error(`Unknown VPN profile: ${profileId}`)
    this.setStatus({ status: 'connecting', profileId, startedAt: new Date().toISOString() })
    try {
      const credentials = await this.services.credentials.get(profileId)
      await this.services.vpn.connect(profile, credentials)
      this.setStatus({ status: 'connected', profileId, connectedAt: new Date().toISOString() })
    } catch (error) {
      this.setStatus({
        status: 'error',
        profileId,
        occurredAt: new Date().toISOString(),
        error: {
          code: 'VPN_PROCESS_FAILED',
          message: error instanceof Error ? error.message : String(error),
          retryable: true,
        },
      })
      throw error
    }
    return this.status
  }

  private async disconnect(): Promise<ConnectionState> {
    if (this.status.status === 'disconnected') return this.status
    const profileId = this.status.profileId
    if (!profileId) {
      this.setStatus({ status: 'disconnected', profileId: null })
      return this.status
    }
    this.setStatus({ status: 'disconnecting', profileId, startedAt: new Date().toISOString() })
    try {
      await this.services.vpn.disconnect()
      this.setStatus({ status: 'disconnected', profileId: null })
    } catch (error) {
      this.setStatus({
        status: 'error',
        profileId,
        occurredAt: new Date().toISOString(),
        error: {
          code: 'VPN_PROCESS_FAILED',
          message: error instanceof Error ? error.message : String(error),
          retryable: true,
        },
      })
      throw error
    }
    return this.status
  }

  private setStatus(status: ConnectionState): void {
    this.status = status
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC_CHANNELS.connection.stateChanged, status)
    }
    void this.refreshMenus()
  }

  private async refreshMenus(): Promise<void> {
    await this.tray?.refresh()
  }

  private notifyCloseToTray(): void {
    if (this.quitting || this.closeNoticeShown || !Notification.isSupported()) return
    this.closeNoticeShown = true
    new Notification({
      title: 'OpenSwitch is still running',
      body: 'Use the tray icon to reopen or quit OpenSwitch.',
    }).show()
  }

  private showWindow(): void {
    this.window?.show()
    this.window?.focus()
  }

  private requestQuit(): void {
    if (this.shutdownStarted) return
    this.quitting = true
    app.quit()
  }

  private applyLoginSetting(openAtLogin: boolean): void {
    app.setLoginItemSettings({ openAtLogin })
  }

  private async shutdown(): Promise<void> {
    this.shutdownStarted = true
    this.quitting = true
    try {
      await this.services.vpn.disconnect()
    } catch (error) {
      console.error('Failed to disconnect OpenVPN during shutdown:', error)
    } finally {
      this.removeIpcHandlers?.()
      this.removeVpnListener?.()
      this.tray?.destroy()
      for (const window of BrowserWindow.getAllWindows()) window.destroy()
      this.shutdownComplete = true
      app.quit()
    }
  }
}
