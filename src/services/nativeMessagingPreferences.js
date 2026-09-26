import { LOCAL_STORAGE_KEYS } from '../constants/localStorage'
import { getAutoLockTimeoutMs, isAutoLockEnabled } from '../utils/autoLock'

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
