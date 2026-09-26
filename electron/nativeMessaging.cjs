/**
 * Native messaging in the main process: the pear-ipc server the browser
 * extension's native host talks to, its dependencies, and the IPC channels
 * the renderer drives it with.
 *
 * The server code itself is ESM under src/services and ships as
 * dist/native-messaging-main.bundle.cjs (scripts/bundle-bridge.mjs).
 *
 * Preferences: the renderer's localStorage stays the source of truth. It
 * pushes a snapshot over `nm:prefs` on boot and after every change, and the
 * server reads this copy. Main persists nothing of it: the first push after
 * the window loads is what starts the server when the flag is on, which is
 * after the vault client is ready because the window is created after the
 * runtime.
 *
 * Events: whatever the server wants the UI to see goes out as
 * `nm:event` { type, payload }; the renderer re-dispatches it on window.
 */
const path = require('path')

const devicePreferences = require('../src/utils/devicePreferences.cjs')

const PAIRING_APPROVED_KEY = 'nm.identity.pairingApproved'

const DEFAULT_PREFERENCES = Object.freeze({
  nativeMessagingEnabled: false,
  // Only served once the renderer's first push has flipped
  // nativeMessagingEnabled, so these two never reach an extension as-is.
  autoLockEnabled: true,
  autoLockTimeoutMs: null
})

/**
 * Merge a renderer-supplied snapshot, keeping only well-typed fields.
 * @param {unknown} input
 * @param {{ nativeMessagingEnabled: boolean, autoLockEnabled: boolean, autoLockTimeoutMs: number | null }} current
 */
function mergePreferences(input, current) {
  const next = { ...current }
  const partial = input && typeof input === 'object' ? input : {}
  if (typeof partial.nativeMessagingEnabled === 'boolean') {
    next.nativeMessagingEnabled = partial.nativeMessagingEnabled
  }
  if (typeof partial.autoLockEnabled === 'boolean') {
    next.autoLockEnabled = partial.autoLockEnabled
  }
  const timeout = partial.autoLockTimeoutMs
  if (
    timeout === null ||
    (typeof timeout === 'number' && Number.isFinite(timeout) && timeout > 0)
  ) {
    next.autoLockTimeoutMs = timeout
  }
  return next
}

function loadServerModule() {
  // eslint-disable-next-line import/no-unresolved
  return require(
    path.join(__dirname, '..', 'dist', 'native-messaging-main.bundle.cjs')
  )
}

const requirePublicKey = (payload) => {
  const publicKey = payload && payload.publicKey
  if (typeof publicKey !== 'string' || publicKey.length === 0) {
    throw new Error('publicKey must be a non-empty string')
  }
  return publicKey
}

/**
 * @param {object} deps
 * @param {{ log: Function, info: Function, debug: Function, warn: Function, error: Function }} deps.logger
 * @param {() => object | null} deps.getVaultClient the real vault client, once ready
 * @param {() => string} deps.getStorageDir userData root (device preferences, native host wrapper)
 * @param {() => string} deps.getExecPath Electron executable the native host wrapper runs
 * @param {() => string} deps.getBridgePath bundled native host script
 * @param {(channel: string, data: unknown) => void} deps.send to the renderer, no-op without a window
 * @param {() => object} [deps.loadModule] test seam for the server bundle
 */
