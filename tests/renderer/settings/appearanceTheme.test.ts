import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('applyAppearanceTheme', () => {
  let systemIsDark = false
  let systemChange: (() => void) | undefined

  beforeEach(() => {
    vi.resetModules()
    systemIsDark = false
    systemChange = undefined
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        get matches() {
          return systemIsDark
        },
        addEventListener: vi.fn((_event: string, listener: () => void) => {
          systemChange = listener
        }),
        removeEventListener: vi.fn(),
      })),
    )
    delete document.documentElement.dataset.theme
    document.documentElement.style.removeProperty('color-scheme')
  })

  afterEach(() => vi.unstubAllGlobals())

  it.each(['light', 'dark'] as const)('applies an explicit %s theme', async (theme) => {
    const { applyAppearanceTheme } = await import('../../../src/renderer/hooks/useSettings')

    applyAppearanceTheme(theme)

    expect(document.documentElement.dataset.theme).toBe(theme)
    expect(document.documentElement.style.colorScheme).toBe(theme)
  })

  it('resolves system preference and follows later system changes', async () => {
    const { applyAppearanceTheme } = await import('../../../src/renderer/hooks/useSettings')

    applyAppearanceTheme('system')
    expect(document.documentElement.dataset.theme).toBe('light')

    systemIsDark = true
    systemChange?.()

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('does not overwrite an explicit theme after a system change', async () => {
    const { applyAppearanceTheme } = await import('../../../src/renderer/hooks/useSettings')

    applyAppearanceTheme('light')
    systemIsDark = true
    systemChange?.()

    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
