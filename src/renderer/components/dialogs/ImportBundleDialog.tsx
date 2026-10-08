import { useEffect, useId, useRef, useState } from 'react'
import type { BundleImportPreview } from '../../../shared'
import { Button, Dialog } from '../ui'

export interface ImportBundleDialogProps {
  preview: BundleImportPreview | null
  onClose: () => void
  onImport: (profileKeys: readonly string[]) => void | Promise<void>
  importing?: boolean
}

export function ImportBundleDialog({
  preview,
  onClose,
  onImport,
  importing = false,
}: ImportBundleDialogProps) {
  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(new Set())
  const selectAllRef = useRef<HTMLInputElement>(null)
  const groupId = useId()
  const profileCount = preview?.profiles.length ?? 0
  const allSelected = profileCount > 0 && selectedKeys.size === profileCount

  useEffect(() => {
    setSelectedKeys(new Set(preview?.profiles.map((profile) => profile.key) ?? []))
  }, [preview])

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedKeys.size > 0 && !allSelected
    }
  }, [allSelected, selectedKeys.size])

  function toggleProfile(profileKey: string) {
    setSelectedKeys((current) => {
      const next = new Set(current)
      if (next.has(profileKey)) next.delete(profileKey)
      else next.add(profileKey)
      return next
    })
  }

  return (
    <Dialog
      open={preview !== null}
      title="Import profile bundle"
      description={
        preview ? (
          <>
            Choose profiles from <strong>{preview.fileName}</strong>. Passwords are not included in
            the import.
          </>
        ) : undefined
      }
      onClose={onClose}
      closeDisabled={importing}
      className="bundle-dialog"
      footer={
        <>
          <Button onClick={onClose} disabled={importing}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void onImport([...selectedKeys])}
            disabled={selectedKeys.size === 0}
            busy={importing}
            busyLabel="Importing..."
          >
            Import selected
          </Button>
        </>
      }
    >
      {preview ? (
        <div className="bundle-picker">
          <div className="bundle-picker__toolbar">
            <label className="bundle-select-all">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allSelected}
                onChange={() =>
                  setSelectedKeys(
                    allSelected ? new Set() : new Set(preview.profiles.map(({ key }) => key)),
                  )
                }
                disabled={importing}
              />
              <span>Select all</span>
            </label>
            <output className="bundle-picker__count" aria-live="polite">
              {selectedKeys.size} of {profileCount} selected
            </output>
          </div>
          <fieldset className="bundle-profile-list" aria-labelledby={groupId} disabled={importing}>
            <legend className="visually-hidden" id={groupId}>
              Profiles to import
            </legend>
            {preview.profiles.map((profile) => (
              <label className="bundle-profile" key={profile.key}>
                <input
                  type="checkbox"
                  checked={selectedKeys.has(profile.key)}
                  onChange={() => toggleProfile(profile.key)}
                />
                <span className="bundle-profile__content">
                  <strong>{profile.name}</strong>
                  <span>
                    {profile.username ? `Username: ${profile.username}` : 'No username included'}
                    {' · '}
                    {profile.includedFileCount} {profile.includedFileCount === 1 ? 'file' : 'files'}{' '}
                    included
                  </span>
                  {profile.containsPrivateKey ? (
                    <span className="bundle-profile__warning">
                      Contains private key material. Import only from a source you trust.
                    </span>
                  ) : null}
                </span>
              </label>
            ))}
          </fieldset>
        </div>
      ) : null}
    </Dialog>
  )
}
