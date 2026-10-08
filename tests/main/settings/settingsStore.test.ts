import { beforeEach, describe, expect, it, vi } from 'vitest'

const electronStore = vi.hoisted(() => {
  const instances: MockStore[] = []

  class MockStore {
    store: Record<string, boolean | string>
    readonly options: Record<string, unknown>

    constructor(options: { defaults: Record<string, boolean | string> }) {
      this.options = options
      this.store = { ...options.defaults }
      instances.push(this)
    }

    get(key: string): boolean | string {
      return this.store[key]
    }
  }

  return { MockStore, instances }
})

vi.mock('electron-store', () => ({ default: electronStore.MockStore }))

import { SettingsStore } from '../../../src/main/settings'
import { DEFAULT_APP_SETTINGS } from '../../../src/shared/contracts'

describe('SettingsStore', () => {
  beforeEach(() => {
    electronStore.instances.length = 0
    vi.clearAllMocks()
  })

  it('uses the shared defaults in an isolated settings store', () => {
    const settings = new SettingsStore()

    expect(settings.get()).toEqual(DEFAULT_APP_SETTINGS)
    expect(electronStore.instances[0].options).toMatchObject({
      name: 'settings',
      defaults: DEFAULT_APP_SETTINGS,
      schema: {
        theme: { type: 'string', enum: ['system', 'light', 'dark'], default: 'system' },
      },
    })
  })

  it('merges partial updates without mutating the shared defaults', () => {
    const settings = new SettingsStore()

    const updated = settings.update({ launchAtLogin: true, diagnosticLogging: true })

    expect(updated).toEqual({
      theme: 'system',
      launchAtLogin: true,
      closeToTray: true,
      diagnosticLogging: true,
    })
    expect(settings.get()).toEqual(updated)
    expect(DEFAULT_APP_SETTINGS).toEqual({
      theme: 'system',
      launchAtLogin: false,
      closeToTray: true,
      diagnosticLogging: false,
    })
  })

  it.each([
    ['empty input', {}],
    ['non-object input', null],
    ['unknown key', { accent: 'green' }],
    ['invalid theme', { theme: 'sepia' }],
    ['non-string theme', { theme: true }],
    ['non-boolean value', { closeToTray: 'yes' }],
  ])('rejects %s without changing persisted settings', (_label, input) => {
    const settings = new SettingsStore()

    expect(() => settings.update(input as never)).toThrow(TypeError)
    expect(settings.get()).toEqual(DEFAULT_APP_SETTINGS)
  })

  it.each(['system', 'light', 'dark'] as const)('persists the %s theme', (theme) => {
    const settings = new SettingsStore()

    expect(settings.update({ theme })).toEqual({ ...DEFAULT_APP_SETTINGS, theme })
    expect(electronStore.instances[0].store.theme).toBe(theme)
  })

  it('returns snapshots that callers cannot use to mutate stored state', () => {
    const settings = new SettingsStore()
    const snapshot = settings.get() as { closeToTray: boolean }

    snapshot.closeToTray = false

    expect(settings.get().closeToTray).toBe(true)
  })
})
