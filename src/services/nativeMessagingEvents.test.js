import { applyNativeMessagingEvent } from './nativeMessagingEvents'
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
})
