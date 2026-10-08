import { BrowserWindow, session, type Event } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export interface AppWindowOptions {
  onCloseToTray: () => void
  shouldCloseToTray: () => boolean
}

let cspInstalled = false

function installContentSecurityPolicy(devServerUrl?: string): void {
  if (cspInstalled) return
  cspInstalled = true

  const devOrigin = devServerUrl ? new URL(devServerUrl).origin : undefined
  const connectSources = [
    "'self'",
    ...(devOrigin ? [devOrigin, devOrigin.replace(/^http/, 'ws')] : []),
  ]
  const scriptSources = ["'self'", ...(devOrigin ? ["'unsafe-eval'", devOrigin] : [])]
  const policy = [
    `default-src 'self'`,
    `script-src ${scriptSources.join(' ')}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `connect-src ${connectSources.join(' ')}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'none'`,
    `frame-src 'none'`,
    `worker-src 'none'`,
    `frame-ancestors 'none'`,
  ].join('; ')

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy],
      },
    })
  })
}

export async function createAppWindow(options: AppWindowOptions): Promise<BrowserWindow> {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL
  const rendererPath = path.join(__dirname, '../renderer/index.html')
  const rendererUrl = pathToFileURL(rendererPath).href
  installContentSecurityPolicy(devServerUrl)

  const window = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 760,
    minHeight: 520,
    show: false,
    title: 'OpenSwitch',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  })
  window.setMenu(null)
  window.setMenuBarVisibility(false)

  window.on('close', (event: Event) => {
    if (!options.shouldCloseToTray()) return
    event.preventDefault()
    window.hide()
    options.onCloseToTray()
  })

  window.once('ready-to-show', () => window.show())
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    const target = new URL(url)
    const isAllowed = devServerUrl
      ? target.origin === new URL(devServerUrl).origin
      : target.href === rendererUrl
    if (!isAllowed) event.preventDefault()
  })

  if (devServerUrl) {
    await window.loadURL(devServerUrl)
  } else {
    await window.loadFile(rendererPath)
  }

  return window
}
