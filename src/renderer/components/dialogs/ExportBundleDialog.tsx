import { useEffect, useId, useRef, useState } from 'react'
import type { VpnProfile, VpnProfileId } from '../../../shared'
import { Button, Dialog } from '../ui'

export interface ExportBundleDialogProps {
  open: boolean
  profiles: readonly VpnProfile[]
  onClose: () => void
  onExport: (profileIds: readonly VpnProfileId[]) => void | Promise<void>
  exporting?: boolean
}

export function ExportBundleDialog({
  open,
  profiles,
  onClose,
  onExport,
  exporting = false,
}: ExportBundleDialogProps) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<VpnProfileId>>(new Set())
  const selectAllRef = useRef<HTMLInputElement>(null)
  const groupId = useId()
  const allSelected = profiles.length > 0 && selectedIds.size === profiles.length

  useEffect(() => {
    if (open) setSelectedIds(new Set(profiles.map((profile) => profile.id)))
  }, [open, profiles])

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedIds.size > 0 && !allSelected
    }
  }, [allSelected, selectedIds.size])

  function toggleProfile(profileId: VpnProfileId) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(profileId)) next.delete(profileId)
      else next.add(profileId)
      return next
    })
  }

  return (
    <Dialog
      open={open}
      title="Export profile bundle"
      description="Choose the VPN profiles to package into one .osch file."
      onClose={onClose}
      closeDisabled={exporting}
      className="bundle-dialog"
      footer={
        <>
          <Button onClick={onClose} disabled={exporting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void onExport([...selectedIds])}
            disabled={selectedIds.size === 0}
            busy={exporting}
            busyLabel="Saving..."
          >
            Export bundle
          </Button>
        </>
      }
    >
      <div className="bundle-picker">
        <div className="bundle-picker__toolbar">
          <label className="bundle-select-all">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allSelected}
              onChange={() =>
                setSelectedIds(allSelected ? new Set() : new Set(profiles.map(({ id }) => id)))
              }
              disabled={exporting}
            />
            <span>Select all</span>
          </label>
          <output className="bundle-picker__count" aria-live="polite">
            {selectedIds.size} of {profiles.length} selected
          </output>
        </div>
        <fieldset className="bundle-profile-list" aria-labelledby={groupId} disabled={exporting}>
          <legend className="visually-hidden" id={groupId}>
            Profiles to export
          </legend>
          {profiles.map((profile) => (
            <label className="bundle-profile" key={profile.id}>
              <input
                type="checkbox"
                checked={selectedIds.has(profile.id)}
                onChange={() => toggleProfile(profile.id)}
              />
              <span className="bundle-profile__content">
                <strong>{profile.name}</strong>
                <span>{profile.configFileName}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="bundle-warning" role="note">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3 2.5 20h19L12 3Zm0 6v5m0 3v.1" />
          </svg>
          <p>
            <strong>Review before sharing.</strong> Bundles can contain private keys referenced by
            your VPN configurations. Usernames are included; saved passwords are never exported.
          </p>
        </div>
      </div>
    </Dialog>
  )
}
