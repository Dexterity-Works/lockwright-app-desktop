import { act, renderHook } from '@testing-library/react'
import {
  useCreateVault,
  useVault,
  useVaults
} from 'lockwright-lib-vault'
import { pearpassVaultClient } from 'lockwright-lib-vault/src/instances'

import { useTranslation } from './useTranslation'
import { useVaultAccessRevoked } from './useVaultAccessRevoked'
import { useVaultSwitch } from './useVaultSwitch'
import { useModal } from '../context/ModalContext'
import { useRouter } from '../context/RouterContext'
import { useToast } from '../context/ToastContext'

jest.mock('lockwright-lib-vault', () => ({
  useCreateVault: jest.fn(),
  useVault: jest.fn(),
  useVaults: jest.fn()
}))

jest.mock('lockwright-lib-vault/src/instances', () => ({
  pearpassVaultClient: {
    on: jest.fn(),
    off: jest.fn()
  }
}))

jest.mock('./useVaultSwitch', () => ({
  useVaultSwitch: jest.fn()
}))

jest.mock('./useTranslation', () => ({
  useTranslation: jest.fn()
}))

jest.mock('../context/ModalContext', () => ({
  useModal: jest.fn()
}))

jest.mock('../context/RouterContext', () => ({
  useRouter: jest.fn()
}))

jest.mock('../context/ToastContext', () => ({
  useToast: jest.fn()
}))

jest.mock('../containers/Modal/AccessRemovedModalContent', () => ({
  AccessRemovedModalContent: jest.fn(() => null)
}))

jest.mock('../utils/logger', () => ({
  logger: { error: jest.fn() }
}))

// Tests are intentionally loose about the per-hook return shapes; the
// `as unknown as` casts on mockReturnValue keep TS happy without dragging
// in the full hook types for every test.
const mockUseVault = jest.mocked(useVault)
const mockUseVaults = jest.mocked(useVaults)
const mockUseCreateVault = jest.mocked(useCreateVault)
const mockUseVaultSwitch = jest.mocked(useVaultSwitch)
const mockUseModal = jest.mocked(useModal)
const mockUseRouter = jest.mocked(useRouter)
const mockUseToast = jest.mocked(useToast)
const mockUseTranslation = jest.mocked(useTranslation)
const mockOn = jest.fn<(event: string, handler: (payload: unknown) => void) => void>()
const mockOff = jest.fn<(event: string, handler: (payload: unknown) => void) => void>()
;(pearpassVaultClient as unknown as { on: typeof mockOn; off: typeof mockOff }).on = mockOn
;(pearpassVaultClient as unknown as { on: typeof mockOn; off: typeof mockOff }).off = mockOff

describe('useVaultAccessRevoked', () => {
  const setModal = jest.fn()
  const setToast = jest.fn()
  const navigate = jest.fn()
  const deleteVaultLocal = jest.fn<(id: string) => Promise<void>>()
  const switchVault = jest.fn<(v: unknown) => Promise<void>>()
  const createVault = jest.fn<(args: { name: string }) => Promise<void>>()
  const addDevice = jest.fn<() => Promise<void>>()
  const t = jest.fn((s: string) => s)

  const activeVault = { id: 'v-active', name: 'Active', devices: [] }
  const otherVault = { id: 'v-other', name: 'Other' }

  let revokedHandler: (payload: unknown) => void = () => {}

  beforeEach(() => {
    jest.clearAllMocks()

    mockOn.mockImplementation(
      (event: string, handler: (payload: unknown) => void) => {
        if (event === 'vault-access-revoked') revokedHandler = handler
      }
    )

    mockUseModal.mockReturnValue({ setModal } as unknown as ReturnType<typeof useModal>)
    mockUseToast.mockReturnValue({ setToast } as unknown as ReturnType<typeof useToast>)
    mockUseRouter.mockReturnValue({ navigate } as unknown as ReturnType<typeof useRouter>)
    mockUseVaultSwitch.mockReturnValue({ switchVault } as unknown as ReturnType<typeof useVaultSwitch>)
    mockUseCreateVault.mockReturnValue({ createVault } as unknown as ReturnType<typeof useCreateVault>)
    mockUseTranslation.mockReturnValue({ t } as unknown as ReturnType<typeof useTranslation>)

    mockUseVaults.mockReturnValue({
      data: [activeVault, otherVault]
    } as unknown as ReturnType<typeof useVaults>)
    mockUseVault.mockReturnValue({
      data: activeVault,
      deleteVaultLocal,
      addDevice
    } as unknown as ReturnType<typeof useVault>)

    deleteVaultLocal.mockResolvedValue(undefined)
    switchVault.mockResolvedValue(undefined)
    createVault.mockResolvedValue(undefined)
    addDevice.mockResolvedValue(undefined)
  })

  it('subscribes on mount and unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useVaultAccessRevoked())
    expect(mockOn).toHaveBeenCalledWith(
      'vault-access-revoked',
      expect.any(Function)
    )
    unmount()
    expect(mockOff).toHaveBeenCalledWith(
      'vault-access-revoked',
      expect.any(Function)
    )
  })

  it('ignores payloads with no vaultId or unknown vault', async () => {
    renderHook(() => useVaultAccessRevoked())
    await act(async () => revokedHandler({}))
    await act(async () => revokedHandler({ vaultId: 'v-unknown' }))
    expect(deleteVaultLocal).not.toHaveBeenCalled()
    expect(setModal).not.toHaveBeenCalled()
  })

  it('wipes the active vault and switches to the next when one exists', async () => {
    renderHook(() => useVaultAccessRevoked())
    await act(async () => revokedHandler({ vaultId: 'v-active' }))

    expect(deleteVaultLocal).toHaveBeenCalledWith('v-active')
    expect(switchVault).toHaveBeenCalledWith(otherVault)
    expect(createVault).not.toHaveBeenCalled()
    expect(setModal).toHaveBeenCalledTimes(1)
  })

  it('falls back to a Personal vault when no other vault remains', async () => {
    mockUseVaults.mockReturnValue({ data: [activeVault] } as unknown as ReturnType<typeof useVaults>)

    renderHook(() => useVaultAccessRevoked())
    await act(async () => revokedHandler({ vaultId: 'v-active' }))

    expect(createVault).toHaveBeenCalled()
    expect(addDevice).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('vault', { recordType: 'all' })
    expect(setToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/Personal/)
      })
    )
  })

  it('toasts a recovery error when fallback Personal creation fails', async () => {
    mockUseVaults.mockReturnValue({ data: [activeVault] } as unknown as ReturnType<typeof useVaults>)
    createVault.mockRejectedValue(new Error('boom'))

    renderHook(() => useVaultAccessRevoked())
    await act(async () => revokedHandler({ vaultId: 'v-active' }))

    expect(setToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/Couldn't create a starter vault/)
      })
    )
  })

  it('still shows the access-removed modal when delete fails locally', async () => {
    deleteVaultLocal.mockRejectedValue(new Error('disk-full'))

    renderHook(() => useVaultAccessRevoked())
    await act(async () => revokedHandler({ vaultId: 'v-active' }))

    expect(setModal).toHaveBeenCalledTimes(1)
    expect(switchVault).not.toHaveBeenCalled()
    expect(createVault).not.toHaveBeenCalled()
  })
})
