import { Children, useEffect, type ReactNode } from 'react'
import { IconButton } from './IconButton'
import { TechnicalDetails } from './TechnicalDetails'

export type ToastTone = 'info' | 'success' | 'error'

export interface ToastProps {
  children: ReactNode
  tone?: ToastTone
  onDismiss?: () => void
  duration?: number
}

export function Toast({ children, tone = 'info', onDismiss, duration = 5000 }: ToastProps) {
  const content = Children.toArray(children)
  const hasTechnicalDetails = tone === 'error' && content.length > 1

  useEffect(() => {
    if (!onDismiss || duration <= 0) return
    const timeout = window.setTimeout(onDismiss, duration)
    return () => window.clearTimeout(timeout)
  }, [duration, onDismiss])

  return (
    <div className={`toast toast--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <div className="toast__content">
        {hasTechnicalDetails ? (
          <>
            <div className="toast__summary">{content[0]}</div>
            <TechnicalDetails>{content.slice(1)}</TechnicalDetails>
          </>
        ) : (
          children
        )}
      </div>
      {onDismiss ? <IconButton label="Dismiss notification" icon="x" onClick={onDismiss} /> : null}
    </div>
  )
}

export interface ToastRegionProps {
  children: ReactNode
  label?: string
}

export function ToastRegion({ children, label = 'Notifications' }: ToastRegionProps) {
  return (
    <section className="toast-region" aria-label={label}>
      {children}
    </section>
  )
}
