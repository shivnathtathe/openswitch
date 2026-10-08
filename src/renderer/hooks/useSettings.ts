import { useEffect, useState } from 'react'

import {
  DEFAULT_APP_SETTINGS,
  type AppearanceTheme,
  type AppSettings,
  type UpdateAppSettingsInput,
} from '../../shared'
import { getOpenSwitchApi } from '../utils/openSwitch'

const systemDarkTheme = window.matchMedia('(prefers-color-scheme: dark)')
let selectedTheme: AppearanceTheme = DEFAULT_APP_SETTINGS.theme

function renderTheme() {
  const resolvedTheme =
    selectedTheme === 'system' ? (systemDarkTheme.matches ? 'dark' : 'light') : selectedTheme
  document.documentElement.dataset.theme = resolvedTheme
  document.documentElement.style.colorScheme = resolvedTheme
}

systemDarkTheme.addEventListener('change', () => {
  if (selectedTheme === 'system') renderTheme()
})

export function applyAppearanceTheme(theme: AppearanceTheme): void {
  selectedTheme = theme
  renderTheme()
}

export interface UseSettingsResult {
  settings: AppSettings
  isLoading: boolean
  isSaving: boolean
  error: string | null
  loadSettings: () => Promise<AppSettings | null>
  updateSettings: (input: UpdateAppSettingsInput) => Promise<AppSettings | null>
  clearError: () => void
}

export function useSettings(enabled = true): UseSettingsResult {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS)
  const [isLoading, setIsLoading] = useState(enabled)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadSettings(): Promise<AppSettings | null> {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getOpenSwitchApi().settings.get()
      if (!result.ok) {
        setError(result.error.message)
        return null
      }
      applyAppearanceTheme(result.value.theme)
      setSettings(result.value)
      return result.value
    } catch {
      setError('Settings could not be loaded. Please try again.')
      return null
    } finally {
      setIsLoading(false)
    }
  }

  async function updateSettings(input: UpdateAppSettingsInput): Promise<AppSettings | null> {
    setIsSaving(true)
    setError(null)
    try {
      const result = await getOpenSwitchApi().settings.update(input)
      if (!result.ok) {
        setError(result.error.message)
        return null
      }
      applyAppearanceTheme(result.value.theme)
      setSettings(result.value)
      return result.value
    } catch {
      setError('Settings could not be saved. Please try again.')
      return null
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false)
      return
    }
    void loadSettings()
  }, [enabled])

  return {
    settings,
    isLoading,
    isSaving,
    error,
    loadSettings,
    updateSettings,
    clearError: () => setError(null),
  }
}
