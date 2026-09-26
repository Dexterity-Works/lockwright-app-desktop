import {
  getNativeMessagingEnabled,
  pushNativeMessagingPrefs,
  readNativeMessagingPrefs,
  setNativeMessagingEnabled
} from './nativeMessagingPreferences'
import { LOCAL_STORAGE_KEYS } from '../constants/localStorage'

jest.mock('lockwright-lib-constants', () => ({
  AUTO_LOCK_ENABLED: true,
  DEFAULT_AUTO_LOCK_TIMEOUT: 300000
}))

describe('nativeMessagingPreferences', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('getNativeMessagingEnabled', () => {
    it('should return false when the item is not in localStorage', () => {
      expect(getNativeMessagingEnabled()).toBe(false)
    })

    it('should return true when the item is set to "true" in localStorage', () => {
      localStorage.setItem('native-messaging-enabled', 'true')
      expect(getNativeMessagingEnabled()).toBe(true)
    })

    it('should return false when the item is set to something other than "true"', () => {
      localStorage.setItem('native-messaging-enabled', 'false')
      expect(getNativeMessagingEnabled()).toBe(false)
    })
  })

  describe('setNativeMessagingEnabled', () => {
    it('should set the item to "true" in localStorage when enabled is true', () => {
      setNativeMessagingEnabled(true)
      expect(localStorage.getItem('native-messaging-enabled')).toBe('true')
    })

    it('should remove the item from localStorage when enabled is false', () => {
      localStorage.setItem('native-messaging-enabled', 'true')
      setNativeMessagingEnabled(false)
      expect(localStorage.getItem('native-messaging-enabled')).toBeNull()
    })

    it('should not add the item if it does not exist and enabled is false', () => {
      setNativeMessagingEnabled(false)
      expect(localStorage.getItem('native-messaging-enabled')).toBeNull()
    })
  })

  describe('readNativeMessagingPrefs', () => {
    it('snapshots the three settings from localStorage', () => {
      expect(readNativeMessagingPrefs()).toEqual({
        nativeMessagingEnabled: false,
        autoLockEnabled: true,
        autoLockTimeoutMs: 300000
      })

      setNativeMessagingEnabled(true)
      localStorage.setItem(LOCAL_STORAGE_KEYS.AUTO_LOCK_ENABLED, 'false')
      localStorage.setItem(LOCAL_STORAGE_KEYS.AUTO_LOCK_TIMEOUT_MS, 'null')

      expect(readNativeMessagingPrefs()).toEqual({
        nativeMessagingEnabled: true,
        autoLockEnabled: false,
        autoLockTimeoutMs: null
      })
    })
  })

  describe('pushNativeMessagingPrefs', () => {
    afterEach(() => {
      delete window.electronAPI
    })

    it('is a no-op outside Electron', async () => {
      await expect(pushNativeMessagingPrefs()).resolves.toBeUndefined()
    })

    it('sends the snapshot to main, also when the flag is toggled', async () => {
      const setNativeMessagingPrefs = jest.fn().mockResolvedValue({
        running: true
      })
      window.electronAPI = { setNativeMessagingPrefs }

      setNativeMessagingEnabled(true)
      expect(setNativeMessagingPrefs).toHaveBeenCalledWith({
        nativeMessagingEnabled: true,
        autoLockEnabled: true,
        autoLockTimeoutMs: 300000
      })

      setNativeMessagingPrefs.mockRejectedValueOnce(new Error('no main'))
      await expect(pushNativeMessagingPrefs()).resolves.toBeUndefined()
    })
  })
})
