import { classNames } from './classNames'

export type StatusTone = 'neutral' | 'positive' | 'warning' | 'negative' | 'progress'

export interface StatusMarkProps {
  label: string
  tone?: StatusTone
  className?: string
}

export function StatusMark({ label, tone = 'neutral', className }: StatusMarkProps) {
  return (
    <span className={classNames('status-mark', `status-mark--${tone}`, className)}>
      <span className="status-mark__dot" aria-hidden="true" />
      <span className="status-mark__label">{label}</span>
    </span>
  )
}
