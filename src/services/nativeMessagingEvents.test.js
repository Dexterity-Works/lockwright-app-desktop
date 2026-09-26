import {
  applyNativeMessagingEvent,
  installNativeMessagingEvents
} from './nativeMessagingEvents'
import { applyAutoLockEnabled, applyAutoLockTimeout } from '../utils/autoLock'

jest.mock('../utils/autoLock', () => ({
  applyAutoLockEnabled: jest.fn(),
  applyAutoLockTimeout: jest.fn()
}))

describe('applyNativeMessagingEvent', () => {
  afterEach(() => jest.clearAllMocks())

  it('writes extension-driven auto-lock changes through autoLock.js', () => {
    applyNativeMessagingEvent('apply-auto-lock-timeout', {
      autoLockTimeoutMs: null
    })
    expect(applyAutoLockTimeout).toHaveBeenCalledWith(null)

    applyNativeMessagingEvent('apply-auto-lock-enabled', {
      autoLockEnabled: false
    })
    expect(applyAutoLockEnabled).toHaveBeenCalledWith(false)
  })

  it('re-dispatches every other type as a window event with the payload as detail', () => {
    const seen = jest.fn()
    window.addEventListener('reset-timer', seen)
    window.addEventListener('ipc-activity', seen)

    applyNativeMessagingEvent('reset-timer', { from: 'ext' })
    applyNativeMessagingEvent('ipc-activity')

    expect(seen).toHaveBeenCalledTimes(2)
    expect(seen.mock.calls[0][0].detail).toEqual({ from: 'ext' })
    expect(seen.mock.calls[1][0].type).toBe('ipc-activity')
    expect(applyAutoLockTimeout).not.toHaveBeenCalled()
  })

  it('installs onto the preload stream and routes each message', () => {
    let listener
    const unsubscribe = jest.fn()
    window.electronAPI = {
      onNativeMessagingEvent: jest.fn((cb) => {
        listener = cb
        return unsubscribe
      })
    }
    const seen = jest.fn()
    window.addEventListener('extension-exit', seen)

    const off = installNativeMessagingEvents()
    listener({ type: 'extension-exit' })
    listener({
      type: 'apply-auto-lock-enabled',
      payload: { autoLockEnabled: true }
    })

    expect(seen).toHaveBeenCalledTimes(1)
    expect(applyAutoLockEnabled).toHaveBeenCalledWith(true)
    expect(off).toBe(unsubscribe)
    delete window.electronAPI
  })

  it('is a no-op outside Electron', () => {
    expect(typeof installNativeMessagingEvents()).toBe('function')
  })
})
