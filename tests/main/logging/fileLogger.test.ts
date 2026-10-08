import { beforeEach, describe, expect, it, vi } from 'vitest'

const fs = vi.hoisted(() => ({
  appendFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  renameSync: vi.fn(),
  statSync: vi.fn(),
}))

vi.mock('node:fs', () => ({ ...fs, default: fs }))

import { FileLogger } from '../../../src/main/logging/fileLogger'

describe('FileLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fs.existsSync.mockReturnValue(false)
    fs.statSync.mockReturnValue({ size: 0 })
  })

  it.each([
    ['debug', 'DEBUG'],
    ['info', 'INFO'],
    ['warn', 'WARN'],
    ['error', 'ERROR'],
  ] as const)('writes %s messages with their level', (method, level) => {
    const logger = new FileLogger(() => String.raw`C:\logs`)

    logger[method]('diagnostic context')

    expect(fs.mkdirSync).toHaveBeenCalledWith(String.raw`C:\logs`, { recursive: true })
    expect(fs.appendFileSync).toHaveBeenCalledOnce()
    const [path, line, encoding] = fs.appendFileSync.mock.calls[0]
    expect(path).toMatch(/openvpn\.log$/)
    expect(line).toMatch(
      new RegExp(`^\\d{4}-\\d{2}-\\d{2}T.* \\[${level}\\] diagnostic context\\n$`),
    )
    expect(encoding).toBe('utf8')
  })

  it('rotates a full log before appending the new entry', () => {
    fs.existsSync.mockReturnValue(true)
    fs.statSync.mockReturnValue({ size: 1024 * 1024 })
    const logger = new FileLogger(() => String.raw`C:\logs`)

    logger.info('after rotation')

    expect(fs.renameSync).toHaveBeenCalledOnce()
    const [currentPath, previousPath] = fs.renameSync.mock.calls[0]
    expect(currentPath).toMatch(/openvpn\.log$/)
    expect(previousPath).toMatch(/openvpn\.previous\.log$/)
    expect(fs.renameSync.mock.invocationCallOrder[0]).toBeLessThan(
      fs.appendFileSync.mock.invocationCallOrder[0],
    )
  })

  it('does not rotate a log below the size limit', () => {
    fs.existsSync.mockReturnValue(true)
    fs.statSync.mockReturnValue({ size: 1024 * 1024 - 1 })

    new FileLogger(() => String.raw`C:\logs`).warn('still fits')

    expect(fs.renameSync).not.toHaveBeenCalled()
    expect(fs.appendFileSync).toHaveBeenCalledOnce()
  })

  it('never lets filesystem failures escape into connection handling', () => {
    fs.mkdirSync.mockImplementation(() => {
      throw new Error('disk unavailable')
    })

    expect(() => new FileLogger(() => String.raw`C:\logs`).error('failure')).not.toThrow()
    expect(fs.appendFileSync).not.toHaveBeenCalled()
  })
})
