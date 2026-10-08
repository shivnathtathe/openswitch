import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ProfileStatus } from '../../../src/renderer/components/profiles/ProfileStatus'

describe('ProfileStatus', () => {
  it.each([
    ['connected', 'Connected', 'positive'],
    ['connecting', 'Connecting', 'progress'],
    ['disconnecting', 'Disconnecting', 'progress'],
    ['disconnected', 'Disconnected', 'neutral'],
    ['error', 'Needs attention', 'negative'],
  ] as const)('renders %s with its label and visual tone', (status, label, tone) => {
    const markup = renderToStaticMarkup(<ProfileStatus status={status} />)

    expect(markup).toContain(label)
    expect(markup).toContain(`status-mark--${tone}`)
  })

  it('keeps an error message in a collapsed technical-details disclosure', () => {
    const markup = renderToStaticMarkup(
      <ProfileStatus status="error" message="Authentication failed" />,
    )

    expect(markup).toContain('Needs attention')
    expect(markup).toContain('<summary>Technical details</summary>')
    expect(markup).toContain('Authentication failed')
    expect(markup).not.toContain('<details open=""')
  })
})
