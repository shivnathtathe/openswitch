import { randomUUID } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { extname } from 'node:path'

import ElectronStore from 'electron-store'

import type { Profile } from '../../shared/profile'

const CURRENT_SCHEMA_VERSION = 1
const MAX_NAME_LENGTH = 100
const MAX_USERNAME_LENGTH = 256
const MAX_CONFIG_SIZE_BYTES = 1024 * 1024
const UNSAFE_DIRECTIVE =
  /^\s*(?:--)?(?:plugin|script-security|up|down|route-up|route-pre-down|ipchange|client-connect|client-disconnect|learn-address|auth-user-pass-verify|tls-verify|config|include)\b/i

export type CreateProfileInput = Pick<Profile, 'name' | 'ovpnPath' | 'username'>
export type ImportProfileInput = Pick<Profile, 'id' | 'name' | 'ovpnPath' | 'username'>

export type UpdateProfileInput = Partial<
  Pick<Profile, 'name' | 'ovpnPath' | 'username' | 'credentialSaved'>
>

interface StoredProfile {
  id: string
  name: string
  ovpnPath: string
  username: string
  credentialSaved: boolean
  createdAt: string
  updatedAt: string
  lastConnectedAt?: string
}

interface ProfileStoreSchema {
  schemaVersion: number
  profiles: StoredProfile[]
}

const storeSchema = {
  schemaVersion: {
    type: 'number',
    minimum: 0,
    default: CURRENT_SCHEMA_VERSION,
  },
  profiles: {
    type: 'array',
    default: [],
  },
} as const

export class ProfileStore {
  private readonly store: ElectronStore<ProfileStoreSchema>

  constructor() {
    this.store = new ElectronStore<ProfileStoreSchema>({
      name: 'profiles',
      schema: storeSchema,
      defaults: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        profiles: [],
      },
    })

    this.migrate()
  }

  list(): Profile[] {
    return this.store.get('profiles').map(toProfile)
  }

  get(id: string): Profile | undefined {
    const profile = this.store.get('profiles').find((item) => item.id === id)
    return profile ? toProfile(profile) : undefined
  }

  create(input: CreateProfileInput): Profile {
    const now = new Date().toISOString()
    const profile: StoredProfile = {
      id: randomUUID(),
      name: validateName(input.name),
      ovpnPath: validateOvpnConfig(input.ovpnPath),
      username: validateUsername(input.username),
      credentialSaved: false,
      createdAt: now,
      updatedAt: now,
    }

    this.store.set('profiles', [...this.store.get('profiles'), profile])
    return toProfile(profile)
  }

  createMany(inputs: readonly ImportProfileInput[]): Profile[] {
    const existing = this.store.get('profiles')
    const ids = new Set(existing.map((profile) => profile.id))
    const now = new Date().toISOString()
    const added = inputs.map((input): StoredProfile => {
      if (typeof input.id !== 'string' || !input.id.trim() || ids.has(input.id)) {
        throw new Error('Imported profile ID is invalid or duplicated.')
      }
      ids.add(input.id)
      return {
        id: input.id,
        name: validateName(input.name),
        ovpnPath: validateOvpnConfig(input.ovpnPath),
        username: validateUsername(input.username),
        credentialSaved: false,
        createdAt: now,
        updatedAt: now,
      }
    })
    this.store.set('profiles', [...existing, ...added])
    return added.map(toProfile)
  }

  update(id: string, input: UpdateProfileInput): Profile | undefined {
    const profiles = this.store.get('profiles')
    const index = profiles.findIndex((profile) => profile.id === id)
    if (index === -1) {
      return undefined
    }

    const existing = profiles[index]
    const updated: StoredProfile = {
      ...existing,
      name: input.name === undefined ? existing.name : validateName(input.name),
      ovpnPath:
        input.ovpnPath === undefined ? existing.ovpnPath : validateOvpnConfig(input.ovpnPath),
      username: input.username === undefined ? existing.username : validateUsername(input.username),
      credentialSaved:
        input.credentialSaved === undefined
          ? existing.credentialSaved
          : Boolean(input.credentialSaved),
      updatedAt: new Date().toISOString(),
    }

    profiles[index] = updated
    this.store.set('profiles', profiles)
    return toProfile(updated)
  }

  remove(id: string): boolean {
    const profiles = this.store.get('profiles')
    const remaining = profiles.filter((profile) => profile.id !== id)
    if (remaining.length === profiles.length) {
      return false
    }

    this.store.set('profiles', remaining)
    return true
  }

  markConnected(id: string): Profile | undefined {
    const profiles = this.store.get('profiles')
    const index = profiles.findIndex((profile) => profile.id === id)
    if (index === -1) {
      return undefined
    }

    const now = new Date().toISOString()
    const updated: StoredProfile = {
      ...profiles[index],
      updatedAt: now,
      lastConnectedAt: now,
    }

    profiles[index] = updated
    this.store.set('profiles', profiles)
    return toProfile(updated)
  }

  private migrate(): void {
    const schemaVersion = this.store.get('schemaVersion')
    if (schemaVersion > CURRENT_SCHEMA_VERSION) {
      throw new Error(
        `Profile data uses unsupported schema version ${schemaVersion}. Upgrade OpenSwitch to continue.`,
      )
    }
    const rawProfiles = this.store.get('profiles') as unknown
    if (!Array.isArray(rawProfiles)) throw new Error('Stored profile data is invalid.')
    const profiles = rawProfiles
    const migrated: StoredProfile[] = []
    const ids = new Set<string>()

    for (const [index, rawProfile] of profiles.entries()) {
      const profile = migrateProfile(rawProfile, ids)
      if (!profile) throw new Error(`Stored profile ${index + 1} is invalid; no data was changed.`)
      migrated.push(profile)
      ids.add(profile.id)
    }

    this.store.set({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      profiles: migrated,
    })
  }
}

