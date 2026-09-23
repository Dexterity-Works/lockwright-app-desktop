/**
 * Electron renderer implementation: uses Clipboard API only.
 * No pear-run / pear-ipc so the bundle doesn't pull in Node-only deps (__filename, etc.).
 * Optional: clear clipboard after delay can be added via IPC to main later.
 */
import React, { useState, useEffect } from 'react'

import { DEFAULT_CLIPBOARD_CLEAR_TIMEOUT } from 'lockwright-lib-constants'
import { Check } from 'lockwright-lib-ui-react-native-components/icons'

import { useTranslation } from './useTranslation'
import { LOCAL_STORAGE_KEYS } from '../constants/localStorage'
import { useToast } from '../context/ToastContext'
import { logger } from '../utils/logger'

/**
 * @param {{ onCopy?: () => void }} props
 * @returns {{ isCopied: boolean, copyToClipboard: (text: string) => boolean, isCopyToClipboardDisabled: boolean }}
 */
export const useCopyToClipboard = ({ onCopy } = {}) => {
  const { t } = useTranslation()
  const toastCtx = useToast()
  const setToast = toastCtx?.setToast
  const [isCopyToClipboardDisabled, setIsCopyToClipboardDisabled] =
    useState(true)
  const [isCopied, setIsCopied] = useState(false)

  useEffect(() => {
    const disabled = localStorage.getItem(
      LOCAL_STORAGE_KEYS.COPY_TO_CLIPBOARD_DISABLED
    )
    setIsCopyToClipboardDisabled(disabled === 'true')
  }, [])

  const copyToClipboard = (text) => {
    if (isCopyToClipboardDisabled) {
      setToast?.({
        message: t(
          'Please turn on the Copy to clipboard action from your settings'
        )
      })
      return false
    }
    if (!text || typeof text !== 'string') {
      logger.error('useCopyToClipboard', 'Text to copy is invalid or undefined')
      return false
    }
    if (!navigator.clipboard) {
      logger.error('useCopyToClipboard', 'Clipboard API is not available')
      return false
    }
    navigator.clipboard.writeText(text).then(
      () => {
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
        if (onCopy) {
          onCopy()
        } else {
          setToast?.({ message: t('Copied to Clipboard'), icon: Check })
        }
        const clearDisabled =
          localStorage.getItem(LOCAL_STORAGE_KEYS.CLIPBOARD_CLEAR_DISABLED) ===
          'true'
        if (window.electronAPI && !clearDisabled) {
          window.electronAPI.clearClipboardAfter?.(
            text,
            DEFAULT_CLIPBOARD_CLEAR_TIMEOUT
          )
        }
      },
      (err) => {
        logger.error(
          'useCopyToClipboard',
          'Failed to copy text to clipboard',
          err
        )
      }
    )
    return true
  }

  return { isCopied, copyToClipboard, isCopyToClipboardDisabled }
}
