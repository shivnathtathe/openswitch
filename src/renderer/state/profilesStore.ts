import type {
  ConfigFileSelection,
  CreateVpnProfileInput,
  BundleExportResult,
  BundleImportPreview,
  BundleImportResult,
  UpdateVpnProfileInput,
  VpnProfile,
  VpnProfileId,
} from './types'
import { formatError } from '../utils/errors'
import { getOpenSwitchApi } from '../utils/openSwitch'

export interface ProfilesSnapshot {
  profiles: readonly VpnProfile[]
  isLoading: boolean
  isMutating: boolean
  error: string | null
  pendingProfileIds: ReadonlySet<VpnProfileId>
}

const EMPTY_IDS: ReadonlySet<VpnProfileId> = new Set()

let snapshot: ProfilesSnapshot = {
  profiles: [],
  isLoading: false,
  isMutating: false,
  error: null,
  pendingProfileIds: EMPTY_IDS,
}
let loadSequence = 0
let mutationSequence = 0
let dataSequence = 0
let hasAttemptedLoad = false
let mutationCount = 0
const pendingCounts = new Map<VpnProfileId, number>()
const latestProfileAction = new Map<VpnProfileId, number>()
const listeners = new Set<() => void>()

function publish(change: Partial<ProfilesSnapshot>): void {
  snapshot = { ...snapshot, ...change }
  listeners.forEach((listener) => listener())
}

function pendingIds(): ReadonlySet<VpnProfileId> {
  return pendingCounts.size ? new Set(pendingCounts.keys()) : EMPTY_IDS
}

function beginMutation(id?: VpnProfileId): number {
  const sequence = ++mutationSequence
  mutationCount += 1
  if (id) {
    pendingCounts.set(id, (pendingCounts.get(id) ?? 0) + 1)
    latestProfileAction.set(id, sequence)
  }
  publish({ isMutating: true, pendingProfileIds: pendingIds(), error: null })
  return sequence
}

function endMutation(id?: VpnProfileId): void {
  mutationCount = Math.max(0, mutationCount - 1)
  if (id) {
    const remaining = (pendingCounts.get(id) ?? 1) - 1
    if (remaining > 0) pendingCounts.set(id, remaining)
    else pendingCounts.delete(id)
  }
  publish({
    isMutating: mutationCount > 0,
    pendingProfileIds: pendingIds(),
  })
}

export function getProfilesSnapshot(): ProfilesSnapshot {
  return snapshot
}

