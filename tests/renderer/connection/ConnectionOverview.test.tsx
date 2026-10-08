import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ConnectionOverview } from '../../../src/renderer/components/connection/ConnectionOverview'

describe('ConnectionOverview error rendering', () => {
  it('shows friendly error copy and keeps technical detail collapsed', () => {
    const markup = renderToStaticMarkup(
      <ConnectionOverview
        status="error"
        statusLabel="Connection error"
        error="The VPN process stopped unexpectedly. Please try again."
        technicalDetails="VPN_PROCESS_FAILED: TLS certificate expired"
        onDismissError={vi.fn()}
      />,
    )

    expect(markup).toContain('role="alert"')
    expect(markup).toContain('The VPN process stopped unexpectedly. Please try again.')
    expect(markup).toContain('<summary>Technical details</summary>')
    expect(markup).toContain('VPN_PROCESS_FAILED: TLS certificate expired')
    expect(markup).not.toContain('<details open=""')
    expect(markup).toContain('>Dismiss</button>')
  })

  it('does not render technical or dismiss controls when they are unavailable', () => {
    const markup = renderToStaticMarkup(
      <ConnectionOverview
        status="error"
        statusLabel="Connection error"
        error="Connection could not be established."
      />,
    )

    expect(markup).not.toContain('Technical details')
    expect(markup).not.toContain('>Dismiss</button>')
  })

  it('does not render the error panel from technical detail alone', () => {
    const markup = renderToStaticMarkup(
      <ConnectionOverview
        status="disconnected"
        statusLabel="Disconnected"
        technicalDetails="stale detail"
      />,
    )

    expect(markup).not.toContain('role="alert"')
    expect(markup).not.toContain('stale detail')
  })
})
