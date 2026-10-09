import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, lstat, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

import yauzl, { type Entry, type ZipFile } from 'yauzl'
import yazl from 'yazl'

import type {
  BundleExportResult,
  BundleImportPreview,
  BundleImportResult,
} from '../../shared/contracts'
import type { BundleProfileImport, BundleStoredProfile, ProfileStorePort } from '../ipc/types'

const FORMAT = 'OpenSwitch profile bundle'
const VERSION = 1
const MAX_PROFILES = 100
const MAX_ENTRIES = 500
const MAX_SMALL_FILE = 1024 * 1024
const MAX_DEPENDENCY = 20 * 1024 * 1024
const MAX_TOTAL = 100 * 1024 * 1024
const MAX_SESSIONS = 10
const SESSION_TTL_MS = 15 * 60 * 1000
const MAX_COMPRESSION_RATIO = 1000
const FILE_DIRECTIVES = new Set([
  'ca',
  'cert',
  'key',
  'pkcs12',
  'tls-auth',
  'tls-crypt',
  'tls-crypt-v2',
  'crl-verify',
  'dh',
  'extra-certs',
])
const UNSAFE_DIRECTIVES = new Set([
  'plugin',
  'script-security',
  'up',
  'down',
  'route-up',
  'route-pre-down',
  'ipchange',
  'client-connect',
  'client-disconnect',
  'learn-address',
  'auth-user-pass-verify',
  'tls-verify',
  'config',
  'include',
  'cd',
])
const RESERVED_WINDOWS_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i

interface ManifestProfile {
  key: string
  name: string
  username: string
  config: string
  files: string[]
  containsPrivateKey: boolean
}

interface Manifest {
  format: typeof FORMAT
  version: typeof VERSION
  profiles: ManifestProfile[]
}

interface Archive {
  manifest: Manifest
  entries: Map<string, Buffer>
}

interface PendingSession {
  sourcePath: string
  size: number
  modifiedMs: number
  digest: string
  createdMs: number
  manifest: Manifest
}

interface Token {
  value: string
  start: number
  end: number
  quote?: '"' | "'"
}

export class BundleService {
  // Keep source paths in the main process; the renderer receives only opaque session IDs.
  private readonly sessions = new Map<string, PendingSession>()

  constructor(
    private readonly profiles: ProfileStorePort,
    private readonly userDataPath: () => string,
  ) {}

  async preview(sourcePath: string): Promise<BundleImportPreview> {
    this.pruneSessions()
    const [archive, source, digest] = await Promise.all([
      readArchive(sourcePath),
      stat(sourcePath),
      hashFile(sourcePath),
    ]).catch((error: unknown) => {
      throw sanitizeError(error, [sourcePath])
    })
    if (!source.isFile()) throw new Error('The selected bundle is not a regular file.')
    if (this.sessions.size >= MAX_SESSIONS) {
      const oldest = this.sessions.keys().next().value as string | undefined
      if (oldest) this.sessions.delete(oldest)
    }
    const sessionId = randomUUID()
    this.sessions.set(sessionId, {
      sourcePath,
      size: source.size,
      modifiedMs: source.mtimeMs,
      digest,
      createdMs: Date.now(),
      manifest: archive.manifest,
    })
    return {
      sessionId,
      fileName: basename(sourcePath),
      profiles: archive.manifest.profiles.map((profile) => ({
        key: profile.key,
        name: profile.name,
        username: profile.username,
        includedFileCount: profile.files.length,
        containsPrivateKey: profile.containsPrivateKey,
      })),
    }
  }

