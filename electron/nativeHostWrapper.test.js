/* eslint-env jest */

jest.mock('fs/promises', () => ({
  access: jest.fn(),
  writeFile: jest.fn(),
  chmod: jest.fn(),
  rename: jest.fn()
}))

const fsp = require('fs/promises')

const fs = require('fs')
const path = require('path')

const {
  buildWrapperContent,
  nativeHostKillCommand,
  writeWrapperAtomic,
  refreshNativeHostWrapperIfPresent,
  NATIVE_HOST_PROCESS_PATTERN
} = require('./nativeHostWrapper.cjs')

const EXEC_PATH = '/mock/electron/Lockwright'
const BRIDGE_PATH = '/mock/dist/native-messaging-bridge.bundle.cjs'
const WRAPPER_PATH = '/mock/userData/native-messaging/lockwright-native-host.sh'

describe('buildWrapperContent', () => {
  it('emits a bash wrapper with ELECTRON_RUN_AS_NODE for darwin', () => {
    const content = buildWrapperContent({
      platform: 'darwin',
      isFlatpak: false,
      electronExecPath: EXEC_PATH,
      bridgeScriptPath: BRIDGE_PATH
    })
    expect(content).toContain('#!/bin/bash')
    expect(content).toContain('ELECTRON_RUN_AS_NODE=1')
    expect(content).toContain(EXEC_PATH)
    expect(content).toContain(BRIDGE_PATH)
  })

  it('emits a bash wrapper with ELECTRON_RUN_AS_NODE for linux', () => {
    const content = buildWrapperContent({
      platform: 'linux',
      isFlatpak: false,
      electronExecPath: EXEC_PATH,
      bridgeScriptPath: BRIDGE_PATH
    })
    expect(content).toContain('#!/bin/bash')
    expect(content).toContain('ELECTRON_RUN_AS_NODE=1')
    expect(content).toContain(EXEC_PATH)
  })

  it('emits a flatpak re-entry wrapper when isFlatpak is true', () => {
    const content = buildWrapperContent({
      platform: 'linux',
      isFlatpak: true,
      electronExecPath: EXEC_PATH,
      bridgeScriptPath: BRIDGE_PATH
    })
    expect(content).toContain('flatpak')
    expect(content).toContain('works.dexterity.lockwright')
    expect(content).toContain('--command=lockwright-native-host')
    // In-sandbox paths are resolved by `flatpak run`, not baked into the wrapper.
    expect(content).not.toContain(EXEC_PATH)
    expect(content).not.toContain(BRIDGE_PATH)
  })

  it('emits a cmd wrapper for win32', () => {
    const content = buildWrapperContent({
      platform: 'win32',
      isFlatpak: false,
      electronExecPath: EXEC_PATH,
      bridgeScriptPath: BRIDGE_PATH
    })
    expect(content).toContain('@echo off')
    expect(content).toContain('set ELECTRON_RUN_AS_NODE=1')
    expect(content).toContain(EXEC_PATH)
  })

  it('throws on unsupported platforms', () => {
    expect(() =>
      buildWrapperContent({
        platform: 'aix',
        isFlatpak: false,
        electronExecPath: EXEC_PATH,
        bridgeScriptPath: BRIDGE_PATH
      })
    ).toThrow('Unsupported platform: aix')
  })
})

describe('writeWrapperAtomic', () => {
  beforeEach(() => jest.clearAllMocks())

  it('writes to a tmp path, chmods, then renames into place on unix', async () => {
    await writeWrapperAtomic(WRAPPER_PATH, 'content', 'linux')
    const tmpPath = fsp.writeFile.mock.calls[0][0]
    expect(tmpPath.startsWith(`${WRAPPER_PATH}.tmp-`)).toBe(true)
    expect(fsp.chmod).toHaveBeenCalledWith(tmpPath, 0o755)
    expect(fsp.rename).toHaveBeenCalledWith(tmpPath, WRAPPER_PATH)
  })

  it('skips chmod on win32', async () => {
    await writeWrapperAtomic(WRAPPER_PATH, 'content', 'win32')
    expect(fsp.chmod).not.toHaveBeenCalled()
    expect(fsp.rename).toHaveBeenCalled()
  })
})

describe('refreshNativeHostWrapperIfPresent', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns not-present and does not write when wrapper is absent', async () => {
    fsp.access.mockRejectedValueOnce(new Error('ENOENT'))
    const result = await refreshNativeHostWrapperIfPresent({
      executablePath: WRAPPER_PATH,
      electronExecPath: EXEC_PATH,
      bridgeScriptPath: BRIDGE_PATH,
      platform: 'linux',
      isFlatpak: false
    })
    expect(result).toEqual({ refreshed: false, reason: 'not-present' })
    expect(fsp.writeFile).not.toHaveBeenCalled()
    expect(fsp.rename).not.toHaveBeenCalled()
  })

  it('rewrites atomically when wrapper exists', async () => {
    fsp.access.mockResolvedValueOnce()
    const result = await refreshNativeHostWrapperIfPresent({
      executablePath: WRAPPER_PATH,
      electronExecPath: EXEC_PATH,
      bridgeScriptPath: BRIDGE_PATH,
      platform: 'linux',
      isFlatpak: false
    })
    expect(result).toEqual({ refreshed: true })
    const writeCall = fsp.writeFile.mock.calls[0]
    expect(writeCall[0].startsWith(`${WRAPPER_PATH}.tmp-`)).toBe(true)
    expect(writeCall[1]).toContain(EXEC_PATH)
    expect(fsp.rename).toHaveBeenCalledWith(writeCall[0], WRAPPER_PATH)
  })
})

