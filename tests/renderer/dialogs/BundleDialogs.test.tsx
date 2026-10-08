import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ExportBundleDialog, ImportBundleDialog } from '../../../src/renderer/components/dialogs'

const profile = {
  id: 'profile-1',
  name: 'Office VPN',
  configFilePath: String.raw`C:\VPN\office.ovpn`,
  configFileName: 'office.ovpn',
  credentials: { usernameConfigured: true, passwordConfigured: true },
  createdAt: '2026-10-08T10:00:00.000Z',
  updatedAt: '2026-10-08T10:00:00.000Z',
}

describe('bundle dialog semantics', () => {
  it('groups export profile checkboxes and explains sensitive bundle contents', () => {
    const markup = renderToStaticMarkup(
      <ExportBundleDialog open profiles={[profile]} onClose={vi.fn()} onExport={vi.fn()} />,
    )
    const document = new DOMParser().parseFromString(markup, 'text/html')
    const dialog = document.querySelector('dialog')
    const fieldset = dialog?.querySelector('fieldset')

    expect(dialog?.getAttribute('aria-labelledby')).toBeTruthy()
    expect(fieldset?.querySelector('legend')?.textContent).toBe('Profiles to export')
    expect(fieldset?.querySelectorAll('input[type="checkbox"]')).toHaveLength(1)
    expect(dialog?.textContent).toContain('Bundles can contain private keys')
    expect(dialog?.textContent).toContain(
      'Usernames are included; saved passwords are never exported',
    )
  })

  it('shows import metadata and an explicit private-key warning per affected profile', () => {
    const markup = renderToStaticMarkup(
      <ImportBundleDialog
        preview={{
          sessionId: 'import-session',
          fileName: 'team.osch',
          profiles: [
            {
              key: 'office',
              name: 'Office VPN',
              username: 'alex',
              includedFileCount: 3,
              containsPrivateKey: true,
            },
          ],
        }}
        onClose={vi.fn()}
        onImport={vi.fn()}
      />,
    )
    const document = new DOMParser().parseFromString(markup, 'text/html')
    const dialog = document.querySelector('dialog')
    const checkbox = dialog?.querySelector('fieldset input[type="checkbox"]')

    expect(dialog?.querySelector('fieldset legend')?.textContent).toBe('Profiles to import')
    expect(checkbox?.parentElement?.textContent).toContain('Username: alex')
    expect(checkbox?.parentElement?.textContent).toContain('3 files included')
    expect(checkbox?.parentElement?.textContent).toContain('Contains private key material')
    expect(dialog?.textContent).toContain('Passwords are not included in the import')
  })
})