function createNativeMessaging({
  logger,
  getVaultClient,
  getStorageDir,
  getExecPath,
  getBridgePath,
  send,
  loadModule = loadServerModule
}) {
  let preferences = { ...DEFAULT_PREFERENCES }
  /** @type {object | null} */
  let mod = null
  /** @type {object | null} */
  let server = null

  const module_ = () => {
    if (!mod) {
      mod = loadModule()
      mod.bindLogger(logger)
    }
    return mod
  }

  const vaultClient = () => {
    const client = getVaultClient()
    if (!client) throw new Error('Vault client not ready')
    return client
  }

  const clientKeyStore = {
    read: () => devicePreferences.read(getStorageDir()).nmClientPublicKeys,
    write: (keys) =>
      devicePreferences.write(getStorageDir(), { nmClientPublicKeys: keys })
  }

  const getServer = () => {
    if (!server) {
      server = new (module_().NativeMessagingIPCServer)(vaultClient(), {
        emit: (type, payload) => send('nm:event', { type, payload }),
        preferences: {
          get: () => preferences,
          set: (partial) => api.setPreferences(partial)
        },
        clientKeyStore
      })
    }
    return server
  }

  const api = {
    getPreferences: () => ({ ...preferences }),
    setPreferences: (partial) => {
      preferences = mergePreferences(partial, preferences)
    },
    isRunning: () => !!(server && server.isRunning),

    async start() {
      await getServer().start()
    },

    async stop() {
      if (!server) return
      await server.stop()
    },

    /**
     * Install the native host manifest and wrapper, then kill any host the
     * browser still has so it respawns against the fresh manifest.
     */
    async setup() {
      const m = module_()
      const result = await m.setupNativeMessaging({
        userDataPath: getStorageDir(),
        execPath: getExecPath(),
        bridgePath: getBridgePath()
      })
      if (result.success) {
        await m.killNativeMessagingHostProcesses()
      }
      return result
    },

    /**
     * Pairing info for the UI. `reset` rotates the identity, which unpairs
     * every extension.
     */
    async identity(reset) {
      const m = module_()
      const client = vaultClient()
      const id = reset
        ? await m.resetIdentity(client)
        : await m.getOrCreateIdentity(client)
      return {
        pairingToken: await m.getPairingToken(client, id.ed25519PublicKey),
        fingerprint: m.getFingerprint(id.ed25519PublicKey),
        creationDate: id.creationDate
      }
    },

    /**
     * @param {import('electron').IpcMain} ipcMain
     */
    register(ipcMain) {
      ipcMain.handle('nm:prefs', async (_event, snapshot) => {
        api.setPreferences(snapshot)
        if (preferences.nativeMessagingEnabled && !api.isRunning()) {
          try {
            await api.start()
          } catch (err) {
            logger.error(
              'NM',
              'Failed to start native messaging server:',
              (err && err.message) || err
            )
          }
        }
        return { running: api.isRunning() }
      })
      ipcMain.handle('nm:setup', async () => api.setup())
      ipcMain.handle('nm:start', async () => api.start())
      ipcMain.handle('nm:stop', async () => api.stop())
      ipcMain.handle('nm:isRunning', async () => api.isRunning())
      ipcMain.handle('nm:cleanup', async () =>
        module_().cleanupNativeMessaging()
      )
      ipcMain.handle('nm:identity', async (_event, payload) =>
        api.identity(!!(payload && payload.reset))
      )
      ipcMain.handle('nm:pairedClients', async () =>
        module_().getPairedClients(vaultClient())
      )
      ipcMain.handle('nm:removeClient', async (_event, payload) =>
        module_().removeClientIdentity(vaultClient(), requirePublicKey(payload))
      )
      ipcMain.handle('nm:closeSessionsForClient', async (_event, payload) =>
        module_().closeSessionsForClient(requirePublicKey(payload))
      )
      ipcMain.handle('nm:clearSessions', async () =>
        module_().clearAllSessions()
      )
      ipcMain.handle('nm:markPairingApproved', async () => {
        await vaultClient().encryptionAdd(PAIRING_APPROVED_KEY, 'true')
      })
      // One-time hand-over of the confirmed keys the renderer cached in
      // localStorage before the server moved here.
      ipcMain.handle('nm:importClientKeys', async (_event, payload) => {
        const keys = Array.isArray(payload && payload.keys)
          ? payload.keys.filter((key) => typeof key === 'string' && key)
          : []
        const merged = new Set([...clientKeyStore.read(), ...keys])
        clientKeyStore.write([...merged])
      })
    }
  }
  return api
}

module.exports = { createNativeMessaging, mergePreferences }
