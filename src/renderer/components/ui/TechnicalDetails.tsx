import type { ReactNode } from 'react'

export interface TechnicalDetailsProps {
  children: ReactNode
  summary?: string
  className?: string
}

export function TechnicalDetails({
  children,
  summary = 'Technical details',
  className,
}: TechnicalDetailsProps) {
  return (
    <details className={className ? `technical-details ${className}` : 'technical-details'}>
      <summary>{summary}</summary>
      <div className="technical-details__content">{children}</div>
    </details>
  )
}
