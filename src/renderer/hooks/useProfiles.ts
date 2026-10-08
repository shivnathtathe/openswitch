import { useEffect, useSyncExternalStore } from 'react'
import {
  clearProfilesError,
  createProfile,
  deleteProfile,
  ensureProfilesLoaded,
  getProfilesSnapshot,
  loadProfiles,
  selectConfigFile,
  subscribeProfiles,
  updateProfile,
} from '../state/profilesStore'
import type {
  ConfigFileSelection,
  CreateVpnProfileInput,
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
    selectConfigFile,
    clearError: clearProfilesError,
  }
}