describe('NATIVE_HOST_PROCESS_PATTERN', () => {
  // Live AppImage host argv from a Fedora session where the previous
  // squashfs had already unmounted. pkill -f must match this, not the
  // unbundled package name.
  const packagedHostArgv =
    '/tmp/.mount_LockwrhaMfmP/lockwright-app-desktop.bin /tmp/.mount_LockwrhaMfmP/resources/app/dist/native-messaging-bridge.bundle.cjs'
  const appArgv =
    '/tmp/.mount_LockwrKGKfJf/lockwright-app-desktop.bin --no-sandbox'

  it('matches a packaged native-host argv and not the desktop app', () => {
    expect(packagedHostArgv).toContain(NATIVE_HOST_PROCESS_PATTERN)
    expect(appArgv).not.toContain(NATIVE_HOST_PROCESS_PATTERN)
  })

  it('is what main.cjs kills after rewriting the AppImage wrapper', () => {
    const main = fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8')
    const afterRefresh = main.slice(
      main.indexOf('await refreshNativeHostWrapper()')
    )
    expect(afterRefresh).toMatch(/await killNativeHostProcesses\(\)/)
  })
})

describe('test profile wrapper', () => {
  const build = (platform, profile) =>
    buildWrapperContent({
      platform,
      isFlatpak: false,
      electronExecPath: EXEC_PATH,
      bridgeScriptPath: BRIDGE_PATH,
      profile
    })

  it('is byte-for-byte the shipped wrapper when no profile is set', () => {
    const shippedUnix = `#!/bin/bash
# Lockwright Native Messaging Host
# Runs the native messaging bridge via Electron's embedded Node.js

export ELECTRON_RUN_AS_NODE=1
exec "${EXEC_PATH}" "${BRIDGE_PATH}"
`
    const shippedWin = `@echo off
REM Lockwright Native Messaging Host
REM Runs the native messaging bridge via Electron's embedded Node.js

set ELECTRON_RUN_AS_NODE=1
"${EXEC_PATH}" "${BRIDGE_PATH}"
`
    expect(build('linux')).toBe(shippedUnix)
    expect(build('darwin', null)).toBe(shippedUnix)
    expect(build('win32')).toBe(shippedWin)
  })

  it('bakes the profile into the argv of a unix wrapper', () => {
    expect(build('linux', 'test1')).toContain(
      `export ELECTRON_RUN_AS_NODE=1
exec "${EXEC_PATH}" "${BRIDGE_PATH}" --lockwright-profile=test1
`
    )
  })

  it('bakes the profile into the argv of a cmd wrapper', () => {
    expect(build('win32', 'test1')).toContain(
      `set ELECTRON_RUN_AS_NODE=1
"${EXEC_PATH}" "${BRIDGE_PATH}" --lockwright-profile=test1
`
    )
  })

  it('refreshes a present wrapper with the profile', async () => {
    jest.clearAllMocks()
    fsp.access.mockResolvedValueOnce()
    await refreshNativeHostWrapperIfPresent({
      executablePath: WRAPPER_PATH,
      electronExecPath: EXEC_PATH,
      bridgeScriptPath: BRIDGE_PATH,
      platform: 'linux',
      isFlatpak: false,
      profile: 'test1'
    })
    expect(fsp.writeFile.mock.calls[0][1]).toContain(
      '--lockwright-profile=test1'
    )
  })
})

describe('nativeHostKillCommand', () => {
  const bridge =
    '/opt/Lockwright/resources/app/dist/native-messaging-bridge.bundle.cjs'
  const installedHost = `/opt/Lockwright/lockwright-app-desktop ${bridge}`
  const test1Host = `/home/u/src/node_modules/electron/dist/electron ${bridge} --lockwright-profile=test1`
  const test10Host = `${installedHost} --lockwright-profile=test10`
  const pkillPattern = (cmd) => cmd.match(/^pkill -f "(.*)"$/)[1]

  it('is the shipped global kill when no profile is set', () => {
    expect(nativeHostKillCommand('linux')).toBe(
      'pkill -f "native-messaging-bridge.bundle"'
    )
    expect(nativeHostKillCommand('win32', null)).toBe(
      `powershell -NoProfile -Command "Get-WmiObject Win32_Process | Where-Object {$_.CommandLine -like '*native-messaging-bridge.bundle*'} | ForEach-Object { taskkill /PID $_.ProcessId /F }"`
    )
  })

  it("under a profile matches only that profile's bridges", () => {
    const pattern = new RegExp(
      pkillPattern(nativeHostKillCommand('linux', 'test1'))
    )
    expect(pattern.test(test1Host)).toBe(true)
    expect(pattern.test(installedHost)).toBe(false)
    expect(pattern.test(test10Host)).toBe(false)
    expect(nativeHostKillCommand('darwin', 'test1')).toBe(
      nativeHostKillCommand('linux', 'test1')
    )
  })

  it('under a profile anchors the Windows match at the profile argument', () => {
    const cmd = nativeHostKillCommand('win32', 'test1')
    expect(cmd).toContain(
      "-like '*native-messaging-bridge.bundle* --lockwright-profile=test1'"
    )
    expect(cmd).not.toContain("bundle*'")
  })
})
