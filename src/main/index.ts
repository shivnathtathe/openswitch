import { app } from 'electron'
import path from 'node:path'
import type {
  ConnectionState,
  CreateVpnProfileInput,
  UpdateVpnProfileInput,
  VpnProfile,
} from '../shared/contracts'
import type { MainServices } from './ipc/types'
import { MainLifecycle } from './lifecycle'
import { CredentialVault } from './credentials'
import { FileLogger } from './logging'
import { DefaultOpenVpnExecutableLocator, NodeProcessFactory, OpenVpnService } from './openvpn'
import { ProfileStore } from './profiles'
import { SettingsStore } from './settings'

type UnknownRecord = Record<string, unknown>
type UnknownMethod = (...args: unknown[]) => unknown

function method(target: UnknownRecord, names: string[]): UnknownMethod | undefined {
  for (const name of names) {
    if (typeof target[name] === 'function') return (target[name] as UnknownMethod).bind(target)
  }
  return undefined
}

function requireMethod(target: UnknownRecord, names: string[], service: string): UnknownMethod {
  const found = method(target, names)
  if (!found) throw new Error(`${service} must implement one of: ${names.join(', ')}`)
  return found
}

export function adaptMainServices(
  profileStore: object,
  credentialVault: object,
  openVpnService: object,
  settingsStore: SettingsStore,
): MainServices {
  const profiles = profileStore as UnknownRecord
  const vault = credentialVault as UnknownRecord
  const vpn = openVpnService as UnknownRecord
  const listRaw = requireMethod(profiles, ['list', 'listProfiles', 'getProfiles'], 'ProfileStore')
  const getRaw = method(profiles, ['get', 'getProfile'])
  const createRaw = requireMethod(profiles, ['create', 'createProfile'], 'ProfileStore')
  const updateRaw = requireMethod(profiles, ['update', 'updateProfile'], 'ProfileStore')
  const removeRaw = requireMethod(profiles, ['remove', 'removeProfile'], 'ProfileStore')
  const importManyRaw = requireMethod(profiles, ['createMany'], 'ProfileStore')
  const getSecret = requireMethod(
    vault,
    ['get', 'getCredentials', 'getForProfile'],
    'CredentialVault',
  )
  const saveSecret = requireMethod(vault, ['save', 'set', 'saveCredentials'], 'CredentialVault')
  const deleteSecret = requireMethod(
    vault,
    ['delete', 'remove', 'deleteCredentials'],
    'CredentialVault',
  )
  const hasSecret = requireMethod(vault, ['has', 'hasCredentials'], 'CredentialVault')
  const connectRaw = requireMethod(vpn, ['connect', 'start'], 'OpenVpnService')
  const disconnectRaw = requireMethod(vpn, ['disconnect', 'stop'], 'OpenVpnService')
  const onRaw = method(vpn, ['on', 'addListener'])
  const offRaw = method(vpn, ['off', 'removeListener'])

  const getStored = async (id: string): Promise<UnknownRecord | undefined> => {
    if (getRaw) return (await getRaw(id)) as UnknownRecord | undefined
    const all = (await listRaw()) as UnknownRecord[]
    return all.find((profile) => profile.id === id)
  }
  const normalize = async (raw: UnknownRecord): Promise<VpnProfile> => {
    const id = String(raw.id)
    const configFilePath = String(raw.configFilePath ?? raw.ovpnPath ?? '')
    const passwordConfigured = Boolean(await hasSecret(id))
    return {
      id,
      name: String(raw.name),
      configFilePath,
      configFileName: String(raw.configFileName ?? path.basename(configFilePath)),
      credentials: {
        usernameConfigured:
          Boolean(raw.username) ||
          Boolean((raw.credentials as UnknownRecord | undefined)?.usernameConfigured),
        passwordConfigured,
      },
      createdAt: String(raw.createdAt ?? new Date().toISOString()),
      updatedAt: String(raw.updatedAt ?? raw.createdAt ?? new Date().toISOString()),
    }
  }

  const service: MainServices = {
    profiles: {
      list: async () => Promise.all(((await listRaw()) as UnknownRecord[]).map(normalize)),
      get: async (id) => {
        const raw = await getStored(id)
        return raw ? normalize(raw) : undefined
      },
      create: async (input: CreateVpnProfileInput) => {
        const raw = (await createRaw({
          name: input.name,
          ovpnPath: input.configFilePath,
          username: input.credentials?.username ?? '',
        })) as UnknownRecord
        if (input.credentials) {
          try {
            await saveSecret(String(raw.id), input.credentials.password)
          } catch (error) {
            await Promise.resolve(deleteSecret(String(raw.id))).catch(() => undefined)
            await Promise.resolve(removeRaw(String(raw.id))).catch(() => undefined)
            throw error
          }
        }
        return normalize(raw)
      },
      update: async (id: string, input: UpdateVpnProfileInput) => {
        const previous = await getStored(id)
        if (!previous) throw new Error(`Profile not found: ${id}`)
        const previousSecret = await getSecret(id)
        const rawInput: UnknownRecord = {}
        if (input.name !== undefined) rawInput.name = input.name
        if (input.configFilePath !== undefined) rawInput.ovpnPath = input.configFilePath
        if (input.credentials?.action === 'set') {
          rawInput.username = input.credentials.value.username
          rawInput.credentialSaved = true
        } else if (input.credentials?.action === 'clear') {
          rawInput.username = ''
          rawInput.credentialSaved = false
        }
        const raw = (await updateRaw(id, rawInput)) as UnknownRecord | undefined
        if (!raw) throw new Error(`Profile not found: ${id}`)
        try {
          if (input.credentials?.action === 'set') {
            await saveSecret(id, input.credentials.value.password)
          } else if (input.credentials?.action === 'clear') {
            await deleteSecret(id)
          }
        } catch (error) {
          await Promise.resolve(
            updateRaw(id, {
              name: previous.name,
              ovpnPath: previous.ovpnPath ?? previous.configFilePath,
              username: previous.username ?? '',
              credentialSaved: previous.credentialSaved ?? Boolean(previousSecret),
            }),
          ).catch(() => undefined)
          if (typeof previousSecret === 'string') await saveSecret(id, previousSecret)
          else await deleteSecret(id)
          throw error
        }
        return normalize(raw)
      },
      remove: async (id: string) => {
        const previous = await getStored(id)
        if (!previous) throw new Error(`Profile not found: ${id}`)
        const previousSecret = await getSecret(id)
        await deleteSecret(id)
        try {
          const removed = await removeRaw(id)
          if (removed === false) throw new Error(`Profile not found: ${id}`)
        } catch (error) {
          if (typeof previousSecret === 'string') await saveSecret(id, previousSecret)
          throw error
        }
      },
      getBundleProfiles: async (profileIds) => {
        const all = (await listRaw()) as UnknownRecord[]
        return profileIds.map((id) => {
          const raw = all.find((profile) => profile.id === id)
          if (!raw) throw new Error(`Profile not found: ${id}`)
          return {
            id,
            name: String(raw.name),
            configFilePath: String(raw.configFilePath ?? raw.ovpnPath ?? ''),
            username: String(raw.username ?? ''),
          }
        })
      },
      importBundleProfiles: async (inputs) => {
        const raw = (await importManyRaw(
          inputs.map((input) => ({
            id: input.id,
            name: input.name,
            ovpnPath: input.configFilePath,
            username: input.username,
          })),
        )) as UnknownRecord[]
        return raw.map((profile) => {
          const configFilePath = String(profile.ovpnPath ?? profile.configFilePath ?? '')
          return {
            id: String(profile.id),
            name: String(profile.name),
            configFilePath,
            configFileName: path.basename(configFilePath),
            credentials: {
              usernameConfigured: Boolean(profile.username),
              passwordConfigured: false,
            },
            createdAt: String(profile.createdAt),
            updatedAt: String(profile.updatedAt),
          }
        })
      },
    },
    credentials: {
      get: async (id) => {
        const secret = await getSecret(id)
        if (secret && typeof secret === 'object')
          return secret as { username: string; password: string }
        if (typeof secret !== 'string') return undefined
        const raw = await getStored(id)
        return { username: String(raw?.username ?? ''), password: secret }
      },
    },
    vpn: {
      connect: async (profile, credentials) => {
        await connectRaw({ id: profile.id, configPath: profile.configFilePath }, credentials)
      },
      disconnect: async () => {
        await disconnectRaw()
      },
      onStateChanged: onRaw
        ? (listener) => {
            const handler = (rawState: unknown) => {
              const raw = rawState as UnknownRecord
              const status = String(raw.status)
              const profileId = typeof raw.profileId === 'string' ? raw.profileId : null
              const now =
                typeof raw.changedAt === 'string' ? raw.changedAt : new Date().toISOString()
              let state: ConnectionState
              if (status === 'connecting' && profileId)
                state = { status, profileId, startedAt: now }
              else if (status === 'connected' && profileId)
                state = { status, profileId, connectedAt: now }
              else if (status === 'disconnecting' && profileId)
                state = { status, profileId, startedAt: now }
              else if (status === 'error') {
                const detail = raw.error as UnknownRecord | undefined
                state = {
                  status,
                  profileId,
                  occurredAt: now,
                  error: {
                    code: 'VPN_PROCESS_FAILED',
                    message: String(detail?.message ?? 'OpenVPN failed'),
                    retryable: true,
                  },
                }
              } else state = { status: 'disconnected', profileId: null }
              listener(state)
            }
            onRaw('state', handler)
            return () => {
              if (offRaw) offRaw('state', handler)
            }
          }
        : undefined,
    },
    settings: settingsStore,
  }
  return service
}

export async function bootstrap(services: MainServices): Promise<MainLifecycle> {
  const lifecycle = new MainLifecycle(services)
  await lifecycle.start()
  return lifecycle
}

async function loadDefaultServices(): Promise<MainServices> {
  const injected = (globalThis as typeof globalThis & { __OPEN_SWITCH_SERVICES__?: MainServices })
    .__OPEN_SWITCH_SERVICES__
  if (injected) return injected

  const settingsStore = new SettingsStore()
  const openVpnService = new OpenVpnService({
    locator: new DefaultOpenVpnExecutableLocator(),
    processFactory: new NodeProcessFactory(),
    logger: new FileLogger(
      () => app.getPath('logs'),
      () => settingsStore.get().diagnosticLogging,
    ),
  })
  return adaptMainServices(new ProfileStore(), new CredentialVault(), openVpnService, settingsStore)
}

void loadDefaultServices()
  .then((services) => bootstrap(services))
  .catch((error) => {
    console.error('Unable to start OpenSwitch:', error)
    app.exit(1)
  })