  discard(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  async import(sessionId: string, profileKeys: readonly string[]): Promise<BundleImportResult> {
    this.pruneSessions()
    const pending = this.sessions.get(sessionId)
    if (!pending) throw new Error('This import preview expired. Select the bundle again.')
    this.sessions.delete(sessionId)
    const source = await stat(pending.sourcePath).catch(() => undefined)
    const digest = source ? await hashFile(pending.sourcePath).catch(() => undefined) : undefined
    if (
      !source ||
      source.size !== pending.size ||
      source.mtimeMs !== pending.modifiedMs ||
      digest !== pending.digest
    ) {
      throw new Error('The bundle changed after preview. Select it again before importing.')
    }
    const selected = new Set(profileKeys)
    if (!selected.size) throw new Error('Select at least one profile to import.')
    if (selected.size !== profileKeys.length) throw new Error('Profile selections must be unique.')
    const archive = await readArchive(pending.sourcePath).catch((error: unknown) => {
      throw sanitizeError(error, [pending.sourcePath])
    })
    const sourceProfiles = archive.manifest.profiles.filter((profile) => selected.has(profile.key))
    if (sourceProfiles.length !== selected.size)
      throw new Error('The bundle profile selection is invalid.')

    const existingNames = new Set(
      (await this.profiles.list()).map((profile) => profile.name.toLowerCase()),
    )
    const root = join(this.userDataPath(), 'profiles', 'imported')
    const staging = join(root, `.staging-${randomUUID()}`)
    const destination = join(root, randomUUID())
    const imports: BundleProfileImport[] = []
    let persisted = false
    try {
      await mkdir(staging, { recursive: true })
      for (const sourceProfile of sourceProfiles) {
        const id = randomUUID()
        const profileDirectory = join(staging, id)
        await mkdir(profileDirectory, { recursive: true })
        const configName = 'config.ovpn'
        await writeFile(
          join(profileDirectory, configName),
          archive.entries.get(sourceProfile.config)!,
          {
            flag: 'wx',
          },
        )
        for (const file of sourceProfile.files) {
          const relativeName = file.slice(sourceProfile.config.lastIndexOf('/') + 1)
          const output = join(profileDirectory, relativeName)
          await mkdir(dirname(output), { recursive: true })
          await writeFile(output, archive.entries.get(file)!, { flag: 'wx' })
        }
        imports.push({
          id,
          name: uniqueName(sourceProfile.name, existingNames),
          username: sourceProfile.username,
          configFilePath: join(destination, id, configName),
        })
      }
      await mkdir(root, { recursive: true })
      await rename(staging, destination)
      const imported = await this.profiles.importBundleProfiles(imports)
      persisted = true
      return { importedCount: imported.length, profiles: await this.profiles.list() }
    } catch (error) {
      await rm(staging, { recursive: true, force: true }).catch(() => undefined)
      if (!persisted) await rm(destination, { recursive: true, force: true }).catch(() => undefined)
      throw sanitizeError(error, [pending.sourcePath, staging, destination, root])
    }
  }

  async export(
    profileIds: readonly string[],
    destinationPath: string,
  ): Promise<BundleExportResult> {
    if (
      profileIds.length < 1 ||
      profileIds.length > MAX_PROFILES ||
      new Set(profileIds).size !== profileIds.length
    ) {
      throw new Error(`Select between 1 and ${MAX_PROFILES} unique profiles to export.`)
    }
    const profiles = await this.profiles.getBundleProfiles(profileIds)
    if (profiles.length !== profileIds.length)
      throw new Error('One or more selected profiles no longer exist.')
    const manifestProfiles: ManifestProfile[] = []
    const contents = new Map<string, Buffer>()
    let total = 0
    for (const [index, profile] of profiles.entries()) {
      const key = `profile-${index + 1}`
      const packaged = await packageProfile(profile, key).catch((error: unknown) => {
        throw sanitizeError(error, [profile.configFilePath])
      })
      manifestProfiles.push(packaged.manifest)
      for (const [name, data] of packaged.contents) {
        total += data.length
        if (total > MAX_TOTAL) throw new Error('Selected profiles exceed the 100 MB bundle limit.')
        contents.set(name, data)
      }
    }
    const manifest: Manifest = { format: FORMAT, version: VERSION, profiles: manifestProfiles }
    const manifestData = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)
    if (manifestData.length > MAX_SMALL_FILE) throw new Error('Bundle manifest exceeds 1 MB.')
    const output =
      extname(destinationPath).toLowerCase() === '.osch'
        ? destinationPath
        : `${destinationPath}.osch`
    const temporary = `${output}.${randomUUID()}.tmp`
    try {
      await writeZip(temporary, manifestData, contents)
      await rename(temporary, output)
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined)
      throw sanitizeError(error, [destinationPath, output, temporary])
    }
    return { exportedCount: profiles.length, fileName: basename(output) }
  }

  private pruneSessions(): void {
    const cutoff = Date.now() - SESSION_TTL_MS
    for (const [id, session] of this.sessions) {
      if (session.createdMs < cutoff) this.sessions.delete(id)
    }
  }
}

