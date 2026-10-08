import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { TechnicalDetails } from '../../../src/renderer/components/ui/TechnicalDetails'

describe('TechnicalDetails', () => {
  it('uses native disclosure semantics and starts collapsed', () => {
    const markup = renderToStaticMarkup(
      <TechnicalDetails className="connection-detail">
        <pre>VPN_PROCESS_FAILED: handshake timed out</pre>
      </TechnicalDetails>,
    )
    const document = new DOMParser().parseFromString(markup, 'text/html')
    const details = document.querySelector('details.technical-details.connection-detail')

    expect(details).not.toBeNull()
    expect(details?.hasAttribute('open')).toBe(false)
    expect(details?.querySelector(':scope > summary')?.textContent).toBe('Technical details')
    expect(details?.querySelector('pre')?.textContent).toContain('handshake timed out')
  })

  it('supports a context-specific summary', () => {
    const markup = renderToStaticMarkup(
      <TechnicalDetails summary="Connection log">Diagnostic output</TechnicalDetails>,
    )
    const document = new DOMParser().parseFromString(markup, 'text/html')

    expect(document.querySelector('summary')?.textContent).toBe('Connection log')
  })
})
