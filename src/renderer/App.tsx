import { useState } from 'react'
import { AppShell } from './components/app-shell'
import { ConnectionOverview } from './components/connection'
import {
  AddProfileDialog,
  DeleteProfileDialog,
  EditProfileDialog,
  ExportBundleDialog,
  ImportBundleDialog,
} from './components/dialogs'
import {
  ProfileList,
  toCreateVpnProfileInput,
  toUpdateVpnProfileInput,
  type ProfileEditorValue,
  type ProfileListItem,
} from './components/profiles'
import { SettingsDialog } from './components/settings'
import { Button, Toast, ToastRegion } from './components/ui'
import { useConnectionState, useProfiles } from './hooks'
import type { BundleImportPreview } from './state/types'

type DialogState =
  | { type: 'closed' }
  | { type: 'add' }
  | { type: 'edit'; profile: ProfileListItem }
  | { type: 'delete'; profile: ProfileListItem }

export function App() {
  const profilesState = useProfiles()
  const connection = useConnectionState()
  const [dialog, setDialog] = useState<DialogState>({ type: 'closed' })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [importPreview, setImportPreview] = useState<BundleImportPreview | null>(null)
  const [selectingImport, setSelectingImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const activeProfile = profilesState.profiles.find(
    (profile) => profile.id === connection.profileId,
  )
  const editProfile = dialog.type === 'edit' ? dialog.profile : null
  const deleteProfile = dialog.type === 'delete' ? dialog.profile : null
  const connectionBusy =
    connection.isLoading || connection.isConnecting || connection.isDisconnecting
  const connectionErrorDetails =
    connection.state.status === 'error'
      ? `${connection.state.error.code}: ${connection.state.error.message}`
      : connection.error

  async function handleAdd(value: ProfileEditorValue) {
    const created = await profilesState.createProfile(toCreateVpnProfileInput(value))
    if (created) setDialog({ type: 'closed' })
  }

  async function handleEdit(value: ProfileEditorValue) {
    if (!editProfile) return
    const updated = await profilesState.updateProfile(
      editProfile.id,
      toUpdateVpnProfileInput(value),
    )
    if (updated) setDialog({ type: 'closed' })
  }

  async function handleDelete(profile: ProfileListItem) {
    const deleted = await profilesState.deleteProfile(profile.id)
    if (deleted) setDialog({ type: 'closed' })
  }

  async function handleSelectBundle() {
    setSuccessMessage(null)
    setSelectingImport(true)
    const preview = await profilesState.selectBundleForImport()
    setSelectingImport(false)
    if (preview) setImportPreview(preview)
  }

  async function handleCloseImport() {
    if (!importPreview || importing) return
    const sessionId = importPreview.sessionId
    setImportPreview(null)
    await profilesState.discardBundleImport(sessionId)
  }

  async function handleImport(profileKeys: readonly string[]) {
    if (!importPreview) return
    setImporting(true)
    const result = await profilesState.importBundle(importPreview.sessionId, profileKeys)
    setImporting(false)
    setImportPreview(null)
    if (!result) return
    setSuccessMessage(
      `${result.importedCount} ${result.importedCount === 1 ? 'profile' : 'profiles'} imported. Passwords were not imported.`,
    )
  }

  async function handleExport(profileIds: readonly string[]) {
    setExporting(true)
    const result = await profilesState.exportBundle(profileIds)
    setExporting(false)
    if (!result) return
    setExportOpen(false)
    setSuccessMessage(
      `${result.exportedCount} ${result.exportedCount === 1 ? 'profile' : 'profiles'} exported to ${result.fileName}.`,
    )
  }

  return (
    <AppShell
      profileCount={profilesState.profiles.length}
      onAddProfile={() => setDialog({ type: 'add' })}
      onImportProfiles={() => void handleSelectBundle()}
      onExportProfiles={() => {
        setSuccessMessage(null)
        setExportOpen(true)
      }}
      profileActionsDisabled={profilesState.isMutating}
      importingProfiles={selectingImport}
      exportingProfiles={exporting}
      onOpenSettings={() => setSettingsOpen(true)}
      connection={
        <ConnectionOverview
          status={connection.status}
          statusLabel={connection.statusLabel}
          profileName={activeProfile?.name}
          isLoading={connection.isLoading}
          connectedAt={
            connection.state.status === 'connected' ? connection.state.connectedAt : undefined
          }
          error={connection.error}
          technicalDetails={connectionErrorDetails}
          onDismissError={connection.clearError}
        />
      }
    >
      {profilesState.isLoading && profilesState.profiles.length === 0 ? (
        <div className="profile-loading" role="status">
          <span className="profile-loading__line" />
          <span>Loading local profiles</span>
        </div>
      ) : profilesState.error && profilesState.profiles.length === 0 ? (
        <section className="load-error" role="alert">
          <div>
            <p className="eyebrow">Library unavailable</p>
            <h2>Profiles could not be loaded</h2>
            <p>{profilesState.error}</p>
          </div>
          <Button variant="secondary" onClick={() => void profilesState.loadProfiles()}>
            Try again
          </Button>
        </section>
      ) : (
        <ProfileList
          profiles={profilesState.profiles}
          connectionState={connection.state}
          onAdd={() => setDialog({ type: 'add' })}
          onConnect={(profile) => void connection.connect(profile.id)}
          onDisconnect={() => void connection.disconnect()}
          onEdit={(profile) => setDialog({ type: 'edit', profile })}
          onDelete={(profile) => setDialog({ type: 'delete', profile })}
          disabled={connectionBusy || profilesState.isMutating}
        />
      )}

      <AddProfileDialog
        open={dialog.type === 'add'}
        onClose={() => setDialog({ type: 'closed' })}
        onSelectConfigFile={profilesState.selectConfigFile}
        onAdd={handleAdd}
        saving={profilesState.isMutating}
      />
      <EditProfileDialog
        open={dialog.type === 'edit'}
        profile={editProfile}
        onClose={() => setDialog({ type: 'closed' })}
        onSelectConfigFile={profilesState.selectConfigFile}
        onSave={handleEdit}
        saving={Boolean(editProfile && profilesState.pendingProfileIds.has(editProfile.id))}
      />
      <DeleteProfileDialog
        open={dialog.type === 'delete'}
        profile={deleteProfile}
        connectionState={connection.state}
        onClose={() => setDialog({ type: 'closed' })}
        onConfirm={handleDelete}
        deleting={Boolean(deleteProfile && profilesState.pendingProfileIds.has(deleteProfile.id))}
      />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ImportBundleDialog
        preview={importPreview}
        onClose={() => void handleCloseImport()}
        onImport={handleImport}
        importing={importing}
      />
      <ExportBundleDialog
        open={exportOpen}
        profiles={profilesState.profiles}
        onClose={() => setExportOpen(false)}
        onExport={handleExport}
        exporting={exporting}
      />

      <ToastRegion>
        {successMessage ? (
          <Toast tone="success" onDismiss={() => setSuccessMessage(null)}>
            {successMessage}
          </Toast>
        ) : null}
        {profilesState.error && profilesState.profiles.length > 0 ? (
          <Toast tone="error" onDismiss={profilesState.clearError} duration={0}>
            <strong>Profile action failed</strong>
            <span>{profilesState.error}</span>
          </Toast>
        ) : null}
      </ToastRegion>
    </AppShell>
  )
}
