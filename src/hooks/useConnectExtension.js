import React, { useCallback, useEffect, useState } from 'react'

import { ContentCopy } from 'lockwright-lib-ui-react-native-components/icons'

import { useCopyToClipboard } from './useCopyToClipboard.electron'
import { useTranslation } from './useTranslation'
import { PAIRING_STATES } from '../constants/pairing.js'
import { ExtensionPairingModalContent } from '../containers/Modal/ExtensionPairingModalContent/ExtensionPairingModalContent'
import { useGlobalLoading } from '../context/LoadingContext.js'
import { useModal } from '../context/ModalContext'
import { useToast } from '../context/ToastContext'
import {
  getNativeMessagingEnabled,
  setNativeMessagingEnabled
} from '../services/nativeMessagingPreferences'

// The native messaging server lives in the main process; this is its handle.
const nativeMessaging = () => window.electronAPI.nativeMessaging

export const useConnectExtension = () => {
  const { setModal } = useModal()
  const { setToast } = useToast()
  const { t } = useTranslation()

  const { copyToClipboard } = useCopyToClipboard({
    onCopy: () => setToast({ message: t('Copied!'), icon: ContentCopy })
  })

  const [isBrowserExtensionEnabled, setIsBrowserExtensionEnabled] = useState(
    getNativeMessagingEnabled()
  )
  const [pairedBrowsers, setPairedBrowsers] = useState(
    /** @type {{ publicKey: string, pairingState?: string, browserName?: string }[]} */ ([])
  )

  // The flag says what the user wants; only main knows whether the server
  // actually came up.
  useEffect(() => {
    if (!getNativeMessagingEnabled()) return
    let cancelled = false
    nativeMessaging()
      .isRunning()
      .then((running) => {
        if (!cancelled && !running) setIsBrowserExtensionEnabled(false)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const refreshPairedBrowsers = useCallback(async () => {
    try {
      const clients = await nativeMessaging().pairedClients()
      setPairedBrowsers(
        clients.filter(
          (entry) => entry.pairingState === PAIRING_STATES.CONFIRMED
        )
      )
    } catch {
      setPairedBrowsers([])
    }
  }, [])

  useEffect(() => {
    if (!isBrowserExtensionEnabled) {
      setPairedBrowsers([])
      return
    }
    void refreshPairedBrowsers()
    const onFocus = () => {
      void refreshPairedBrowsers()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [isBrowserExtensionEnabled, refreshPairedBrowsers])

  const handleSetupExtension = async () => {
    // Install the native host manifest and wrapper, then start the server
    const result = await nativeMessaging().setup()

    if (result.success) {
      await nativeMessaging().start()
      setNativeMessagingEnabled(true)
      setIsBrowserExtensionEnabled(true)
      setToast({
        message: t('Lockwright ready for extension connection.')
      })
    } else {
      const errorMessage = result.message || t('Setup failed')
      throw new Error(errorMessage)
    }
  }

  const handleStopNativeMessaging = async () => {
    await nativeMessaging().clearSessions()
    await nativeMessaging().stop()

    // Clean unused manifest file and make sure browser cannot respawn the host while off
    await nativeMessaging()
      .cleanup()
      .catch(() => {})

    resetState()

    setNativeMessagingEnabled(false)

    // Reset identity to force re-pairing
    // This prevents extensions from reconnecting without a new pairing token
    await nativeMessaging().identity(true)
  }

  // Pairing info state
  const [isExtensionConnectionLoading, setIsExtensionConnectionLoading] =
    useState(false)
  useGlobalLoading({ isLoading: isExtensionConnectionLoading })

  const resetState = () => {
    setIsBrowserExtensionEnabled(false)
    setIsExtensionConnectionLoading(false)
    setPairedBrowsers([])
  }

  const loadPairingInfo = async (reset = false) => {
    // reset: generate a new identity and clear sessions; else load existing
    const id = await nativeMessaging().identity(reset)

    // Mark pairing as approved for this identity so that nmBeginHandshake is allowed
    await nativeMessaging()
      .markPairingApproved()
      .catch(() => {})

    return {
      pairingToken: id.pairingToken,
      fingerprint: id.fingerprint,
      tokenCreationDate: id.creationDate
    }
  }

  const openPairingModal = (pairingToken) => {
    setModal(
      <ExtensionPairingModalContent
        onCopy={() => copyToClipboard(pairingToken)}
        pairingToken={pairingToken}
        loadingPairing={isExtensionConnectionLoading}
      />,
      { replace: true }
    )
  }

  const showPairingCode = async () => {
    setIsExtensionConnectionLoading(true)
    try {
      const { pairingToken } = await loadPairingInfo(false)
      openPairingModal(pairingToken)
    } catch (error) {
      setToast({ message: t('Error: ') + error.message })
    } finally {
      setIsExtensionConnectionLoading(false)
    }
  }

  const toggleBrowserExtension = async (isOn) => {
    if (isOn) {
      setIsExtensionConnectionLoading(true)
      return handleSetupExtension()
        .then(loadPairingInfo)
        .then(({ pairingToken }) => {
          openPairingModal(pairingToken)
        })
        .catch((error) => {
          setToast({ message: t('Error: ') + error.message })
        })
        .finally(() => {
          setIsExtensionConnectionLoading(false)
        })
    }

    return handleStopNativeMessaging()
  }

  const unpairBrowser = async (publicKey) => {
    const remaining = await nativeMessaging().removeClient(publicKey)
    await nativeMessaging().closeSessionsForClient(publicKey)
    const confirmed = remaining.filter(
      (entry) => entry.pairingState === PAIRING_STATES.CONFIRMED
    )
    if (confirmed.length === 0) {
      await handleStopNativeMessaging()
      return
    }
    setPairedBrowsers(confirmed)
  }

  return {
    toggleBrowserExtension,
    showPairingCode,
    unpairBrowser,
    pairedBrowsers,
    isBrowserExtensionEnabled
  }
}
