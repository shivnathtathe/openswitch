import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createWriteStream } from 'node:fs'

import yazl from 'yazl'
import { afterEach, describe, expect, it } from 'vitest'

import { BundleService } from '../../../src/main/bundles'
import type { BundleProfileImport, ProfileStorePort } from '../../../src/main/ipc/types'
import type { VpnProfile } from '../../../src/shared/contracts'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'openswitch-bundle-'))
  temporaryDirectories.push(directory)
  return directory
}

function vpnProfile(input: BundleProfileImport): VpnProfile {
  return {
    id: input.id,
    name: input.name,
    configFilePath: input.configFilePath,
    configFileName: 'config.ovpn',
    credentials: { usernameConfigured: Boolean(input.username), passwordConfigured: false },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

class FakeProfiles implements ProfileStorePort {
  readonly records: BundleProfileImport[]

  constructor(records: BundleProfileImport[] = []) {
    this.records = records
  }

  async list(): Promise<readonly VpnProfile[]> {
    return this.records.map(vpnProfile)
  }

  async get(id: string): Promise<VpnProfile | undefined> {
    const record = this.records.find((profile) => profile.id === id)
    return record ? vpnProfile(record) : undefined
  }

  async create(): Promise<VpnProfile> {
    throw new Error('not used')
  }

  async update(): Promise<VpnProfile> {
    throw new Error('not used')
  }

  async remove(): Promise<void> {}

  async getBundleProfiles(ids: readonly string[]) {
    return ids.map((id) => {
      const profile = this.records.find((record) => record.id === id)
      if (!profile) throw new Error('not found')
      return profile
    })
  }

  async importBundleProfiles(
    inputs: readonly BundleProfileImport[],
  ): Promise<readonly VpnProfile[]> {
    this.records.push(...inputs)
    return inputs.map(vpnProfile)
  }
}

async function writeArchive(
  path: string,
  entries: Readonly<Record<string, string>>,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const zip = new yazl.ZipFile()
    for (const [name, contents] of Object.entries(entries))
      zip.addBuffer(Buffer.from(contents), name)
    const output = createWriteStream(path)
    output.on('error', reject)
    output.on('close', resolve)
    zip.outputStream.on('error', reject)
    zip.outputStream.pipe(output)
    zip.end()
  })
}

