import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { classNames } from './classNames'

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string
  error?: string
  hint?: ReactNode
  hideLabel?: boolean
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, hideLabel = false, className, id: suppliedId, required, ...props },
  ref,
) {
  const generatedId = useId()
  const id = suppliedId ?? generatedId
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined

  return (
    <div className={classNames('field', error && 'field--invalid')}>
      <label className={classNames('field__label', hideLabel && 'visually-hidden')} htmlFor={id}>
        {label}
        {required ? (
          <span className="field__required" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      <input
        {...props}
        ref={ref}
        id={id}
        required={required}
        className={classNames('field__input', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
      />
      {hint ? (
        <div className="field__hint" id={hintId}>
          {hint}
        </div>
      ) : null}
      {error ? (
        <div className="field__error" id={errorId} role="alert">
          {error}
        </div>
      ) : null}
    </div>
  )
})
