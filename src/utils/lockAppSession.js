import { logger } from './logger'
import { NAVIGATION_ROUTES } from '../constants/navigation'

const DEFAULT_CLOSE_TIMEOUT_MS = 5_000

/**
 * Lock the desktop session: close vault worklet instances (best-effort), then
 * always navigate to the master-password screen. A hung close must not leave
 * the user stuck unlocked in the vault UI.
 *
 * @param {{
 *   closeAllInstances: () => Promise<unknown>,
 *   navigate: (page: string, data?: import('../context/RouterContext').RouterData) => void,
 *   resetState?: () => void,
 *   closeModal?: (options: { force: boolean }) => void,
 *   timeoutMs?: number
 * }} params
 * @returns {Promise<void>}
 */
export async function lockAppSession({
  closeAllInstances,
  navigate,
  resetState,
  closeModal,
  timeoutMs = DEFAULT_CLOSE_TIMEOUT_MS
}) {
  try {
    await Promise.race([
      closeAllInstances(),
      new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error('closeAllInstances timed out')),
          timeoutMs
        )
      })
    ])
  } catch (error) {
    logger.error(
      'lockAppSession',
      'closeAllInstances failed; continuing to lock screen',
      error
    )
  }

  // Forced: a busy modal such as a running revoke must not stay on top of
  // the lock screen.
  closeModal?.({ force: true })
  navigate('welcome', { state: NAVIGATION_ROUTES.MASTER_PASSWORD })
  resetState?.()
}
