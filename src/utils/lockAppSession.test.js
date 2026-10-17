import { lockAppSession } from './lockAppSession'
import { logger } from './logger'
import { NAVIGATION_ROUTES } from '../constants/navigation'

jest.mock('./logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    log: jest.fn()
  }
}))

describe('lockAppSession', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('navigates to master password after closeAllInstances resolves', async () => {
    const closeAllInstances = jest.fn().mockResolvedValue(undefined)
    const navigate = jest.fn()
    const resetState = jest.fn()
    const closeModal = jest.fn()

    await lockAppSession({
      closeAllInstances,
      navigate,
      resetState,
      closeModal
    })

    expect(closeAllInstances).toHaveBeenCalledTimes(1)
    // Forced: a busy modal such as a running revoke must not stay on top
    // of the lock screen.
    expect(closeModal.mock.calls).toEqual([[{ force: true }]])
    expect(navigate).toHaveBeenCalledWith('welcome', {
      state: NAVIGATION_ROUTES.MASTER_PASSWORD
    })
    expect(resetState).toHaveBeenCalledTimes(1)
  })

  it('still locks when closeAllInstances hangs past the timeout', async () => {
    const closeAllInstances = jest.fn(() => new Promise(() => {}))
    const navigate = jest.fn()
    const resetState = jest.fn()

    const pending = lockAppSession({
      closeAllInstances,
      navigate,
      resetState,
      timeoutMs: 1000
    })

    await jest.advanceTimersByTimeAsync(1000)
    await pending

    expect(navigate).toHaveBeenCalledWith('welcome', {
      state: NAVIGATION_ROUTES.MASTER_PASSWORD
    })
    expect(resetState).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalled()
  })

  it('still locks when closeAllInstances rejects', async () => {
    const closeAllInstances = jest
      .fn()
      .mockRejectedValue(new Error('worklet dead'))
    const navigate = jest.fn()
    const resetState = jest.fn()

    await lockAppSession({
      closeAllInstances,
      navigate,
      resetState
    })

    expect(navigate).toHaveBeenCalledWith('welcome', {
      state: NAVIGATION_ROUTES.MASTER_PASSWORD
    })
    expect(resetState).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalled()
  })
})
