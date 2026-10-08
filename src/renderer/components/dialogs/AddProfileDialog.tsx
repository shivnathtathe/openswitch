import { useId } from 'react'
import type { ConfigFileSelection } from '../../../shared'
import { ProfileEditor, type ProfileEditorValue } from '../profiles'
import { Button, Dialog } from '../ui'

export interface AddProfileDialogProps {
  open: boolean
  onClose: () => void
  onSelectConfigFile: () => Promise<ConfigFileSelection | null>
  onAdd: (value: ProfileEditorValue) => void | Promise<void>
  saving?: boolean
}

export function AddProfileDialog({
  open,
  onClose,
  onSelectConfigFile,
  onAdd,
  saving = false,
}: AddProfileDialogProps) {
  const formId = useId()

  return (
    <Dialog
      open={open}
      title="Add VPN profile"
      description="Choose an OpenVPN configuration and optionally save its credentials."
      onClose={onClose}
      closeDisabled={saving}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" busy={saving} busyLabel="Adding...">
            Add profile
          </Button>
        </>
      }
    >
      <ProfileEditor
        formId={formId}
        onSelectConfigFile={onSelectConfigFile}
        onSubmit={onAdd}
        disabled={saving}
      />
    </Dialog>
  )
}