async function packageProfile(
  profile: BundleStoredProfile,
  key: string,
): Promise<{ manifest: ManifestProfile; contents: Map<string, Buffer> }> {
  const configStats = await stat(profile.configFilePath).catch(() => undefined)
  if (!configStats?.isFile()) throw new Error(`Profile "${profile.name}" configuration is missing.`)
  if (configStats.size > MAX_SMALL_FILE)
    throw new Error(`Profile "${profile.name}" configuration exceeds 1 MB.`)
  const source = await readFile(profile.configFilePath, 'utf8')
  if (/<auth-user-pass(?:\s[^>]*)?>/i.test(source)) {
    throw new Error(
      `Profile "${profile.name}" contains inline authentication data, which cannot be exported.`,
    )
  }
  const configDirectory = dirname(profile.configFilePath)
  const files: string[] = []
  const contents = new Map<string, Buffer>()
  let containsPrivateKey = /<private-key(?:\s[^>]*)?>[\s\S]*?<\/private-key>/i.test(source)
  let dependencyIndex = 0
  const rewrittenLines: string[] = []
  for (const line of source.split(/\r?\n/)) {
    const tokens = tokenize(line)
    if (!tokens.length) {
      rewrittenLines.push(line)
      continue
    }
    const directive = tokens[0].value.replace(/^--/, '').toLowerCase()
    if (UNSAFE_DIRECTIVES.has(directive)) {
      throw new Error(`Profile "${profile.name}" contains unsupported directive "${directive}".`)
    }
    if (directive === 'auth-user-pass' && tokens.length > 1) {
      throw new Error(
        `Profile "${profile.name}" references an authentication file; remove that path first.`,
      )
    }
    if (!FILE_DIRECTIVES.has(directive) || tokens.length < 2) {
      rewrittenLines.push(line)
      continue
    }
    if (tokens.length > (directive === 'tls-auth' ? 3 : 2)) {
      throw new Error(
        `Directive "${directive}" in profile "${profile.name}" has unsupported arguments.`,
      )
    }
    const reference = tokens[1].value
    const dependency = resolveDependency(configDirectory, reference, profile.name)
    const dependencyStats = await lstat(dependency).catch(() => undefined)
    if (!dependencyStats?.isFile())
      throw new Error(`Referenced file "${reference}" is missing or not a regular file.`)
    if (dependencyStats.size > MAX_DEPENDENCY)
      throw new Error(`Referenced file "${reference}" exceeds 20 MB.`)
    dependencyIndex += 1
    const safeBase = basename(dependency).replace(/[^A-Za-z0-9._-]/g, '_') || 'file'
    const archivePath = `profiles/${key}/files/${dependencyIndex}-${safeBase}`
    contents.set(archivePath, await readFile(dependency))
    files.push(archivePath)
    if (directive === 'key' || directive === 'pkcs12') containsPrivateKey = true
    const replacement = tokens[1].quote
      ? `${tokens[1].quote}${`files/${dependencyIndex}-${safeBase}`}${tokens[1].quote}`
      : `files/${dependencyIndex}-${safeBase}`
    rewrittenLines.push(
      `${line.slice(0, tokens[1].start)}${replacement}${line.slice(tokens[1].end)}`,
    )
  }
  const configPath = `profiles/${key}/config.ovpn`
  contents.set(configPath, Buffer.from(rewrittenLines.join('\n')))
  return {
    manifest: {
      key,
      name: profile.name,
      username: profile.username,
      config: configPath,
      files,
      containsPrivateKey,
    },
    contents,
  }
}

