/* eslint-env jest */

const fs = require('fs')
const os = require('os')
const path = require('path')

const { createNativeMessaging } = require('./nativeMessaging.cjs')
const devicePreferences = require('../src/utils/devicePreferences.cjs')

function fakeIpcMain() {
  const handlers = new Map()
  return {
    handle: (channel, fn) => handlers.set(channel, fn),
    invoke: (channel, payload) => handlers.get(channel)({}, payload)
  }
}

const silentLogger = {
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}

/**
 * A stand-in for dist/native-messaging-main.bundle.cjs: records the deps
 * the server was built with and lets tests drive them.
 */
function fakeModule() {
  const state = { server: null }
  class NativeMessagingIPCServer {
    constructor(client, deps) {
      this.client = client
      this.deps = deps
      this.isRunning = false
      state.server = this
    }

    async start() {
      this.isRunning = true
    }

    async stop() {
      this.isRunning = false
    }
  }
  return {
    state,
    NativeMessagingIPCServer,
    bindLogger: jest.fn(),
    setupNativeMessaging: jest.fn().mockResolvedValue({ success: true }),
    killNativeMessagingHostProcesses: jest.fn().mockResolvedValue(undefined),
    cleanupNativeMessaging: jest.fn().mockResolvedValue(undefined),
    getOrCreateIdentity: jest.fn().mockResolvedValue({
      ed25519PublicKey: 'pub',
      creationDate: '2026-01-01'
    }),
    resetIdentity: jest.fn().mockResolvedValue({
      ed25519PublicKey: 'pub2',
      creationDate: '2026-02-02'
    }),
    getPairingToken: jest.fn().mockResolvedValue('123456-ABCD'),
    getFingerprint: jest.fn(() => 'fp'),
    getPairedClients: jest.fn().mockResolvedValue([{ publicKey: 'c1' }]),
    removeClientIdentity: jest.fn().mockResolvedValue([]),
    closeSessionsForClient: jest.fn(() => 1),
    clearAllSessions: jest.fn(() => 2)
  }
}

