import { beforeEach, describe, expect, it, vi } from 'vitest'

const getOpenSwitchApi = vi.fn()

vi.mock('../../../src/renderer/utils/openSwitch', () => ({ getOpenSwitchApi }))

interface Deferred<Value> {
  promise: Promise<Value>
  resolve: (value: Value) => void
}

function deferred<Value>(): Deferred<Value> {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

const profile = {
  id: 'profile-1',
  name: 'Office VPN',
  configFilePath: String.raw`C:\VPN\office.ovpn`,
  configFileName: 'office.ovpn',
  credentials: { usernameConfigured: true, passwordConfigured: true },
  createdAt: '2026-10-08T10:00:00.000Z',
  updatedAt: '2026-10-08T10:00:00.000Z',
}

async function importStore() {
  return import('../../../src/renderer/state/profilesStore')
}

describe('profilesStore action state', () => {
  beforeEach(() => {
    vi.resetModules()
    getOpenSwitchApi.mockReset()
  })

  it('tracks overlapping actions per profile until each one settles', async () => {
    const first = deferred<{ ok: true; value: typeof profile }>()
    const second = deferred<{ ok: true; value: typeof profile }>()
    const update = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    getOpenSwitchApi.mockReturnValue({ profiles: { update } })
    const store = await importStore()

    const firstAction = store.updateProfile(profile.id, { name: 'First name' })
    const secondAction = store.updateProfile(profile.id, { name: 'Latest name' })

    expect(store.getProfilesSnapshot().isMutating).toBe(true)
    expect(store.getProfilesSnapshot().pendingProfileIds.has(profile.id)).toBe(true)

    first.resolve({ ok: true, value: { ...profile, name: 'First name' } })
    await firstAction
    expect(store.getProfilesSnapshot().isMutating).toBe(true)
    expect(store.getProfilesSnapshot().pendingProfileIds.has(profile.id)).toBe(true)

    second.resolve({ ok: true, value: { ...profile, name: 'Latest name' } })
    await secondAction
    expect(store.getProfilesSnapshot().isMutating).toBe(false)
    expect(store.getProfilesSnapshot().pendingProfileIds.has(profile.id)).toBe(false)
  })

  it('does not let a stale load overwrite a profile created while loading', async () => {
    const list = deferred<{ ok: true; value: readonly (typeof profile)[] }>()
    getOpenSwitchApi.mockReturnValue({
      profiles: {
        list: vi.fn().mockReturnValue(list.promise),
        create: vi.fn().mockResolvedValue({ ok: true, value: profile }),
      },
    })
    const store = await importStore()

    const loading = store.loadProfiles()
    await store.createProfile({ name: profile.name, configFilePath: profile.configFilePath })
    list.resolve({ ok: true, value: [] })
    await loading

    expect(store.getProfilesSnapshot().profiles).toEqual([profile])
    expect(store.getProfilesSnapshot().isLoading).toBe(false)
  })

  it('keeps the latest same-profile action result when responses arrive out of order', async () => {
    const loadResult = { ok: true as const, value: [profile] }
    const older = deferred<{ ok: true; value: typeof profile }>()
    const newer = deferred<{ ok: true; value: typeof profile }>()
    getOpenSwitchApi.mockReturnValue({
      profiles: {
        list: vi.fn().mockResolvedValue(loadResult),
        update: vi.fn().mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise),
      },
    })
    const store = await importStore()
    await store.loadProfiles()

    const olderAction = store.updateProfile(profile.id, { name: 'Older response' })
    const newerAction = store.updateProfile(profile.id, { name: 'Newer response' })
    newer.resolve({ ok: true, value: { ...profile, name: 'Newer response' } })
    await newerAction
    older.resolve({ ok: true, value: { ...profile, name: 'Older response' } })
    await olderAction

    expect(store.getProfilesSnapshot().profiles[0]?.name).toBe('Newer response')
  })
})
