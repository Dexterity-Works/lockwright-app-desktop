import { applyAutoLockEnabled, applyAutoLockTimeout } from '../utils/autoLock'

/**
 * Deliver one native messaging server event to the UI. Auto-lock changes
 * asked for by the extension land in localStorage through autoLock.js,
 * which also raises the window events AutoLockProvider listens for; every
 * other type is re-dispatched as-is for useInactivity and friends.
 * @param {string} type
 * @param {object} [payload] becomes `event.detail`
 */
export const applyNativeMessagingEvent = (type, payload) => {
  if (type === 'apply-auto-lock-timeout') {
    applyAutoLockTimeout(payload.autoLockTimeoutMs)
    return
  }
  if (type === 'apply-auto-lock-enabled') {
    applyAutoLockEnabled(payload.autoLockEnabled)
    return
  }
  window.dispatchEvent(new CustomEvent(type, { detail: payload }))
}
