import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { classNames } from './classNames'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  busy?: boolean
  busyLabel?: string
  leadingIcon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    busy = false,
    busyLabel = 'Working...',
    leadingIcon,
    className,
    disabled,
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={classNames('button', `button--${variant}`, className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      {leadingIcon ? (
        <span className="button__icon" aria-hidden="true">
          {leadingIcon}
        </span>
      ) : null}
      <span className="button__label">{busy ? busyLabel : children}</span>
    </button>
  )
})
