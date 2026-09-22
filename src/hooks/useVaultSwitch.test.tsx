import React from 'react'

import { act, renderHook } from '@testing-library/react'
import '@testing-library/jest-dom'

import { type Vault, useVault } from 'lockwright-lib-vault'

import { useVaultSwitch } from './useVaultSwitch'

const mockSetIsLoading = jest.fn()
const mockSetModal = jest.fn()
const mockCloseModal = jest.fn()
const mockRefetchVault = jest.fn(() => Promise.resolve())
const mockIsVaultProtected = jest.fn(() => Promise.resolve(false))
const mockLoggerError = jest.fn()

const vaultA: Vault = { id: 'vault-a', name: 'Alpha' }
const vaultB: Vault = { id: 'vault-b', name: 'Bravo' }

const mockUseVault = jest.mocked(useVault)

jest.mock('lockwright-lib-vault', () => ({
  useVault: jest.fn()
}))

jest.mock('../context/LoadingContext', () => ({
  useLoadingContext: () => ({ setIsLoading: mockSetIsLoading })
}))

jest.mock('../context/ModalContext', () => ({
  useModal: () => ({
    setModal: mockSetModal,
    closeModal: mockCloseModal
  })
}))

jest.mock('../utils/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args)
  }
}))

jest.mock('../containers/Modal/VaultPasswordFormModalContent', () => ({
  VaultPasswordFormModalContent: () => null
}))

describe('useVaultSwitch', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockIsVaultProtected.mockResolvedValue(false)
    mockRefetchVault.mockResolvedValue(undefined)

    mockUseVault.mockReturnValue({
      data: vaultA,
      isVaultProtected: mockIsVaultProtected,
      refetch: mockRefetchVault
    } as unknown as ReturnType<typeof useVault>)
  })

  it('returns switchVault', () => {
    const { result } = renderHook(() => useVaultSwitch())

    expect(result.current).toEqual({ switchVault: expect.any(Function) })
  })

  it('when target is already active, runs onSuccess only (no refetch or password check)', async () => {
    const onSuccess = jest.fn(async () => {})
    const { result } = renderHook(() => useVaultSwitch())

    await act(async () => {
      await result.current.switchVault(vaultA, onSuccess)
    })

    expect(mockIsVaultProtected).not.toHaveBeenCalled()
    expect(mockRefetchVault).not.toHaveBeenCalled()
    expect(mockSetModal).not.toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(mockSetIsLoading).toHaveBeenCalledWith(true)
    expect(mockSetIsLoading).toHaveBeenCalledWith(false)
  })

  it('when target is another vault and unprotected, refetches then runs onSuccess', async () => {
    const onSuccess = jest.fn<() => void | Promise<void>>()
    const { result } = renderHook(() => useVaultSwitch())

    await act(async () => {
      await result.current.switchVault(vaultB, onSuccess)
    })

    expect(mockIsVaultProtected).toHaveBeenCalledWith('vault-b')
    expect(mockRefetchVault).toHaveBeenCalledWith('vault-b')
    expect(mockRefetchVault).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(mockSetModal).not.toHaveBeenCalled()
    expect(mockSetIsLoading).toHaveBeenCalledWith(false)
  })

  it('when vault is protected, opens password modal instead of refetching immediately', async () => {
    mockIsVaultProtected.mockResolvedValueOnce(true)

    const onSuccess = jest.fn<() => void | Promise<void>>()
    const { result } = renderHook(() => useVaultSwitch())

    await act(async () => {
      await result.current.switchVault(vaultB, onSuccess)
    })

    expect(mockSetModal).toHaveBeenCalledTimes(1)
    expect(mockRefetchVault).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()

    const modalEl = mockSetModal.mock.calls[0][0] as React.ReactElement<{
      vault: Vault
      onSubmit: (password: string) => Promise<void>
    }>
    expect(modalEl.props.vault).toEqual(vaultB)
    expect(typeof modalEl.props.onSubmit).toBe('function')
  })

  it('when protected, modal onSubmit refetches with password, closes modal, and runs onSuccess', async () => {
    mockIsVaultProtected.mockResolvedValueOnce(true)

    const onSuccess = jest.fn<() => void | Promise<void>>()
    const { result } = renderHook(() => useVaultSwitch())

    await act(async () => {
      await result.current.switchVault(vaultB, onSuccess)
    })

    const modalEl = mockSetModal.mock.calls[0][0] as React.ReactElement<{
      onSubmit: (password: string) => Promise<void>
    }>

    await act(async () => {
      await modalEl.props.onSubmit('secret-password')
    })

    expect(mockRefetchVault).toHaveBeenCalledWith('vault-b', {
      password: 'secret-password'
    })
    expect(mockCloseModal).toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('logs and rethrows when refetch fails for an unprotected vault', async () => {
    const err = new Error('network')
    mockRefetchVault.mockRejectedValueOnce(err)

    const { result } = renderHook(() => useVaultSwitch())

    let thrown: unknown
    const noopSuccess = async () => {}
    await act(async () => {
      try {
        await result.current.switchVault(vaultB, noopSuccess)
      } catch (e) {
        thrown = e
      }
    })

    expect(thrown).toBe(err)
    expect(mockLoggerError).toHaveBeenCalledWith(
      'useVaultSwitch',
      'Error switching to vault:',
      err
    )
  })
})
