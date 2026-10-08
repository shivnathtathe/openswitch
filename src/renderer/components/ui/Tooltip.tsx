import { cloneElement, useId, type ReactElement, type ReactNode } from 'react'

export interface TooltipProps {
  content: ReactNode
  children: ReactElement<{ 'aria-describedby'?: string }>
}

export function Tooltip({ content, children }: TooltipProps) {
  const id = useId()
  const describedBy = [children.props['aria-describedby'], id].filter(Boolean).join(' ')

  return (
    <span className="tooltip">
      {cloneElement(children, { 'aria-describedby': describedBy })}
      <span className="tooltip__content" id={id} role="tooltip">
        {content}
      </span>
    </span>
  )
}
