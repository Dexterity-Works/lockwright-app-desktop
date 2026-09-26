import { LOCAL_STORAGE_KEYS } from '../constants/localStorage'
import { getAutoLockTimeoutMs, isAutoLockEnabled } from '../utils/autoLock'
import { logger } from '../utils/logger'

/**
 * Get/set native messaging preference in localStorage
 */
export const getNativeMessagingEnabled = () =>
  localStorage.getItem(LOCAL_STORAGE_KEYS.NATIVE_MESSAGING_ENABLED) === 'true'

export const setNativeMessagingEnabled = (enabled) => {
  if (enabled) {
    localStorage.setItem(LOCAL_STORAGE_KEYS.NATIVE_MESSAGING_ENABLED, 'true')
  } else {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.NATIVE_MESSAGING_ENABLED)
  }
  void pushNativeMessagingPrefs()
}

/**
 * Everything the native messaging server needs to know about the UI's
 * preferences, read from localStorage (the source of truth).
 * @returns {{ nativeMessagingEnabled: boolean, autoLockEnabled: boolean, autoLockTimeoutMs: number | null }}
 */
export const readNativeMessagingPrefs = () => ({
  nativeMessagingEnabled: getNativeMessagingEnabled(),
  autoLockEnabled: isAutoLockEnabled(),
  autoLockTimeoutMs: getAutoLockTimeoutMs()
})

/**
 * Mirror the current snapshot into the main process, where the native
 * messaging server reads it. Never throws: the mirror is best effort and
 * the next change pushes again.
 * @returns {Promise<void>}
 */
export const pushNativeMessagingPrefs = async () => {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined
  if (!api || typeof api.setNativeMessagingPrefs !== 'function') return
  try {
    await api.setNativeMessagingPrefs(readNativeMessagingPrefs())
  } catch (err) {
    logger.error('NM-PREFS', 'Failed to push preferences to main:', err)
  }
}

/**
 * Before the server moved to the main process, confirmed extension keys were
 * cached in localStorage. Hand them to main once so paired extensions stay
 * paired across the upgrade, then drop the entry.
 * @returns {Promise<void>}
 */
export const migrateLegacyClientKeyCache = async () => {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined
  const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.NM_CLIENT_PUBLIC_KEY)
  if (!raw || !api?.nativeMessaging?.importClientKeys) return
  let keys = [raw]
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) keys = parsed
    else if (typeof parsed === 'string') keys = [parsed]
  } catch {
    // Legacy: a single base64 public key, not JSON
  }
  try {
    await api.nativeMessaging.importClientKeys(
      keys.filter((key) => typeof key === 'string' && key.length > 0)
    )
    localStorage.removeItem(LOCAL_STORAGE_KEYS.NM_CLIENT_PUBLIC_KEY)
  } catch (err) {
    logger.error('NM-PREFS', 'Failed to migrate client key cache:', err)
  }
}
