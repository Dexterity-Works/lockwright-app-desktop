export {}

declare global {
  interface Window {
    electronAPI?: {
      getConfig: () => Promise<{
        storage: string
        hasVault?: boolean
        key: string | null
        upgrade: string | null
        version: string | number
        applink: string
        platform: string
        deviceName: string
      }>
      onRuntimeUpdating: (cb: () => void) => () => void
      onRuntimeUpdated: (cb: () => void) => () => void
      applyUpdate: () => Promise<void>
      restart: () => Promise<void>
      checkUpdated: () => Promise<boolean>
      vaultInvoke: (method: string, args?: unknown[]) => Promise<{ ok: boolean; data?: unknown; error?: string }>
      vaultOnUpdate: (cb: () => void) => () => void
      vaultOnMasterUpdate: (cb: () => void) => () => void
      vaultOnPersonalSwarmEnvelope: (
        cb: (payload: { envelope: string }) => void
      ) => () => void
      clearStaleVaultsDir: () => Promise<void>
      openExternal: (url: string) => Promise<void>
      openLogsFolder: () => Promise<void>
      isLoggingEnabled: () => Promise<{ enabled: boolean; forced: boolean }>
      setLogging: (
        enabled: boolean
      ) => Promise<{ enabled: boolean; forced: boolean }>
      logError: (component: string, args: unknown[]) => void
      setNativeMessagingPrefs: (prefs: NativeMessagingPrefs) => Promise<{
        running: boolean
      }>
      onNativeMessagingEvent: (
        cb: (msg: { type: string; payload?: unknown }) => void
      ) => () => void
      nativeMessaging: {
        setup: () => Promise<{ success: boolean; message?: string }>
        start: () => Promise<void>
        stop: () => Promise<void>
        isRunning: () => Promise<boolean>
        cleanup: () => Promise<void>
        identity: (reset?: boolean) => Promise<{
          pairingToken: string
          fingerprint: string
          creationDate: string
        }>
        pairedClients: () => Promise<PairedExtensionClient[]>
        removeClient: (publicKey: string) => Promise<PairedExtensionClient[]>
        closeSessionsForClient: (publicKey: string) => Promise<number>
        clearSessions: () => Promise<number>
        markPairingApproved: () => Promise<void>
      }
    }
  }

  interface PairedExtensionClient {
    publicKey: string
    pairingState?: string
    browserName?: string
  }

  interface NativeMessagingPrefs {
    nativeMessagingEnabled: boolean
    autoLockEnabled: boolean
    autoLockTimeoutMs: number | null
  }
}
