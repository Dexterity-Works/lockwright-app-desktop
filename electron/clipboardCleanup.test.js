/* eslint-env jest */

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  writeFileSync: jest.fn()
}))

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'token-1')
}))

jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    on: jest.fn(),
    stdin: { on: jest.fn(), end: jest.fn() },
    unref: jest.fn()
  }))
}))

const scheduleWith = (isWindows, overrides = {}) => {
  const { scheduleClipboardCleanup } = require('./clipboardCleanup.cjs')
  return scheduleClipboardCleanup({
    app: {
      getPath: jest.fn((name) =>
        name === 'temp' ? 'C:\\Temp' : `/unknown/${name}`
      )
    },
    // Electron 44: clipboard.readText() resolves asynchronously.
    clipboard: { readText: jest.fn(() => Promise.resolve('secret')) },
    logger: { warn: jest.fn() },
    isWindows,
    text: 'secret',
    delayMs: 30000,
    ...overrides
  })
}

describe('clipboardCleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([
    ['Windows', true],
    ['Unix', false]
  ])(
    'hands the secret to the %s helper over stdin, never a file or argv',
    async (_label, isWindows) => {
      const fs = require('fs')
      const { spawn } = require('child_process')

      await expect(scheduleWith(isWindows)).resolves.toBe(true)

      for (const [, data] of fs.writeFileSync.mock.calls) {
        expect(String(data)).not.toContain('secret')
      }
      const [, args, options] = spawn.mock.calls[0]
      expect(args.join(' ')).not.toContain('secret')
      expect(options.stdio[0]).toBe('pipe')
      expect(spawn.mock.results[0].value.stdin.end).toHaveBeenCalledWith(
        'secret',
        'utf8'
      )
    }
  )

  it('uses the Windows script', async () => {
    const path = require('path')
    const fs = require('fs')
    const { spawn } = require('child_process')

    await expect(scheduleWith(true)).resolves.toBe(true)
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join('C:\\Temp', 'pearpass-clipboard-cleanup-current.token'),
      'token-1',
      { encoding: 'utf8', mode: 0o600 }
    )
    expect(spawn).toHaveBeenCalledWith(
      'powershell.exe',
      expect.arrayContaining([
        '-NoProfile',
        '-WindowStyle',
        'Hidden',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        path.join(process.cwd(), 'electron', 'clipboardCleanup.windows.ps1')
      ]),
      expect.objectContaining({
        detached: true,
        windowsHide: true
      })
    )
  })

  it('awaits the async clipboard read when no text is given', async () => {
    const { spawn } = require('child_process')

    await expect(scheduleWith(false, { text: undefined })).resolves.toBe(true)
    expect(spawn.mock.results[0].value.stdin.end).toHaveBeenCalledWith(
      'secret',
      'utf8'
    )
  })

  it('schedules nothing when the clipboard is empty', async () => {
    const { spawn } = require('child_process')

    await expect(
      scheduleWith(false, {
        text: undefined,
        clipboard: { readText: jest.fn(() => Promise.resolve('')) }
      })
    ).resolves.toBe(false)
    expect(spawn).not.toHaveBeenCalled()
  })
})