function migrateProfile(raw: unknown, ids: Set<string>): StoredProfile | undefined {
  if (!isRecord(raw)) {
    return undefined
  }

  try {
    const now = new Date().toISOString()
    const candidateId = typeof raw.id === 'string' ? raw.id.trim() : ''
    const id = candidateId && !ids.has(candidateId) ? candidateId : randomUUID()
    const createdAt = normalizeTimestamp(raw.createdAt, now)
    const updatedAt = normalizeTimestamp(raw.updatedAt, createdAt)
    const lastConnectedAt = normalizeOptionalTimestamp(raw.lastConnectedAt)

    return {
      id,
      name: validateName(raw.name),
      ovpnPath: validateOvpnPath(raw.ovpnPath),
      username: typeof raw.username === 'string' ? validateUsername(raw.username) : '',
      credentialSaved: typeof raw.credentialSaved === 'boolean' ? raw.credentialSaved : false,
      createdAt,
      updatedAt,
      ...(lastConnectedAt ? { lastConnectedAt } : {}),
    }
  } catch {
    // Invalid legacy records cannot be represented safely and are omitted.
    return undefined
  }
}

function validateName(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError('Profile name must be a string.')
  }

  const name = value.trim()
  if (!name) {
    throw new Error('Profile name is required.')
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`Profile name must not exceed ${MAX_NAME_LENGTH} characters.`)
  }

  return name
}

function validateOvpnPath(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError('OpenVPN configuration path must be a string.')
  }

  const ovpnPath = value.trim()
  if (!ovpnPath || extname(ovpnPath).toLowerCase() !== '.ovpn') {
    throw new Error('OpenVPN configuration path must point to an .ovpn file.')
  }

  return ovpnPath
}

function validateOvpnConfig(value: unknown): string {
  const ovpnPath = validateOvpnPath(value)
  let stats: ReturnType<typeof statSync>
  let contents: string
  try {
    stats = statSync(ovpnPath)
    if (!stats.isFile()) throw new Error('not a file')
    if (stats.size > MAX_CONFIG_SIZE_BYTES) {
      throw new Error('OpenVPN configuration files must not exceed 1 MB.')
    }
    contents = readFileSync(ovpnPath, 'utf8')
  } catch (error) {
    if (error instanceof Error && error.message.includes('must not exceed')) throw error
    throw new Error('OpenVPN configuration file could not be read.')
  }

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trimStart()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue
    const match = UNSAFE_DIRECTIVE.exec(line)
    if (match) {
      throw new Error(
        `OpenVPN directive "${match[0].trim()}" is not supported because it can execute local code.`,
      )
    }
  }
  return ovpnPath
}

function validateUsername(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError('Profile username must be a string.')
  }

  const username = value.trim()
  if (username.length > MAX_USERNAME_LENGTH) {
    throw new Error(`Profile username must not exceed ${MAX_USERNAME_LENGTH} characters.`)
  }

  return username
}

function normalizeTimestamp(value: unknown, fallback: string): string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
    ? new Date(value).toISOString()
    : fallback
}

function normalizeOptionalTimestamp(value: unknown): string | undefined {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
    ? new Date(value).toISOString()
    : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toProfile(profile: StoredProfile): Profile {
  return { ...profile } as Profile
}
