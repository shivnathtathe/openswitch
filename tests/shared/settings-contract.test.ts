import { describe, expect, it } from 'vitest'

import { DEFAULT_APP_SETTINGS } from '../../src/shared/contracts'
import { IPC_CHANNELS } from '../../src/shared/ipc'

describe('settings contract', () => {
  it('defines stable, immutable defaults for every setting', () => {
    expect(DEFAULT_APP_SETTINGS).toEqual({
      theme: 'system',
      launchAtLogin: false,
      closeToTray: true,
      diagnosticLogging: false,
    })
    expect(Object.isFrozen(DEFAULT_APP_SETTINGS)).toBe(true)
  })

  it('exposes namespaced settings IPC channels', () => {
    expect(IPC_CHANNELS.settings).toEqual({
      get: 'open-switch:settings:get',
      update: 'open-switch:settings:update',
      setTheme: 'open-switch:settings:set-theme',
    })
  })
})