describe('createNativeMessaging', () => {
  let tmpDir
  let mod
  let ipcMain
  let send
  let client
  let nm

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-main-'))
    mod = fakeModule()
    ipcMain = fakeIpcMain()
    send = jest.fn()
    client = { encryptionAdd: jest.fn().mockResolvedValue(undefined) }
    nm = createNativeMessaging({
      logger: silentLogger,
      getVaultClient: () => client,
      getStorageDir: () => tmpDir,
      getExecPath: () => '/exec',
      getBridgePath: () => '/bridge.cjs',
      send,
      loadModule: () => mod
    })
    nm.register(ipcMain)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    jest.clearAllMocks()
  })

  it('mirrors a well-typed renderer snapshot and ignores the rest', async () => {
    await ipcMain.invoke('nm:prefs', {
      autoLockEnabled: false,
      autoLockTimeoutMs: 60000
    })
    expect(nm.getPreferences()).toEqual({
      nativeMessagingEnabled: false,
      autoLockEnabled: false,
      autoLockTimeoutMs: 60000
    })

    await ipcMain.invoke('nm:prefs', {
      nativeMessagingEnabled: 'yes',
      autoLockEnabled: 1,
      autoLockTimeoutMs: -5
    })
    expect(nm.getPreferences()).toEqual({
      nativeMessagingEnabled: false,
      autoLockEnabled: false,
      autoLockTimeoutMs: 60000
    })

    await ipcMain.invoke('nm:prefs', { autoLockTimeoutMs: null })
    expect(nm.getPreferences().autoLockTimeoutMs).toBeNull()
  })

  it('starts the server on the first push that says enabled, once', async () => {
    expect(await ipcMain.invoke('nm:isRunning')).toBe(false)

    const first = await ipcMain.invoke('nm:prefs', {
      nativeMessagingEnabled: true
    })
    expect(first).toEqual({ running: true })
    expect(mod.bindLogger).toHaveBeenCalledWith(silentLogger)
    const server = mod.state.server
    expect(server.client).toBe(client)

    await ipcMain.invoke('nm:prefs', { nativeMessagingEnabled: true })
    expect(mod.state.server).toBe(server)

    await ipcMain.invoke('nm:stop')
    expect(await ipcMain.invoke('nm:isRunning')).toBe(false)
  })

  it('gives the server a live view of the preferences and a way back', async () => {
    await ipcMain.invoke('nm:start')
    const { preferences } = mod.state.server.deps

    await ipcMain.invoke('nm:prefs', { autoLockTimeoutMs: 5000 })
    expect(preferences.get().autoLockTimeoutMs).toBe(5000)

    preferences.set({ autoLockEnabled: false })
    expect(nm.getPreferences().autoLockEnabled).toBe(false)
  })

  it('forwards server events to the renderer as nm:event', async () => {
    await ipcMain.invoke('nm:start')
    mod.state.server.deps.emit('reset-timer')
    mod.state.server.deps.emit('apply-auto-lock-timeout', {
      autoLockTimeoutMs: 1
    })
    expect(send).toHaveBeenNthCalledWith(1, 'nm:event', {
      type: 'reset-timer',
      payload: undefined
    })
    expect(send).toHaveBeenNthCalledWith(2, 'nm:event', {
      type: 'apply-auto-lock-timeout',
      payload: { autoLockTimeoutMs: 1 }
    })
  })

  it('persists confirmed client keys in device preferences', async () => {
    await ipcMain.invoke('nm:start')
    const { clientKeyStore } = mod.state.server.deps

    expect(clientKeyStore.read()).toEqual([])
    clientKeyStore.write(['ext-pub'])
    expect(devicePreferences.read(tmpDir).nmClientPublicKeys).toEqual([
      'ext-pub'
    ])
    expect(clientKeyStore.read()).toEqual(['ext-pub'])
  })

  it('sets up the native host and kills stale hosts only on success', async () => {
    await expect(ipcMain.invoke('nm:setup')).resolves.toEqual({
      success: true
    })
    expect(mod.setupNativeMessaging).toHaveBeenCalledWith({
      userDataPath: tmpDir,
      execPath: '/exec',
      bridgePath: '/bridge.cjs'
    })
    expect(mod.killNativeMessagingHostProcesses).toHaveBeenCalledTimes(1)

    mod.setupNativeMessaging.mockResolvedValueOnce({
      success: false,
      message: 'nope'
    })
    await expect(ipcMain.invoke('nm:setup')).resolves.toEqual({
      success: false,
      message: 'nope'
    })
    expect(mod.killNativeMessagingHostProcesses).toHaveBeenCalledTimes(1)
  })

  it('answers the pairing channels against the vault client', async () => {
    await expect(ipcMain.invoke('nm:identity', {})).resolves.toEqual({
      pairingToken: '123456-ABCD',
      fingerprint: 'fp',
      creationDate: '2026-01-01'
    })
    expect(mod.getOrCreateIdentity).toHaveBeenCalledWith(client)

    await expect(
      ipcMain.invoke('nm:identity', { reset: true })
    ).resolves.toMatchObject({ creationDate: '2026-02-02' })
    expect(mod.resetIdentity).toHaveBeenCalledWith(client)

    await ipcMain.invoke('nm:markPairingApproved')
    expect(client.encryptionAdd).toHaveBeenCalledWith(
      'nm.identity.pairingApproved',
      'true'
    )

    await expect(ipcMain.invoke('nm:pairedClients')).resolves.toEqual([
      { publicKey: 'c1' }
    ])
    await ipcMain.invoke('nm:removeClient', { publicKey: 'c1' })
    expect(mod.removeClientIdentity).toHaveBeenCalledWith(client, 'c1')
    await expect(
      ipcMain.invoke('nm:closeSessionsForClient', { publicKey: 'c1' })
    ).resolves.toBe(1)
    await expect(ipcMain.invoke('nm:clearSessions')).resolves.toBe(2)
    await ipcMain.invoke('nm:cleanup')
    expect(mod.cleanupNativeMessaging).toHaveBeenCalled()
  })

  it('refuses a malformed publicKey from the renderer', async () => {
    await expect(
      ipcMain.invoke('nm:removeClient', { publicKey: 7 })
    ).rejects.toThrow('publicKey')
    await expect(ipcMain.invoke('nm:closeSessionsForClient', {})).rejects.toThrow(
      'publicKey'
    )
    expect(mod.removeClientIdentity).not.toHaveBeenCalled()
  })

  it('reports a missing vault client instead of crashing', async () => {
    const noClient = createNativeMessaging({
      logger: silentLogger,
      getVaultClient: () => null,
      getStorageDir: () => tmpDir,
      getExecPath: () => '/exec',
      getBridgePath: () => '/bridge.cjs',
      send,
      loadModule: () => mod
    })
    const ipc = fakeIpcMain()
    noClient.register(ipc)

    await expect(ipc.invoke('nm:identity', {})).rejects.toThrow(
      'Vault client not ready'
    )
    await expect(
      ipc.invoke('nm:prefs', { nativeMessagingEnabled: true })
    ).resolves.toEqual({ running: false })
    expect(silentLogger.error).toHaveBeenCalled()
  })
})