export function subscribeProfiles(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function loadProfiles(): Promise<void> {
  const sequence = ++loadSequence
  const dataAtStart = dataSequence
  hasAttemptedLoad = true
  publish({ isLoading: true, error: null })

  try {
    const result = await getOpenSwitchApi().profiles.list()
    if (sequence !== loadSequence) return
    if (!result.ok) {
      publish({ isLoading: false, error: formatError(result.error) })
      return
    }
    if (dataAtStart === dataSequence) publish({ profiles: result.value })
    publish({ isLoading: false })
  } catch (error) {
    if (sequence === loadSequence) {
      publish({ isLoading: false, error: formatError(error, 'Profiles could not be loaded.') })
    }
  }
}

export function ensureProfilesLoaded(): void {
  if (!hasAttemptedLoad) void loadProfiles()
}

export async function createProfile(input: CreateVpnProfileInput): Promise<VpnProfile | null> {
  const sequence = beginMutation()
  try {
    const result = await getOpenSwitchApi().profiles.create(input)
    if (!result.ok) {
      if (sequence === mutationSequence) publish({ error: formatError(result.error) })
      return null
    }
    dataSequence += 1
    publish({ profiles: [...snapshot.profiles, result.value] })
    return result.value
  } catch (error) {
    if (sequence === mutationSequence) {
      publish({ error: formatError(error, 'The profile could not be created.') })
    }
    return null
  } finally {
    endMutation()
  }
}

export async function updateProfile(
  id: VpnProfileId,
  input: UpdateVpnProfileInput,
): Promise<VpnProfile | null> {
  const sequence = beginMutation(id)
  try {
    const result = await getOpenSwitchApi().profiles.update(id, input)
    if (!result.ok) {
      if (latestProfileAction.get(id) === sequence) {
        publish({ error: formatError(result.error) })
      }
      return null
    }
    if (latestProfileAction.get(id) === sequence) {
      dataSequence += 1
      publish({
        profiles: snapshot.profiles.map((profile) => (profile.id === id ? result.value : profile)),
      })
    }
    return result.value
  } catch (error) {
    if (latestProfileAction.get(id) === sequence) {
      publish({ error: formatError(error, 'The profile could not be updated.') })
    }
    return null
  } finally {
    endMutation(id)
  }
}

export async function deleteProfile(id: VpnProfileId): Promise<boolean> {
  const sequence = beginMutation(id)
  try {
    const result = await getOpenSwitchApi().profiles.remove(id)
    if (!result.ok) {
      if (latestProfileAction.get(id) === sequence) {
        publish({ error: formatError(result.error) })
      }
      return false
    }
    if (latestProfileAction.get(id) === sequence) {
      dataSequence += 1
      publish({ profiles: snapshot.profiles.filter((profile) => profile.id !== id) })
    }
    return true
  } catch (error) {
    if (latestProfileAction.get(id) === sequence) {
      publish({ error: formatError(error, 'The profile could not be deleted.') })
    }
    return false
  } finally {
    endMutation(id)
  }
}

export async function selectConfigFile(): Promise<ConfigFileSelection | null> {
  try {
    publish({ error: null })
    const result = await getOpenSwitchApi().profiles.selectConfigFile()
    if (!result.ok) {
      throw new Error(formatError(result.error))
    }
    return result.value
  } catch (error) {
    const message = formatError(error, 'A configuration file could not be selected.')
    publish({ error: message })
    throw new Error(message)
  }
}

export async function selectBundleForImport(): Promise<BundleImportPreview | null> {
  const sequence = beginMutation()
  try {
    const result = await getOpenSwitchApi().profiles.selectBundleForImport()
    if (!result.ok) {
      if (sequence === mutationSequence) publish({ error: formatError(result.error) })
      return null
    }
    return result.value
  } catch (error) {
    if (sequence === mutationSequence) {
      publish({ error: formatError(error, 'The profile bundle could not be opened.') })
    }
    return null
  } finally {
    endMutation()
  }
}

export async function importBundle(
  sessionId: string,
  profileKeys: readonly string[],
): Promise<BundleImportResult | null> {
  const sequence = beginMutation()
  try {
    const result = await getOpenSwitchApi().profiles.importBundle(sessionId, profileKeys)
    if (!result.ok) {
      if (sequence === mutationSequence) publish({ error: formatError(result.error) })
      return null
    }
    dataSequence += 1
    publish({ profiles: result.value.profiles })
    return result.value
  } catch (error) {
    if (sequence === mutationSequence) {
      publish({ error: formatError(error, 'The selected profiles could not be imported.') })
    }
    return null
  } finally {
    endMutation()
  }
}

export async function discardBundleImport(sessionId: string): Promise<boolean> {
  try {
    const result = await getOpenSwitchApi().profiles.discardBundleImport(sessionId)
    if (!result.ok) {
      publish({ error: formatError(result.error) })
      return false
    }
    return true
  } catch (error) {
    publish({ error: formatError(error, 'The temporary import could not be discarded.') })
    return false
  }
}

export async function exportBundle(
  profileIds: readonly VpnProfileId[],
): Promise<BundleExportResult | null> {
  const sequence = beginMutation()
  try {
    const result = await getOpenSwitchApi().profiles.exportBundle(profileIds)
    if (!result.ok) {
      if (sequence === mutationSequence) publish({ error: formatError(result.error) })
      return null
    }
    return result.value
  } catch (error) {
    if (sequence === mutationSequence) {
      publish({ error: formatError(error, 'The profile bundle could not be exported.') })
    }
    return null
  } finally {
    endMutation()
  }
}

export function clearProfilesError(): void {
  if (snapshot.error) publish({ error: null })
}
