import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ProfileRow } from '../../../src/renderer/components/profiles/ProfileRow'
import type { ConnectionState, VpnProfile } from '../../../src/shared'

const profile: VpnProfile = {
  id: 'profile-1',
  name: 'Office VPN',
  configFilePath: String.raw`C:\VPN configs\office.ovpn`,
  configFileName: 'office.ovpn',
  credentials: { usernameConfigured: true, passwordConfigured: true },
  createdAt: '2026-10-08T10:00:00.000Z',
  updatedAt: '2026-10-08T10:00:00.000Z',
}

function renderRow(connectionState: ConnectionState, disabled = false): string {
  return renderToStaticMarkup(
    <ProfileRow
      profile={profile}
      connectionState={connectionState}
      onConnect={vi.fn()}
      onDisconnect={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      disabled={disabled}
    />,
  )
}

describe('ProfileRow', () => {
  it('renders profile identity, safe credential status, and accessible actions', () => {
    const markup = renderRow({ status: 'disconnected', profileId: null })

    expect(markup).toContain('Office VPN')
    expect(markup).toContain('office.ovpn')
    expect(markup).toContain('Credentials saved')
    expect(markup).toContain('aria-label="Connect Office VPN"')
    expect(markup).toContain('aria-label="Edit Office VPN"')
    expect(markup).toContain('aria-label="Delete Office VPN"')
    expect(markup).not.toContain('Disconnect Office VPN')
  })

  it('only applies a connection state to its matching profile', () => {
    const otherProfile = renderRow({
      status: 'connected',
      profileId: 'profile-2',
      connectedAt: '2026-10-08T10:01:00.000Z',
    })
    const currentProfile = renderRow({
      status: 'connected',
      profileId: profile.id,
      connectedAt: '2026-10-08T10:01:00.000Z',
    })

    expect(otherProfile).toContain('Disconnected')
    expect(otherProfile).toContain('Connect Office VPN')
    expect(currentProfile).toContain('Connected')
    expect(currentProfile).toContain('Disconnect Office VPN')
  })

  it('shows current profile technical detail without exposing it on other rows', () => {
    const errorState: ConnectionState = {
      status: 'error',
      profileId: profile.id,
      occurredAt: '2026-10-08T10:02:00.000Z',
      error: { code: 'VPN_PROCESS_FAILED', message: 'TLS handshake failed', retryable: true },
    }

    expect(renderRow(errorState)).toContain('Needs attention')
    expect(renderRow(errorState)).toContain('<summary>Technical details</summary>')
    expect(renderRow(errorState)).toContain('TLS handshake failed')
    expect(renderRow({ ...errorState, profileId: 'profile-2' })).not.toContain(
      'TLS handshake failed',
    )
  })

  it('disables every action when the row is disabled', () => {
    const markup = renderRow({ status: 'disconnected', profileId: null }, true)

    expect(markup.match(/ disabled=""/g)).toHaveLength(3)
  })
})
