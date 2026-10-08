import { useEffect, useRef, useState } from 'react'
import type { ConnectionState } from '../../../shared'
import type { ProfileListItem } from '../profiles'
import { Button, Dialog, TextField } from '../ui'

export interface DeleteProfileDialogProps {
  open: boolean
  profile: ProfileListItem | null
  connectionState: ConnectionState
  onClose: () => void
  onConfirm: (profile: ProfileListItem) => void | Promise<void>
  deleting?: boolean
}

export function DeleteProfileDialog({
  open,
  profile,
  connectionState,
  onClose,
  onConfirm,
  deleting = false,
}: DeleteProfileDialogProps) {
  const [confirmation, setConfirmation] = useState('')
  const confirmationRef = useRef<HTMLInputElement>(null)
  const deleteRequestedRef = useRef(false)
  const profileIsActive = Boolean(
    profile &&
    connectionState.profileId === profile.id &&
    (connectionState.status === 'connected' ||
      connectionState.status === 'connecting' ||
      connectionState.status === 'disconnecting'),
  )
  const confirmed = Boolean(profile && confirmation === profile.name)

  useEffect(() => {
    setConfirmation('')
    deleteRequestedRef.current = false
  }, [open, profile])

  function confirmDelete() {
    if (!profile || !confirmed || profileIsActive || deleting || deleteRequestedRef.current) return

    deleteRequestedRef.current = true
    void Promise.resolve(onConfirm(profile)).finally(() => {
      deleteRequestedRef.current = false
    })
  }

  return (
    <Dialog
      open={open && profile !== null}
      title="Delete VPN profile?"
      onClose={onClose}
      closeDisabled={deleting}
      initialFocusRef={profileIsActive ? undefined : confirmationRef}
      footer={
        <>
          <Button onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={confirmDelete}
            disabled={profileIsActive || !confirmed}
            busy={deleting}
            busyLabel="Deleting..."
          >
            Delete profile
          </Button>
        </>
      }
    >
      {profile ? (
        <div className="delete-profile-dialog__message">
          <p>
            Delete{' '}
            <strong className="delete-profile-dialog__name" title={profile.name}>
              {profile.name}
            </strong>
            ? This removes the profile and its saved credentials from this device. This cannot be
            undone.
          </p>
          {profileIsActive ? (
            <p className="delete-profile-dialog__warning" role="alert">
              This profile is active. Disconnect it before deleting it.
            </p>
          ) : (
            <div className="delete-profile-dialog__confirmation">
              <TextField
                ref={confirmationRef}
                label={`Type "${profile.name}" to confirm`}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && confirmed) confirmDelete()
                }}
                disabled={deleting}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}
        </div>
      ) : null}
    </Dialog>
  )
}
