/**
 * Entry for the main-process bundle (dist/native-messaging-main.bundle.cjs).
 * Everything the Electron main process needs to host the native messaging
 * server, re-exported from the ESM sources so main.cjs can `require` one file.
 */
import { DEFAULT_AUTO_LOCK_TIMEOUT } from 'lockwright-lib-constants'

import { logger } from '../utils/logger'

export { DEFAULT_AUTO_LOCK_TIMEOUT }
export { NativeMessagingIPCServer } from './nativeMessagingIPCServer'
export {
  getFingerprint,
  getOrCreateIdentity,
  getPairedClients,
  getPairingToken,
  removeClientIdentity,
  resetIdentity
} from './security/appIdentity'
export {
  clearAllSessions,
  closeSessionsForClient
} from './security/sessionStore'
export {
  cleanupNativeMessaging,
  killNativeMessagingHostProcesses,
  setupNativeMessaging
} from '../utils/nativeMessagingSetup'

/**
 * Route every log line from these modules into the main-process logger.
 * @param {{ log: Function, info: Function, debug: Function, warn: Function, error: Function }} target
 */
export const bindLogger = (target) => logger.setTarget(target)