describe('BundleService', () => {
  it('roundtrips dependencies, omits passwords, and imports with fresh IDs and no credentials', async () => {
    const root = await temporaryDirectory()
    const sourceDirectory = join(root, 'source')
    await mkdir(join(sourceDirectory, 'keys'), { recursive: true })
    await writeFile(join(sourceDirectory, 'ca cert.pem'), 'CA DATA')
    await writeFile(join(sourceDirectory, 'keys', 'client.key'), 'PRIVATE KEY DATA')
    await writeFile(
      join(sourceDirectory, 'office.ovpn'),
      [
        'client',
        'remote first.example 1194 # primary',
        'remote second.example 443',
        'ca "ca cert.pem"',
        'key keys/client.key',
        'auth-user-pass',
      ].join('\n'),
    )
    const source = new FakeProfiles([
      {
        id: 'original-id',
        name: 'Office',
        configFilePath: join(sourceDirectory, 'office.ovpn'),
        username: 'alice',
      },
    ])
    const archivePath = join(root, 'profiles.osch')
    const exporter = new BundleService(source, () => join(root, 'export-user-data'))
    await expect(exporter.export(['original-id'], archivePath)).resolves.toEqual({
      exportedCount: 1,
      fileName: 'profiles.osch',
    })
    expect((await readFile(archivePath)).includes(Buffer.from('never-export-this-password'))).toBe(
      false,
    )

    const importedStore = new FakeProfiles([
      {
        id: 'existing-id',
        name: 'Office',
        configFilePath: join(sourceDirectory, 'office.ovpn'),
        username: '',
      },
    ])
    const importer = new BundleService(importedStore, () => join(root, 'import-user-data'))
    const preview = await importer.preview(archivePath)
    expect(preview.profiles).toEqual([
      expect.objectContaining({
        key: 'profile-1',
        username: 'alice',
        includedFileCount: 2,
        containsPrivateKey: true,
      }),
    ])
    const result = await importer.import(preview.sessionId, ['profile-1'])
    expect(result.importedCount).toBe(1)
    expect(importedStore.records[1]).toMatchObject({ name: 'Office (2)', username: 'alice' })
    expect(importedStore.records[1].id).not.toBe('original-id')
    const importedProfile = result.profiles.find(
      (profile) => profile.id === importedStore.records[1].id,
    )
    expect(importedProfile?.credentials.passwordConfigured).toBe(false)
    const config = await readFile(importedStore.records[1].configFilePath, 'utf8')
    expect(config).toContain('remote first.example 1194 # primary\nremote second.example 443')
    expect(config).toContain('ca "files/1-ca_cert.pem"')
    expect(config).toContain('key files/2-client.key')
  })

  it('imports only selected profiles', async () => {
    const root = await temporaryDirectory()
    const source = new FakeProfiles()
    for (const name of ['One', 'Two']) {
      const config = join(root, `${name}.ovpn`)
      await writeFile(config, 'client\nauth-user-pass\n')
      source.records.push({ id: name, name, configFilePath: config, username: '' })
    }
    const path = join(root, 'selective.osch')
    await new BundleService(source, () => root).export(['One', 'Two'], path)
    const target = new FakeProfiles()
    const service = new BundleService(target, () => join(root, 'target'))
    const preview = await service.preview(path)
    await service.import(preview.sessionId, ['profile-2'])
    expect(target.records.map((profile) => profile.name)).toEqual(['Two'])
  })

  it('refuses inline authentication secrets instead of exporting them', async () => {
    const root = await temporaryDirectory()
    const config = join(root, 'secret.ovpn')
    await writeFile(
      config,
      'client\n<auth-user-pass>\nalice\nnever-export-this-password\n</auth-user-pass>\n',
    )
    const profiles = new FakeProfiles([
      { id: 'secret', name: 'Secret', configFilePath: config, username: 'alice' },
    ])
    await expect(
      new BundleService(profiles, () => root).export(['secret'], join(root, 'secret.osch')),
    ).rejects.toThrow(/inline authentication data/i)
  })

  it('rejects malformed manifests and unsafe archived references', async () => {
    const root = await temporaryDirectory()
    const malformed = join(root, 'malformed.osch')
    await writeArchive(malformed, {
      'manifest.json': JSON.stringify({ format: 'wrong', version: 1, profiles: [] }),
    })
    const service = new BundleService(new FakeProfiles(), () => root)
    await expect(service.preview(malformed)).rejects.toThrow(/manifest|format|version/i)

    const unsafe = join(root, 'unsafe.osch')
    const manifest = {
      format: 'OpenSwitch profile bundle',
      version: 1,
      profiles: [
        {
          key: 'p',
          name: 'Unsafe',
          username: '',
          config: 'profiles/p/config.ovpn',
          files: ['profiles/p/files/ca.pem'],
          containsPrivateKey: false,
        },
      ],
    }
    await writeArchive(unsafe, {
      'manifest.json': JSON.stringify(manifest),
      'profiles/p/config.ovpn': 'ca ../../outside.pem\n',
      'profiles/p/files/ca.pem': 'CA',
    })
    await expect(service.preview(unsafe)).rejects.toThrow(/undeclared file/i)
  })

  it('rejects ZIP traversal entry names', async () => {
    const root = await temporaryDirectory()
    const path = join(root, 'traversal.osch')
    await writeArchive(path, {
      'manifest.json': JSON.stringify({
        format: 'OpenSwitch profile bundle',
        version: 1,
        profiles: [
          {
            key: 'p',
            name: 'P',
            username: '',
            config: 'profiles/p/config.ovpn',
            files: [],
            containsPrivateKey: false,
          },
        ],
      }),
      'profiles/p/config.ovpn': 'client\n',
      'xx/evil': 'bad',
    })
    const data = await readFile(path)
    let offset = 0
    while ((offset = data.indexOf(Buffer.from('xx/evil'), offset)) >= 0) {
      data.write('../evil', offset, 'ascii')
      offset += 7
    }
    await writeFile(path, data)
    await expect(new BundleService(new FakeProfiles(), () => root).preview(path)).rejects.toThrow(
      /invalid relative path|unsafe entry path/i,
    )
  })
})
