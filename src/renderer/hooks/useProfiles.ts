import { useEffect, useSyncExternalStore } from 'react'
import {
  clearProfilesError,
  createProfile,
  deleteProfile,
  discardBundleImport,
  ensureProfilesLoaded,
  getProfilesSnapshot,
  loadProfiles,
  exportBundle,
  importBundle,
  selectBundleForImport,
  selectConfigFile,
  subscribeProfiles,
  updateProfile,
} from '../state/profilesStore'
import type {
  ConfigFileSelection,
  CreateVpnProfileInput,
  BundleExportResult,
  BundleImportPreview,
  BundleImportResult,
  UpdateVpnProfileInput,
  VpnProfile,
  VpnProfileId,
} from '../state/types'

export interface UseProfilesResult {
  profiles: readonly VpnProfile[]
  isLoading: boolean
  isMutating: boolean
  error: string | null
  pendingProfileIds: ReadonlySet<VpnProfileId>
  loadProfiles: () => Promise<void>
  createProfile: (input: CreateVpnProfileInput) => Promise<VpnProfile | null>
  updateProfile: (id: VpnProfileId, input: UpdateVpnProfileInput) => Promise<VpnProfile | null>
  deleteProfile: (id: VpnProfileId) => Promise<boolean>
  selectConfigFile: () => Promise<ConfigFileSelection | null>
  selectBundleForImport: () => Promise<BundleImportPreview | null>
  importBundle: (
    sessionId: string,
    profileKeys: readonly string[],
  ) => Promise<BundleImportResult | null>
  discardBundleImport: (sessionId: string) => Promise<boolean>
  exportBundle: (profileIds: readonly VpnProfileId[]) => Promise<BundleExportResult | null>
  clearError: () => void
}

export function useProfiles(): UseProfilesResult {
  const state = useSyncExternalStore(subscribeProfiles, getProfilesSnapshot, getProfilesSnapshot)

  useEffect(() => {
    ensureProfilesLoaded()
  }, [])

  return {
    ...state,
    loadProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
    discardBundleImport,
    exportBundle,
    importBundle,
    selectBundleForImport,
    selectConfigFile,
    clearError: clearProfilesError,
  }
}
