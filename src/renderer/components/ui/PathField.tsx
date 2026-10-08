import { useId, type Ref } from 'react'
import { Button } from './Button'

export interface PathSelection {
  path: string
  fileName: string
}

export interface PathFieldProps {
  label: string
  value: string
  fileName?: string
  onBrowse: () => void
  error?: string
  disabled?: boolean
  browsing?: boolean
  required?: boolean
  buttonRef?: Ref<HTMLButtonElement>
}

export function PathField({
  label,
  value,
  fileName,
  onBrowse,
  error,
  disabled,
  browsing = false,
  required,
  buttonRef,
}: PathFieldProps) {
  const id = useId()
  const labelId = `${id}-label`
  const errorId = error ? `${id}-error` : undefined
  const selectedName = fileName || value || 'No file selected'

  return (
    <div
      className={error ? 'path-field path-field--invalid' : 'path-field'}
      role="group"
      aria-labelledby={labelId}
      aria-invalid={error ? true : undefined}
      aria-describedby={errorId}
    >
      <div className="field__label" id={labelId}>
        {label}
        {required ? (
          <span className="field__required" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </div>
      <div className="path-field__control">
        <span className="path-field__value" title={selectedName}>
          {selectedName}
        </span>
        <Button
          ref={buttonRef}
          disabled={disabled}
          busy={browsing}
          busyLabel="Choosing..."
          onClick={onBrowse}
          aria-describedby={errorId}
        >
          {value ? 'Choose another file' : 'Choose .ovpn file'}
        </Button>
      </div>
      {error ? (
        <div className="field__error" id={errorId} role="alert">
          {error}
        </div>
      ) : null}
    </div>
  )
}
