import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { ConfigFileSelection } from '../../../shared'
import { PathField, TextField } from '../ui'
import type { ProfileEditorInitialValue, ProfileEditorValue } from './types'

interface ValidationErrors {
  name?: string
  configFile?: string
  username?: string
  password?: string
}

export interface ProfileEditorProps {
  initialValue?: ProfileEditorInitialValue
  onSelectConfigFile: () => Promise<ConfigFileSelection | null>
  onSubmit: (value: ProfileEditorValue) => void | Promise<void>
  disabled?: boolean
  formId?: string
}

export function ProfileEditor({
  initialValue,
  onSelectConfigFile,
  onSubmit,
  disabled = false,
  formId,
}: ProfileEditorProps) {
  const generatedFormId = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const configButtonRef = useRef<HTMLButtonElement>(null)
  const usernameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(initialValue?.name ?? '')
  const [selection, setSelection] = useState<ConfigFileSelection | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [clearCredentials, setClearCredentials] = useState(false)
  const [browsing, setBrowsing] = useState(false)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const id = formId ?? generatedFormId
  const completeCredentialsSaved = Boolean(
    initialValue?.credentials.usernameConfigured && initialValue?.credentials.passwordConfigured,
  )
  const anyCredentialsSaved = Boolean(
    initialValue?.credentials.usernameConfigured || initialValue?.credentials.passwordConfigured,
  )
  const configFilePath = selection?.path ?? initialValue?.configFilePath ?? ''
  const configFileName = selection?.fileName ?? initialValue?.configFileName

  useEffect(() => {
    setName(initialValue?.name ?? '')
    setSelection(null)
    setUsername('')
    setPassword('')
    setClearCredentials(false)
    setErrors({})
  }, [initialValue])

  async function browseForConfig() {
    setBrowsing(true)
    try {
      const nextSelection = await onSelectConfigFile()
      if (nextSelection) {
        setSelection(nextSelection)
        setErrors((current) => ({ ...current, configFile: undefined }))
      }
    } catch {
      setErrors((current) => ({ ...current, configFile: 'The file picker could not be opened.' }))
    } finally {
      setBrowsing(false)
    }
  }

  function validate(): ValidationErrors {
    const nextErrors: ValidationErrors = {}
    if (!name.trim()) nextErrors.name = 'Enter a profile name.'
    if (!configFilePath) nextErrors.configFile = 'Choose an OpenVPN configuration file.'
    if (configFileName && !configFileName.toLowerCase().endsWith('.ovpn')) {
      nextErrors.configFile = 'The configuration file must use the .ovpn extension.'
    }
    if (password && !username.trim()) nextErrors.username = 'Enter the username for this password.'
    if (username.trim() && !password) nextErrors.password = 'Enter the password for this username.'
    return nextErrors
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      const firstInvalid = nextErrors.name
        ? nameRef
        : nextErrors.configFile
          ? configButtonRef
          : nextErrors.username
            ? usernameRef
            : passwordRef
      firstInvalid.current?.focus()
      return
    }

    const hasNewCredentials = Boolean(username.trim() && password)
    void onSubmit({
      name: name.trim(),
      configFilePath,
      credentials: hasNewCredentials ? { username: username.trim(), password } : undefined,
      credentialChange: clearCredentials ? 'clear' : hasNewCredentials ? 'set' : 'keep',
    })
  }

  return (
    <form className="profile-editor" id={id} onSubmit={handleSubmit} noValidate>
      <TextField
        ref={nameRef}
        label="Profile name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={errors.name}
        disabled={disabled}
        required
        autoComplete="off"
      />
      <PathField
        label="OpenVPN configuration"
        value={configFilePath}
        fileName={configFileName}
        onBrowse={() => void browseForConfig()}
        error={errors.configFile}
        disabled={disabled}
        browsing={browsing}
        required
        buttonRef={configButtonRef}
      />
      <fieldset className="profile-editor__credentials" disabled={disabled}>
        <legend>Credentials</legend>
        {completeCredentialsSaved ? (
          <p className="profile-editor__credential-status" role="status">
            Credentials are saved. Leave both fields blank to keep them, or enter both to replace
            them.
          </p>
        ) : anyCredentialsSaved ? (
          <p className="profile-editor__credential-hint" role="status">
            The saved credentials are incomplete. Enter both fields to replace them, or remove the
            saved values.
          </p>
        ) : (
          <p className="profile-editor__credential-hint">
            Leave both fields blank if this profile does not require credentials.
          </p>
        )}
        <TextField
          ref={usernameRef}
          label={anyCredentialsSaved ? 'New username' : 'Username'}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          error={errors.username}
          autoComplete="username"
          spellCheck={false}
          disabled={clearCredentials}
        />
        <TextField
          ref={passwordRef}
          label={anyCredentialsSaved ? 'New password' : 'Password'}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          autoComplete="new-password"
          disabled={clearCredentials}
        />
        {anyCredentialsSaved ? (
          <label className="profile-editor__clear-credentials">
            <input
              type="checkbox"
              checked={clearCredentials}
              onChange={(event) => {
                setClearCredentials(event.target.checked)
                if (event.target.checked) {
                  setUsername('')
                  setPassword('')
                }
              }}
            />
            Remove saved credentials
          </label>
        ) : null}
      </fieldset>
    </form>
  )
}
