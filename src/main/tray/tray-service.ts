import {
  app,
  Menu,
  shell,
  Tray,
  nativeImage,
  type BrowserWindow,
  type MenuItemConstructorOptions,
  type NativeImage,
} from 'electron'
import path from 'node:path'
import type { ConnectionState, VpnProfile } from '../../shared/contracts'

export interface TrayServiceOptions {
  getWindow: () => BrowserWindow | null
  getProfiles: () => Promise<readonly VpnProfile[]>
  getStatus: () => ConnectionState
  connect: (profileId: string) => Promise<unknown>
  disconnect: () => Promise<unknown>
  quit: () => void
}

const fallbackTrayIcon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="8" fill="#2477d4"/><path d="M5 9h8M9 5l4 4-4 4" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
)}`

type TrayIconState = 'connected' | 'connecting' | 'disconnected'

const statusLabels: Record<ConnectionState['status'], string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting',
  connected: 'Connected',
  disconnecting: 'Disconnecting',
  error: 'Connection error',
}

export class TrayService {
  private tray: Tray | null = null

  constructor(private readonly options: TrayServiceOptions) {}

  async start(): Promise<void> {
    if (this.tray) return
    this.tray = new Tray(this.loadIcon('disconnected'))
    this.tray.setToolTip('OpenSwitch')
    this.tray.on('click', () => this.toggleWindow())
    await this.refresh()
  }

  async refresh(): Promise<void> {
    if (!this.tray) return
    const profiles = await this.options.getProfiles().catch(() => [])
    const status = this.options.getStatus()
    const isTransitioning = status.status === 'connecting' || status.status === 'disconnecting'
    const activeProfile = profiles.find((profile) => profile.id === status.profileId)
    const activeProfileName = activeProfile?.name
    const statusLabel = activeProfileName
      ? `${statusLabels[status.status]}: ${activeProfileName}`
      : statusLabels[status.status]
    const profileItems: MenuItemConstructorOptions[] = profiles.length
      ? profiles.map((profile) => ({
          label: profile.name,
          type: 'radio',
          checked: status.profileId === profile.id,
          enabled: !isTransitioning,
          click: () => void this.options.connect(profile.id).catch(this.reportActionError),
        }))
      : [{ label: 'No profiles imported', enabled: false }]

    this.tray.setImage(this.loadIcon(this.iconState(status)))
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: statusLabel, enabled: false },
        { type: 'separator' },
        {
          label: 'Open OpenSwitch',
          click: () => this.showWindow(),
        },
        { label: 'Open logs', click: () => void this.openLogs().catch(this.reportActionError) },
        { type: 'separator' },
        ...profileItems,
        { type: 'separator' },
        {
          label: activeProfileName ? `Disconnect ${activeProfileName}` : 'Disconnect',
          enabled:
            !isTransitioning && status.status !== 'disconnected' && status.profileId !== null,
          click: () => void this.options.disconnect().catch(this.reportActionError),
        },
        { label: 'Quit OpenSwitch', click: this.options.quit },
      ]),
    )
    this.tray.setToolTip(`OpenSwitch - ${statusLabel}`)
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }

  private showWindow(): void {
    const window = this.options.getWindow()
    window?.show()
    window?.focus()
  }

  private toggleWindow(): void {
    const window = this.options.getWindow()
    if (!window) return
    if (window.isVisible()) window.hide()
    else this.showWindow()
  }

  private iconState(status: ConnectionState): TrayIconState {
    if (status.status === 'connected') return 'connected'
    if (status.status === 'connecting' || status.status === 'disconnecting') return 'connecting'
    return 'disconnected'
  }

  private loadIcon(state: TrayIconState): NativeImage {
    // Packaged builds must copy resources/icons to <resources>/icons.
    const iconDirectory = app.isPackaged
      ? path.join(process.resourcesPath, 'icons')
      : path.join(app.getAppPath(), 'resources', 'icons')
    const image = nativeImage.createFromPath(path.join(iconDirectory, `tray-${state}.svg`))
    const resolvedImage = image.isEmpty() ? nativeImage.createFromDataURL(fallbackTrayIcon) : image
    resolvedImage.setTemplateImage(true)
    return resolvedImage
  }

  private async openLogs(): Promise<void> {
    const error = await shell.openPath(app.getPath('logs'))
    if (error) console.error('Failed to open OpenSwitch logs:', error)
  }

  private readonly reportActionError = (error: unknown): void => {
    console.error('OpenSwitch tray action failed:', error)
  }
}
