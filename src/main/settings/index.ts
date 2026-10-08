import ElectronStore from 'electron-store'

import {
  DEFAULT_APP_SETTINGS,
  type AppearanceTheme,
  type AppSettings,
  type UpdateAppSettingsInput,
} from '../../shared/contracts'

const settingKeys = ['theme', 'launchAtLogin', 'closeToTray', 'diagnosticLogging'] as const
const themes: readonly AppearanceTheme[] = ['system', 'light', 'dark']

const settingsSchema: ElectronStore.Schema<AppSettings> = {
  theme: { type: 'string', enum: [...themes], default: DEFAULT_APP_SETTINGS.theme },
  launchAtLogin: { type: 'boolean', default: DEFAULT_APP_SETTINGS.launchAtLogin },
  closeToTray: { type: 'boolean', default: DEFAULT_APP_SETTINGS.closeToTray },
  diagnosticLogging: { type: 'boolean', default: DEFAULT_APP_SETTINGS.diagnosticLogging },
}

export class SettingsStore {
  private readonly store: ElectronStore<AppSettings>

  constructor() {
    this.store = new ElectronStore<AppSettings>({
      name: 'settings',
      schema: settingsSchema,
      defaults: DEFAULT_APP_SETTINGS,
    })
  }

  get(): AppSettings {
    return {
      theme: this.store.get('theme'),
      launchAtLogin: this.store.get('launchAtLogin'),
      closeToTray: this.store.get('closeToTray'),
      diagnosticLogging: this.store.get('diagnosticLogging'),
    }
  }

  update(input: UpdateAppSettingsInput): AppSettings {
    validateUpdate(input)
    const next = { ...this.get(), ...input }
    this.store.store = next
    return { ...next }
  }
}

function validateUpdate(value: unknown): asserts value is UpdateAppSettingsInput {
  if (!isRecord(value)) throw new TypeError('Settings update must be an object.')

  const keys = Object.keys(value)
  if (keys.length === 0) throw new TypeError('At least one setting is required.')
  if (keys.some((key) => !settingKeys.includes(key as (typeof settingKeys)[number]))) {
    throw new TypeError('Settings update contains an unknown setting.')
  }
  if (value.theme !== undefined && !isAppearanceTheme(value.theme)) {
    throw new TypeError('Theme must be system, light, or dark.')
  }
  if (keys.some((key) => key !== 'theme' && typeof value[key] !== 'boolean')) {
    throw new TypeError('Behavior settings must be boolean.')
  }
}

function isAppearanceTheme(value: unknown): value is AppearanceTheme {
  return typeof value === 'string' && themes.includes(value as AppearanceTheme)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
