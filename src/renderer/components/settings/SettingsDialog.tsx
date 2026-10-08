import { useEffect, useId, useRef, useState, type FormEvent } from 'react'

import type { AppearanceTheme, AppSettings, UpdateAppSettingsInput } from '../../../shared'
import { useSettings } from '../../hooks/useSettings'
import { Button, Dialog } from '../ui'
import './settings.css'

export interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

type BooleanSettingKey = 'launchAtLogin' | 'closeToTray' | 'diagnosticLogging'

const options: readonly {
  key: BooleanSettingKey
  label: string
  description: string
}[] = [
  {
    key: 'launchAtLogin',
    label: 'Launch at login',
    description: 'Start OpenSwitch after you sign in to your computer.',
  },
  {
    key: 'closeToTray',
    label: 'Keep running in the tray',
    description: 'Closing the window keeps VPN connections and tray controls available.',
  },
  {
    key: 'diagnosticLogging',
    label: 'Diagnostic logging',
    description: 'Write local OpenVPN diagnostic logs to help investigate connection problems.',
  },
]

const themeOptions: readonly { value: AppearanceTheme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { settings, isLoading, isSaving, error, updateSettings, clearError } = useSettings(open)
  const [draft, setDraft] = useState<AppSettings>(settings)
  const firstInputRef = useRef<HTMLInputElement>(null)
  const idPrefix = useId()
  const formId = `${idPrefix}-form`

  useEffect(() => {
    if (open) setDraft(settings)
  }, [open, settings])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const changedEntries: [keyof AppSettings, AppSettings[keyof AppSettings]][] = options
      .filter(({ key }) => draft[key] !== settings[key])
      .map(({ key }) => [key, draft[key]])
    if (draft.theme !== settings.theme) changedEntries.push(['theme', draft.theme])

    if (changedEntries.length === 0) {
      onClose()
      return
    }

    const saved = await updateSettings(Object.fromEntries(changedEntries) as UpdateAppSettingsInput)
    if (saved) onClose()
  }

  function handleClose() {
    if (isSaving) return
    clearError()
    setDraft(settings)
    onClose()
  }

  return (
    <Dialog
      open={open}
      title="Settings"
      description="Control how OpenSwitch looks and behaves on this device."
      onClose={handleClose}
      initialFocusRef={firstInputRef}
      className="settings-dialog"
      footer={
        <>
          <Button onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            busy={isSaving}
            busyLabel="Saving..."
            disabled={isLoading}
          >
            Save settings
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={(event) => void handleSubmit(event)}>
        <fieldset
          className="settings-theme"
          disabled={isLoading || isSaving}
          aria-describedby={`${idPrefix}-theme-description`}
        >
          <legend className="settings-theme__label">Appearance</legend>
          <p className="settings-theme__description" id={`${idPrefix}-theme-description`}>
            Use your system appearance or keep OpenSwitch in one theme.
          </p>
          <div className="settings-theme__control">
            {themeOptions.map((option, index) => (
              <label className="settings-theme__option" key={option.value}>
                <input
                  ref={index === 0 ? firstInputRef : undefined}
                  type="radio"
                  name={`${idPrefix}-theme`}
                  value={option.value}
                  checked={draft.theme === option.value}
                  onChange={() => setDraft((current) => ({ ...current, theme: option.value }))}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="settings-list" disabled={isLoading || isSaving} aria-busy={isLoading}>
          <legend className="visually-hidden">Application behavior</legend>
          {options.map((option) => {
            const descriptionId = `${idPrefix}-${option.key}-description`
            return (
              <label className="settings-option" key={option.key}>
                <span className="settings-option__copy">
                  <span className="settings-option__label">{option.label}</span>
                  <span className="settings-option__description" id={descriptionId}>
                    {option.description}
                  </span>
                </span>
                <input
                  className="settings-option__input"
                  type="checkbox"
                  checked={draft[option.key]}
                  aria-describedby={descriptionId}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [option.key]: event.target.checked }))
                  }
                />
              </label>
            )
          })}
        </fieldset>
        {isLoading ? (
          <p className="settings-dialog__status" role="status">
            Loading settings...
          </p>
        ) : null}
        {error ? (
          <p className="settings-dialog__error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  )
}
