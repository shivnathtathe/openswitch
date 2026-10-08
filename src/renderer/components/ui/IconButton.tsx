import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { classNames } from './classNames'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  icon: ReactNode
  variant?: 'default' | 'danger'
}

export function IconButton({
  label,
  icon,
  variant = 'default',
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={classNames('icon-button', `icon-button--${variant}`, className)}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  )
}