function resolveDependency(
  configDirectory: string,
  reference: string,
  profileName: string,
): string {
  if (
    !reference ||
    reference.includes('\0') ||
    isAbsolute(reference) ||
    /^[A-Za-z]:/.test(reference) ||
    /^(?:\\\\|\/\/|\\[?.]\\)/.test(reference) ||
    /[$%]/.test(reference)
  ) {
    throw new Error(`Profile "${profileName}" contains unsafe file reference "${reference}".`)
  }
  const resolved = resolve(configDirectory, reference)
  const beneath = relative(configDirectory, resolved)
  if (!beneath || beneath === '..' || beneath.startsWith(`..${sep}`) || isAbsolute(beneath)) {
    throw new Error(`Profile "${profileName}" contains an escaping file reference "${reference}".`)
  }
  return resolved
}

function tokenize(line: string): Token[] {
  const tokens: Token[] = []
  let index = 0
  while (index < line.length) {
    while (/\s/.test(line[index] ?? '')) index += 1
    if (index >= line.length || line[index] === '#' || line[index] === ';') break
    const start = index
    const quote =
      line[index] === '"' || line[index] === "'" ? (line[index++] as '"' | "'") : undefined
    let value = ''
    while (index < line.length) {
      const character = line[index]
      if (
        quote ? character === quote : /\s/.test(character) || character === '#' || character === ';'
      )
        break
      if (character === '\\' && index + 1 < line.length) {
        index += 1
        value += line[index]
      } else value += character
      index += 1
    }
    if (quote) {
      if (line[index] !== quote)
        throw new Error('OpenVPN configuration contains an unterminated quoted token.')
      index += 1
    }
    tokens.push({ value, start, end: index, ...(quote ? { quote } : {}) })
    if (!quote && (line[index] === '#' || line[index] === ';')) break
  }
  return tokens
}

async function readArchive(filePath: string): Promise<Archive> {
  const zip = await openZip(filePath)
  const entries = new Map<string, Buffer>()
  const caseNames = new Set<string>()
  let count = 0
  let total = 0
  try {
    await new Promise<void>((resolvePromise, reject) => {
      zip.on('error', reject)
      zip.on('end', resolvePromise)
      zip.on('entry', (entry: Entry) => {
        void (async () => {
          try {
            count += 1
            validateEntry(entry, count, caseNames)
            if (entry.fileName.endsWith('/')) {
              zip.readEntry()
              return
            }
            total += entry.uncompressedSize
            if (total > MAX_TOTAL) throw new Error('Bundle expands beyond the 100 MB limit.')
            const limit =
              entry.fileName === 'manifest.json' || entry.fileName.endsWith('/config.ovpn')
                ? MAX_SMALL_FILE
                : MAX_DEPENDENCY
            if (entry.uncompressedSize > limit)
              throw new Error(`Bundle entry "${entry.fileName}" is too large.`)
            if (
              entry.compressedSize > 0 &&
              entry.uncompressedSize / entry.compressedSize > MAX_COMPRESSION_RATIO
            ) {
              throw new Error(`Bundle entry "${entry.fileName}" has an unsafe compression ratio.`)
            }
            entries.set(entry.fileName, await readZipEntry(zip, entry, limit))
            zip.readEntry()
          } catch (error) {
            reject(error)
            zip.close()
          }
        })()
      })
      zip.readEntry()
    })
  } finally {
    zip.close()
  }
  const manifestData = entries.get('manifest.json')
  if (!manifestData) throw new Error('Bundle is missing manifest.json.')
  const manifest = validateManifest(parseJson(manifestData))
  const expected = new Set(['manifest.json'])
  for (const profile of manifest.profiles) {
    validateArchivedProfile(profile, entries)
    expected.add(profile.config)
    profile.files.forEach((file) => expected.add(file))
  }
  for (const name of entries.keys()) {
    if (!expected.has(name)) throw new Error(`Bundle contains undeclared entry "${name}".`)
  }
  return { manifest, entries }
}

