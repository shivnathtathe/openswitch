import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const settingsHook = vi.hoisted(() => ({
  useSettings: vi.fn(() => ({
    settings: {
      theme: 'system' as const,
      launchAtLogin: false,
      closeToTray: true,
      diagnosticLogging: false,
    },
    isLoading: false,
    isSaving: false,
    error: null,
    updateSettings: vi.fn(),
    clearError: vi.fn(),
  })),
}))

vi.mock('../../../src/renderer/hooks/useSettings', () => settingsHook)

import { SettingsDialog } from '../../../src/renderer/components/settings/SettingsDialog'

describe('SettingsDialog appearance controls', () => {
  it('renders the complete theme choice as one accessible radio group', () => {
    const markup = renderToStaticMarkup(<SettingsDialog open onClose={vi.fn()} />)
    const document = new DOMParser().parseFromString(markup, 'text/html')
    const fieldset = document.querySelector('fieldset.settings-theme')
    const radios = [...(fieldset?.querySelectorAll('input[type="radio"]') ?? [])]

    expect(fieldset?.querySelector('legend')?.textContent).toBe('Appearance')
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual(['system', 'light', 'dark'])
    expect(radios.map((radio) => radio.parentElement?.textContent?.trim())).toEqual([
      'System',
      'Light',
      'Dark',
    ])
    expect(
      radios
        .filter((radio) => radio.hasAttribute('checked'))
        .map((radio) => radio.getAttribute('value')),
    ).toEqual(['system'])
    expect(new Set(radios.map((radio) => radio.getAttribute('name'))).size).toBe(1)
  })
})
