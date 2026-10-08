import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DEFAULT_APP_SETTINGS } from '../shared'
import { App } from './App'
import { applyAppearanceTheme } from './hooks/useSettings'
import { getOpenSwitchApi } from './utils/openSwitch'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/jetbrains-mono'
import './styles/index.css'
import './components/settings/theme.css'

const root = document.getElementById('root')

if (!root) throw new Error('OpenSwitch could not find its application root.')

async function render(rootElement: HTMLElement) {
  try {
    const result = await getOpenSwitchApi().settings.get()
    applyAppearanceTheme(result.ok ? result.value.theme : DEFAULT_APP_SETTINGS.theme)
  } catch {
    applyAppearanceTheme(DEFAULT_APP_SETTINGS.theme)
  }

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void render(root)