function validateEntry(entry: Entry, count: number, caseNames: Set<string>): void {
  if (count > MAX_ENTRIES) throw new Error(`Bundle contains more than ${MAX_ENTRIES} entries.`)
  const name = entry.fileName
  if (
    !name ||
    name.includes('\\') ||
    name.includes(':') ||
    name.startsWith('/') ||
    name.includes('\0')
  ) {
    throw new Error(`Bundle contains unsafe entry path "${name}".`)
  }
  const parts = name.split('/').filter(Boolean)
  if (
    parts.some(
      (part) =>
        part === '.' || part === '..' || RESERVED_WINDOWS_NAME.test(part) || /[. ]$/.test(part),
    )
  ) {
    throw new Error(`Bundle contains unsafe entry path "${name}".`)
  }
  const folded = name.toLowerCase()
  if (caseNames.has(folded))
    throw new Error(`Bundle contains a duplicate or case-colliding entry "${name}".`)
  caseNames.add(folded)
  if ((entry.generalPurposeBitFlag & 1) !== 0)
    throw new Error('Encrypted bundle entries are not supported.')
  if (entry.compressionMethod !== 0 && entry.compressionMethod !== 8)
    throw new Error('Bundle uses an unsupported compression method.')
  const unixType = (entry.externalFileAttributes >>> 16) & 0xf000
  if (unixType === 0xa000) throw new Error('Bundle symbolic links are not supported.')
}

function validateManifest(value: unknown): Manifest {
  if (!isRecord(value) || !hasExactKeys(value, ['format', 'version', 'profiles']))
    throw new Error('Bundle manifest has an invalid shape.')
  if (value.format !== FORMAT || value.version !== VERSION)
    throw new Error(`Bundle format or version is unsupported; expected version ${VERSION}.`)
  if (
    !Array.isArray(value.profiles) ||
    value.profiles.length < 1 ||
    value.profiles.length > MAX_PROFILES
  ) {
    throw new Error(`Bundle must contain between 1 and ${MAX_PROFILES} profiles.`)
  }
  const keys = new Set<string>()
  const profiles = value.profiles.map((item): ManifestProfile => {
    if (
      !isRecord(item) ||
      !hasExactKeys(item, ['key', 'name', 'username', 'config', 'files', 'containsPrivateKey'])
    )
      throw new Error('Bundle profile manifest has an invalid shape.')
    if (
      typeof item.key !== 'string' ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(item.key) ||
      keys.has(item.key)
    )
      throw new Error('Bundle profile key is invalid or duplicated.')
    keys.add(item.key)
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 100)
      throw new Error('Bundle profile name is invalid.')
    if (
      typeof item.username !== 'string' ||
      item.username.length > 256 ||
      /[\r\n\0]/.test(item.username)
    )
      throw new Error('Bundle profile username is invalid.')
    if (
      typeof item.config !== 'string' ||
      !Array.isArray(item.files) ||
      !item.files.every((file) => typeof file === 'string') ||
      typeof item.containsPrivateKey !== 'boolean'
    )
      throw new Error('Bundle profile file list is invalid.')
    return item as unknown as ManifestProfile
  })
  return { format: FORMAT, version: VERSION, profiles }
}

