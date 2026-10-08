import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { AppShell } from '../../../src/renderer/components/app-shell/AppShell'

describe('AppShell semantics', () => {
  it('keeps navigation, connection, and workspace content in named landmarks', () => {
    const markup = renderToStaticMarkup(
      <AppShell
        connection={<p>Disconnected</p>}
        profileCount={2}
        onAddProfile={vi.fn()}
        onOpenSettings={vi.fn()}
      >
        <section aria-label="Profile list">Profiles</section>
      </AppShell>,
    )
    const document = new DOMParser().parseFromString(markup, 'text/html')

    expect(document.querySelector('header.app-header')).not.toBeNull()
    expect(document.querySelector('a[href="#main-content"]')?.getAttribute('aria-label')).toBe(
      'OpenSwitch home',
    )
    expect(
      document.querySelector('aside[aria-label="Connection overview"]')?.textContent,
    ).toContain('Disconnected')
    expect(document.querySelector('main#main-content h1')?.textContent).toBe('VPN profiles')
    expect(
      document.querySelector('main#main-content section[aria-label="Profile list"]'),
    ).not.toBeNull()
    expect(
      [...document.querySelectorAll('button')].every(
        (button) => button.getAttribute('type') === 'button',
      ),
    ).toBe(true)
    expect(
      [...document.querySelectorAll('.workspace__actions button')].map(({ textContent }) =>
        textContent?.trim(),
      ),
    ).toEqual(['Import', 'Export', 'Add profile'])
  })

  it('exposes the profile count as a single accessible detail', () => {
    const markup = renderToStaticMarkup(
      <AppShell connection={null} profileCount={1} onAddProfile={vi.fn()}>
        Profiles
      </AppShell>,
    )
    const document = new DOMParser().parseFromString(markup, 'text/html')

    expect(document.querySelector('[aria-label="1 local profiles"]')?.textContent).toBe('1profile')
  })

  it('disables export when there are no profiles', () => {
    const markup = renderToStaticMarkup(
      <AppShell connection={null} profileCount={0} onAddProfile={vi.fn()}>
        Profiles
      </AppShell>,
    )
    const document = new DOMParser().parseFromString(markup, 'text/html')
    const buttons = [...document.querySelectorAll('.workspace__actions button')]

    expect(
      buttons.find((button) => button.textContent?.trim() === 'Import')?.hasAttribute('disabled'),
    ).toBe(false)
    expect(
      buttons.find((button) => button.textContent?.trim() === 'Export')?.hasAttribute('disabled'),
    ).toBe(true)
  })
})
