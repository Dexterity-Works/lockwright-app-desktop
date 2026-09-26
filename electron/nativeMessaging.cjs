/**
 * Native messaging in the main process.
 *
 * Holds the mirror of the renderer's preferences. localStorage in the
 * renderer stays the source of truth: it pushes a snapshot over `nm:prefs`
 * on boot and after every change, and the server reads this copy.
 */

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

function createNativeMessaging() {
  let preferences = { ...DEFAULT_PREFERENCES }

  const api = {
    getPreferences: () => ({ ...preferences }),
    setPreferences: (partial) => {
      preferences = mergePreferences(partial, preferences)
    },
    /**
     * @param {import('electron').IpcMain} ipcMain
     */
    register(ipcMain) {
      ipcMain.handle('nm:prefs', async (_event, snapshot) => {
        api.setPreferences(snapshot)
        return { running: false }
      })
    }
  }
  return api
}

module.exports = { createNativeMessaging, mergePreferences }
