import React, { useCallback, useEffect, useState } from 'react'

import { ContentCopy } from 'lockwright-lib-ui-react-native-components/icons'

import { useCopyToClipboard } from './useCopyToClipboard.electron'
import { useTranslation } from './useTranslation'
import { PAIRING_STATES } from '../constants/pairing.js'
import { ExtensionPairingModalContent } from '../containers/Modal/ExtensionPairingModalContent/ExtensionPairingModalContent'
import { useGlobalLoading } from '../context/LoadingContext.js'
import { useModal } from '../context/ModalContext'
import { useToast } from '../context/ToastContext'
import { getElectronConfig } from '../electron'
import { createOrGetPearpassClient } from '../services/createOrGetPearpassClient'
import {
  isNativeMessagingIPCRunning,
  startNativeMessagingIPC,
  stopNativeMessagingIPC
} from '../services/nativeMessagingIPCServer'
import {
  getNativeMessagingEnabled,
  setNativeMessagingEnabled
} from '../services/nativeMessagingPreferences'
import {
  getFingerprint,
  getOrCreateIdentity,
  getPairingToken,
  getPairedClients,
  removeClientIdentity,
  resetIdentity
} from '../services/security/appIdentity'
import {
  clearAllSessions,
  closeSessionsForClient
} from '../services/security/sessionStore.js'
import {
  setupNativeMessaging,
  killNativeMessagingHostProcesses,
  cleanupNativeMessaging
} from '../utils/nativeMessagingSetup'

export const useConnectExtension = () => {
  const { setModal } = useModal()
  const { setToast } = useToast()
  const { t } = useTranslation()

  const { copyToClipboard } = useCopyToClipboard({
    onCopy: () => setToast({ message: t('Copied!'), icon: ContentCopy })
  })

  const [isBrowserExtensionEnabled, setIsBrowserExtensionEnabled] = useState(
    getNativeMessagingEnabled() && isNativeMessagingIPCRunning()
  )
  const [pairedBrowsers, setPairedBrowsers] = useState(
    /** @type {{ publicKey: string, pairingState?: string, browserName?: string }[]} */ ([])
  )

  const refreshPairedBrowsers = useCallback(async () => {
    try {
      const client = createOrGetPearpassClient()
      const clients = await getPairedClients(client)
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
    // Setup native messaging for the extension
    const config = await getElectronConfig()
    const result = await setupNativeMessaging({
      userDataPath: config.userDataPath,
      execPath: config.execPath,
      bridgePath: config.bridgePath
    })

    if (result.success) {
      // Kill any existing native host so Chrome respawns it and re-reads the manifest
      await killNativeMessagingHostProcesses()
      // Start native messaging IPC server
      const client = createOrGetPearpassClient()
      await startNativeMessagingIPC(client)
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
    clearAllSessions()
    await stopNativeMessagingIPC()

    // Ensure any running native host is terminated so it cannot continue talking
    await killNativeMessagingHostProcesses()

    // Clean unused manifest file and make sure browser cannot respawn the host while off
    await cleanupNativeMessaging().catch(() => {})

    resetState()

    setNativeMessagingEnabled(false)

    // Reset identity to force re-pairing
    // This prevents extensions from reconnecting without a new pairing token
    const client = createOrGetPearpassClient()
    await resetIdentity(client)
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
    const client = createOrGetPearpassClient()

    const id = reset
      ? // Reset pairing - generate new identity and clear sessions
        await resetIdentity(client)
      : // Just load existing identity
        await getOrCreateIdentity(client)

    // Mark pairing as approved for this identity so that nmBeginHandshake is allowed
    await client
      .encryptionAdd('nm.identity.pairingApproved', 'true')
      .catch(() => {})

    const pairingToken = await getPairingToken(client, id.ed25519PublicKey)
    const fingerprint = getFingerprint(id.ed25519PublicKey)
    const result = {
      pairingToken,
      fingerprint,
      tokenCreationDate: id.creationDate
    }

    return result
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
    const client = createOrGetPearpassClient()
    const remaining = await removeClientIdentity(client, publicKey)
    closeSessionsForClient(publicKey)
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
