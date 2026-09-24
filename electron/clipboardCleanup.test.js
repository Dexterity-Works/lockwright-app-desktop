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

const scheduleWith = (isWindows) => {
  const { scheduleClipboardCleanup } = require('./clipboardCleanup.cjs')
  return scheduleClipboardCleanup({
    app: {
      getPath: jest.fn((name) =>
        name === 'temp' ? 'C:\\Temp' : `/unknown/${name}`
      )
    },
    clipboard: { readText: jest.fn(() => 'secret') },
    logger: { warn: jest.fn() },
    isWindows,
    text: 'secret',
    delayMs: 30000
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
    (_label, isWindows) => {
      const fs = require('fs')
      const { spawn } = require('child_process')

      expect(scheduleWith(isWindows)).toBe(true)

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

  it('uses the Windows script', () => {
    const path = require('path')
    const fs = require('fs')
    const { spawn } = require('child_process')

    expect(scheduleWith(true)).toBe(true)
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
})
