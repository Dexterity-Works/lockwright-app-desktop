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
