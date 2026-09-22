import { act, renderHook, waitFor } from '@testing-library/react'

import { useCopyToClipboard } from './useCopyToClipboard.electron'
import { LOCAL_STORAGE_KEYS } from '../constants/localStorage'
import { logger } from '../utils/logger'

jest.mock('../utils/logger', () => ({
  logger: {
    error: jest.fn()
  }
}))
jest.mock('./useTranslation', () => ({
  useTranslation: () => ({
    t: (value) => value
  })
}))
jest.mock('lockwright-lib-constants', () => ({
  DEFAULT_CLIPBOARD_CLEAR_TIMEOUT: 1000
}))

const mockSetToast = jest.fn()
jest.mock('../context/ToastContext', () => ({
  useToast: () => ({ setToast: mockSetToast })
}))

describe('useCopyToClipboard.electron', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    window.electronAPI = {
      clearClipboardAfter: jest.fn()
    }

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: {
        writeText: jest.fn().mockResolvedValue(undefined)
      }
    })
  })

  it('starts with isCopied set to false', () => {
    const { result } = renderHook(() => useCopyToClipboard())
    expect(result.current.isCopied).toBe(false)
  })

  it('reads disabled flag from localStorage on mount', async () => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.COPY_TO_CLIPBOARD_DISABLED, 'true')
    const { result } = renderHook(() => useCopyToClipboard())

    await waitFor(() => {
      expect(result.current.isCopyToClipboardDisabled).toBe(true)
    })
  })

  it('enables copy when disabled flag is not true', async () => {
    const { result } = renderHook(() => useCopyToClipboard())

    await waitFor(() => {
      expect(result.current.isCopyToClipboardDisabled).toBe(false)
    })
  })

  it('does not copy when disabled', async () => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.COPY_TO_CLIPBOARD_DISABLED, 'true')
    const { result } = renderHook(() => useCopyToClipboard())

    await waitFor(() => {
      expect(result.current.isCopyToClipboardDisabled).toBe(true)
    })

    let copied
    await act(async () => {
      copied = result.current.copyToClipboard('secret')
    })

    expect(copied).toBe(false)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(mockSetToast).toHaveBeenCalledWith({
      message: 'Please turn on the Copy to clipboard action from your settings'
    })
  })

  it('copies text and sets isCopied on success', async () => {
    const onCopy = jest.fn()
    const { result } = renderHook(() => useCopyToClipboard({ onCopy }))

    await waitFor(() => {
      expect(result.current.isCopyToClipboardDisabled).toBe(false)
    })

    let copied
    await act(async () => {
      copied = result.current.copyToClipboard('secret')
    })

    expect(copied).toBe(true)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('secret')

    await waitFor(() => {
      expect(result.current.isCopied).toBe(true)
      expect(onCopy).toHaveBeenCalledTimes(1)
    })
    expect(window.electronAPI.clearClipboardAfter).toHaveBeenCalledWith(
      'secret',
      1000
    )
  })

  it('resets isCopied to false after 2 seconds', async () => {
    jest.useFakeTimers()
    const { result } = renderHook(() => useCopyToClipboard())

    await waitFor(() => {
      expect(result.current.isCopyToClipboardDisabled).toBe(false)
    })

    await act(async () => {
      result.current.copyToClipboard('secret')
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.isCopied).toBe(true)
    })

    act(() => {
      jest.advanceTimersByTime(2000)
    })

    expect(result.current.isCopied).toBe(false)
    jest.useRealTimers()
  })

  it('logs and returns false when text is invalid', async () => {
    const { result } = renderHook(() => useCopyToClipboard())

    await waitFor(() => {
      expect(result.current.isCopyToClipboardDisabled).toBe(false)
    })

    let copied
    await act(async () => {
      copied = result.current.copyToClipboard(undefined)
    })

    expect(copied).toBe(false)
    expect(logger.error).toHaveBeenCalledWith(
      'useCopyToClipboard',
      'Text to copy is invalid or undefined'
    )
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('logs and returns false when Clipboard API is unavailable', async () => {
    const { result } = renderHook(() => useCopyToClipboard())

    await waitFor(() => {
      expect(result.current.isCopyToClipboardDisabled).toBe(false)
    })

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: undefined
    })

    let copied
    await act(async () => {
      copied = result.current.copyToClipboard('secret')
    })

    expect(copied).toBe(false)
    expect(logger.error).toHaveBeenCalledWith(
      'useCopyToClipboard',
      'Clipboard API is not available'
    )
  })

  it('logs write failure when clipboard write rejects', async () => {
    const error = new Error('copy failed')
    navigator.clipboard.writeText.mockRejectedValueOnce(error)

    const { result } = renderHook(() => useCopyToClipboard())

    await waitFor(() => {
      expect(result.current.isCopyToClipboardDisabled).toBe(false)
    })

    let copied
    await act(async () => {
      copied = result.current.copyToClipboard('secret')
      await Promise.resolve()
    })

    expect(copied).toBe(true)
    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        'useCopyToClipboard',
        'Failed to copy text to clipboard',
        error
      )
    })
  })
})
