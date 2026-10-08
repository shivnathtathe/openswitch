import { useId } from 'react'
import type { ConfigFileSelection } from '../../../shared'
import { ProfileEditor, type ProfileEditorInitialValue, type ProfileEditorValue } from '../profiles'
import { Button, Dialog } from '../ui'

export interface EditProfileDialogProps {
  open: boolean
  profile: ProfileEditorInitialValue | null
  onClose: () => void
  onSelectConfigFile: () => Promise<ConfigFileSelection | null>
  onSave: (value: ProfileEditorValue) => void | Promise<void>
  saving?: boolean
}

export function EditProfileDialog({
  open,
  profile,
  onClose,
  onSelectConfigFile,
  onSave,
  saving = false,
}: EditProfileDialogProps) {
  const formId = useId()

  return (
    <Dialog
      open={open && profile !== null}
      title="Edit VPN profile"
      description="Update the profile details. Saved credentials are never displayed."
      onClose={onClose}
      closeDisabled={saving}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" busy={saving} busyLabel="Saving...">
            Save changes
          </Button>
        </>
      }
    >
      {profile ? (
        <ProfileEditor
          formId={formId}
          initialValue={profile}
          onSelectConfigFile={onSelectConfigFile}
          onSubmit={onSave}
          disabled={saving}
        />
      ) : null}
    </Dialog>
  )
}