function validateArchivedProfile(profile: ManifestProfile, entries: Map<string, Buffer>): void {
  const root = `profiles/${profile.key}/`
  if (profile.config !== `${root}config.ovpn` || !entries.has(profile.config))
    throw new Error(`Profile "${profile.name}" has an invalid or missing configuration entry.`)
  const listed = new Set<string>()
  for (const file of profile.files) {
    if (!file.startsWith(`${root}files/`) || listed.has(file) || !entries.has(file))
      throw new Error(`Profile "${profile.name}" has an invalid dependency entry.`)
    listed.add(file)
  }
  const config = entries.get(profile.config)!.toString('utf8')
  if (/<auth-user-pass(?:\s[^>]*)?>/i.test(config)) {
    throw new Error('Imported profiles cannot contain inline authentication data.')
  }
  let containsPrivateKey = /<private-key(?:\s[^>]*)?>[\s\S]*?<\/private-key>/i.test(config)
  for (const line of config.split(/\r?\n/)) {
    const tokens = tokenize(line)
    if (!tokens.length) continue
    const directive = tokens[0].value.replace(/^--/, '').toLowerCase()
    if (UNSAFE_DIRECTIVES.has(directive))
      throw new Error(`Imported profile contains unsupported directive "${directive}".`)
    if (directive === 'auth-user-pass' && tokens.length > 1)
      throw new Error('Imported profiles cannot reference authentication files.')
    if (FILE_DIRECTIVES.has(directive) && tokens.length > 1) {
      const expected = `${root}${tokens[1].value}`
      if (!listed.has(expected))
        throw new Error(`Imported profile references undeclared file "${tokens[1].value}".`)
      if (directive === 'key' || directive === 'pkcs12') containsPrivateKey = true
    }
  }
  if (profile.containsPrivateKey !== containsPrivateKey) {
    throw new Error(`Profile "${profile.name}" has incorrect private-key metadata.`)
  }
}

function openZip(path: string): Promise<ZipFile> {
  return new Promise((resolvePromise, reject) => {
    yauzl.open(
      path,
      { lazyEntries: true, decodeStrings: true, validateEntrySizes: true },
      (error, zip) => {
        if (error || !zip)
          reject(new Error(`Unable to open bundle: ${error?.message ?? 'invalid ZIP archive'}`))
        else resolvePromise(zip)
      },
    )
  })
}

function readZipEntry(zip: ZipFile, entry: Entry, limit: number): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error || !stream) return reject(error ?? new Error('Unable to read bundle entry.'))
      const chunks: Buffer[] = []
      let size = 0
      stream.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > limit) stream.destroy(new Error('Bundle entry expanded beyond its size limit.'))
        else chunks.push(chunk)
      })
      stream.on('error', reject)
      stream.on('end', () => resolvePromise(Buffer.concat(chunks)))
    })
  })
}

function writeZip(path: string, manifest: Buffer, entries: Map<string, Buffer>): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const zip = new yazl.ZipFile()
    const stableTime = new Date('1980-01-01T00:00:00.000Z')
    zip.addBuffer(manifest, 'manifest.json', { mtime: stableTime, mode: 0o100600 })
    for (const [name, data] of entries)
      zip.addBuffer(data, name, { mtime: stableTime, mode: 0o100600 })
    const output = createWriteStream(path, { flags: 'wx' })
    output.on('error', reject)
    output.on('close', resolvePromise)
    zip.outputStream.on('error', reject)
    zip.outputStream.pipe(output)
    zip.end()
  })
}

function hashFile(path: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash('sha256')
    const input = createReadStream(path)
    input.on('error', reject)
    input.on('data', (chunk) => hash.update(chunk))
    input.on('end', () => resolvePromise(hash.digest('hex')))
  })
}

function uniqueName(name: string, used: Set<string>): string {
  let candidate = name.trim()
  let suffix = 2
  while (used.has(candidate.toLowerCase())) {
    const marker = ` (${suffix++})`
    candidate = `${name.trim().slice(0, 100 - marker.length)}${marker}`
  }
  used.add(candidate.toLowerCase())
  return candidate
}

function parseJson(data: Buffer): unknown {
  try {
    return JSON.parse(data.toString('utf8')) as unknown
  } catch {
    throw new Error('Bundle manifest is not valid JSON.')
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  return (
    actual.length === keys.length && [...keys].sort().every((key, index) => actual[index] === key)
  )
}

function sanitizeError(error: unknown, paths: readonly string[]): Error {
  let message = error instanceof Error ? error.message : String(error)
  for (const path of paths) {
    if (path) message = message.split(path).join('[protected path]')
  }
  return new Error(message)
}
