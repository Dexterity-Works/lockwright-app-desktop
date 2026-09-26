jest.mock(
  '../containers/Modal/ExtensionPairingModalContent/ExtensionPairingModalContent',
  () => ({ ExtensionPairingModalContent: () => null })
)

import { act, renderHook, waitFor } from '@testing-library/react'

import { useConnectExtension } from './useConnectExtension'
import {
  getNativeMessagingEnabled,
  setNativeMessagingEnabled
} from '../services/nativeMessagingPreferences'

const mockSetModal = jest.fn()
const mockSetToast = jest.fn()

jest.mock('../context/ModalContext', () => ({
  useModal: () => ({ setModal: mockSetModal })
}))
jest.mock('../context/ToastContext', () => ({
  useToast: () => ({ setToast: mockSetToast })
}))
jest.mock('../context/LoadingContext', () => ({
  useGlobalLoading: jest.fn()
}))
jest.mock('@lingui/react', () => ({
  useLingui: () => ({ i18n: { _: (msg) => msg } })
}))
jest.mock('../services/nativeMessagingPreferences', () => ({
  getNativeMessagingEnabled: jest.fn(),
  setNativeMessagingEnabled: jest.fn()
}))

const identity = {
  pairingToken: 'PAIRCODE-ABCD',
  fingerprint: 'ABCD1234',
  creationDate: '2023-01-01'
}

/** The preload's window.electronAPI.nativeMessaging, all resolved. */
let nm

describe('useConnectExtension', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    nm = {
      setup: jest.fn().mockResolvedValue({ success: true }),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      isRunning: jest.fn().mockResolvedValue(false),
      cleanup: jest.fn().mockResolvedValue(undefined),
      identity: jest.fn().mockResolvedValue(identity),
      pairedClients: jest.fn().mockResolvedValue([]),
      removeClient: jest.fn().mockResolvedValue([]),
      closeSessionsForClient: jest.fn().mockResolvedValue(0),
      clearSessions: jest.fn().mockResolvedValue(0),
      markPairingApproved: jest.fn().mockResolvedValue(undefined)
    }
    window.electronAPI = { nativeMessaging: nm }
    getNativeMessagingEnabled.mockReturnValue(false)
  })

  afterEach(() => {
    delete window.electronAPI
  })

  it('initializes extension state if enabled and main reports running', async () => {
    getNativeMessagingEnabled.mockReturnValue(true)
    nm.isRunning.mockResolvedValue(true)

    const { result } = renderHook(() => useConnectExtension())
    expect(result.current.isBrowserExtensionEnabled).toBe(true)
    await waitFor(() => {
      expect(nm.pairedClients).toHaveBeenCalled()
    })
    expect(result.current.isBrowserExtensionEnabled).toBe(true)
  })

  it('drops to disabled when the flag is on but main has no server', async () => {
    getNativeMessagingEnabled.mockReturnValue(true)
    nm.isRunning.mockResolvedValue(false)

    const { result } = renderHook(() => useConnectExtension())
    await waitFor(() => {
      expect(result.current.isBrowserExtensionEnabled).toBe(false)
    })
  })

  it('does not enable if not enabled', () => {
    const { result } = renderHook(() => useConnectExtension())
    expect(result.current.isBrowserExtensionEnabled).toBe(false)
    expect(nm.isRunning).not.toHaveBeenCalled()
  })

  it('connects extension successfully via toggleBrowserExtension', async () => {
    const { result } = renderHook(() => useConnectExtension())

    await act(async () => {
      await result.current.toggleBrowserExtension(true)
    })

    expect(nm.setup).toHaveBeenCalled()
    expect(nm.start).toHaveBeenCalled()
    expect(setNativeMessagingEnabled).toHaveBeenCalledWith(true)
    expect(nm.identity).toHaveBeenCalledWith(false)
    expect(nm.markPairingApproved).toHaveBeenCalled()
    expect(mockSetModal).toHaveBeenCalled()
    expect(result.current.isBrowserExtensionEnabled).toBe(true)
  })

  it('handles setup failure gracefully via toggleBrowserExtension', async () => {
    nm.setup.mockResolvedValue({ success: false, message: 'fail' })

    const { result } = renderHook(() => useConnectExtension())

    await act(async () => {
      await result.current.toggleBrowserExtension(true)
    })

    expect(nm.setup).toHaveBeenCalled()
    expect(nm.start).not.toHaveBeenCalled()
    expect(mockSetToast).toHaveBeenCalled()
  })

  it('stops native messaging and resets the identity when toggled off', async () => {
    const { result } = renderHook(() => useConnectExtension())

    await act(async () => {
      await result.current.toggleBrowserExtension(false)
    })

    expect(nm.clearSessions).toHaveBeenCalled()
    expect(nm.stop).toHaveBeenCalled()
    expect(nm.cleanup).toHaveBeenCalled()
    expect(setNativeMessagingEnabled).toHaveBeenCalledWith(false)
    expect(nm.identity).toHaveBeenCalledWith(true)
  })

  it('shows an existing pair code without restarting the native host', async () => {
    const { result } = renderHook(() => useConnectExtension())

    await act(async () => {
      await result.current.showPairingCode()
    })

    expect(nm.setup).not.toHaveBeenCalled()
    expect(nm.start).not.toHaveBeenCalled()
    expect(nm.identity).toHaveBeenCalledWith(false)
    expect(mockSetModal).toHaveBeenCalled()
  })

  it('unpairs one browser without stopping native messaging when others remain', async () => {
    nm.removeClient.mockResolvedValue([
      {
        publicKey: 'chromePub',
        pairingState: 'CONFIRMED',
        browserName: 'Chrome'
      }
    ])

    const { result } = renderHook(() => useConnectExtension())

    await act(async () => {
      await result.current.unpairBrowser('firefoxPub')
    })

    expect(nm.removeClient).toHaveBeenCalledWith('firefoxPub')
    expect(nm.closeSessionsForClient).toHaveBeenCalledWith('firefoxPub')
    expect(nm.stop).not.toHaveBeenCalled()
    expect(nm.identity).not.toHaveBeenCalled()
    expect(result.current.pairedBrowsers).toEqual([
      {
        publicKey: 'chromePub',
        pairingState: 'CONFIRMED',
        browserName: 'Chrome'
      }
    ])
  })

  it('stops native messaging when the last browser is unpaired', async () => {
    nm.removeClient.mockResolvedValue([])

    const { result } = renderHook(() => useConnectExtension())

    await act(async () => {
      await result.current.unpairBrowser('chromePub')
    })

    expect(nm.closeSessionsForClient).toHaveBeenCalledWith('chromePub')
    expect(nm.stop).toHaveBeenCalled()
    expect(nm.identity).toHaveBeenCalledWith(true)
  })
})
