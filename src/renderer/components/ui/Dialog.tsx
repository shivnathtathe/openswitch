import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { classNames } from './classNames'

export interface DialogProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  description?: ReactNode
  className?: string
  initialFocusRef?: RefObject<HTMLElement | null>
  closeDisabled?: boolean
}

export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  description,
  className,
  initialFocusRef,
  closeDisabled = false,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const programmaticCloseRef = useRef(false)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    let focusFrame: number | undefined

    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
      focusFrame = window.requestAnimationFrame(() => {
        const firstFocusable = dialog.querySelector<HTMLElement>(
          'input:not(:disabled), button:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        )
        ;(initialFocusRef?.current ?? firstFocusable)?.focus()
      })
    } else if (!open && dialog.open) {
      programmaticCloseRef.current = true
      if (typeof dialog.close === 'function') dialog.close()
      else {
        dialog.removeAttribute('open')
        programmaticCloseRef.current = false
      }
      returnFocusRef.current?.focus()
    }

    return () => {
      if (focusFrame !== undefined) window.cancelAnimationFrame(focusFrame)
    }
  }, [initialFocusRef, open])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      className={classNames('dialog', className)}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-busy={closeDisabled || undefined}
      onCancel={(event) => {
        event.preventDefault()
        if (!closeDisabled) onClose()
      }}
      onClose={() => {
        if (programmaticCloseRef.current) {
          programmaticCloseRef.current = false
          return
        }
        onClose()
      }}
    >
      <div className="dialog__surface">
        <header className="dialog__header">
          <h2 className="dialog__title" id={titleId}>
            {title}
          </h2>
          {description ? (
            <div className="dialog__description" id={descriptionId}>
              {description}
            </div>
          ) : null}
        </header>
        <div className="dialog__body">{children}</div>
        {footer ? <footer className="dialog__footer">{footer}</footer> : null}
      </div>
    </dialog>
  )
}
