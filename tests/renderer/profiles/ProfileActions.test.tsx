import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ProfileActions } from '../../../src/renderer/components/profiles/ProfileActions'
import type { ProfileConnectionStatus } from '../../../src/renderer/components/profiles/types'

function renderActions(status: ProfileConnectionStatus, disabled = false): string {
  return renderToStaticMarkup(
    <ProfileActions
      profileName="Office VPN"
      status={status}
      onConnect={vi.fn()}
      onDisconnect={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      disabled={disabled}
    />,
  )
}

describe('ProfileActions', () => {
  it.each([
    ['disconnected', 'Connect Office VPN', 'Connect'],
    ['error', 'Connect Office VPN', 'Connect'],
    ['connected', 'Disconnect Office VPN', 'Disconnect'],
  ] as const)('offers the appropriate primary action while %s', (status, ariaLabel, label) => {
    const markup = renderActions(status)

    expect(markup).toContain(`aria-label="${ariaLabel}"`)
    expect(markup).toContain(`>${label}</span>`)
    expect(markup).not.toContain('aria-busy="true"')
  })

  it.each([
    ['connecting', 'Connect Office VPN', 'Connecting...'],
    ['disconnecting', 'Disconnect Office VPN', 'Disconnecting...'],
  ] as const)(
    'locks every action and exposes progress while %s',
    (status, ariaLabel, busyLabel) => {
      const markup = renderActions(status)

      expect(markup).toContain(`aria-label="${ariaLabel}"`)
      expect(markup).toContain('aria-busy="true"')
      expect(markup).toContain(busyLabel)
      expect(markup.match(/ disabled=""/g)).toHaveLength(3)
    },
  )

  it('locks every action when its parent operation is disabled', () => {
    const markup = renderActions('connected', true)

    expect(markup.match(/ disabled=""/g)).toHaveLength(3)
    expect(markup).not.toContain('aria-busy="true"')
  })
})
