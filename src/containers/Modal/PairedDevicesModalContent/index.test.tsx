import React from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { getMyDeviceId, getVaultKeyState, useVault } from 'lockwright-lib-vault'
import { pearpassVaultClient } from 'lockwright-lib-vault/src/instances'

import { PairedDevicesModalContent } from './index'

jest.mock('lockwright-lib-vault', () => ({
  getMyDeviceId: jest.fn(),
  getVaultKeyState: jest.fn(),
  useVault: jest.fn()
}))

jest.mock('lockwright-lib-vault/src/instances', () => ({
  pearpassVaultClient: { activeVaultEnsureEpoch: jest.fn() }
}))

jest.mock('lockwright-lib-ui-react-native-components', () => ({
  useTheme: () => ({ theme: { colors: {} } }),
  Button: ({ children, onClick, 'data-testid': testId }: any) => (
    <button type="button" data-testid={testId} onClick={onClick}>
      {children}
    </button>
  ),
  ContextMenu: ({ children }: any) => <div>{children}</div>,
  Dialog: ({ children }: any) => <div>{children}</div>,
  ListItem: ({ title, subtitle, testID, rightElement }: any) => (
    <div data-testid={testID}>
      <span>{title}</span>
      {subtitle && <span data-testid={`${testID}-subtitle`}>{subtitle}</span>}
      {rightElement}
    </div>
  ),
  NavbarListItem: () => null,
  Text: ({ children, 'data-testid': testId }: any) => (
    <p data-testid={testId}>{children}</p>
  )
}))

jest.mock(
  'lockwright-lib-ui-react-native-components/icons',
  () => new Proxy({}, { get: () => () => null })
)

jest.mock('./styles', () => ({
  DEVICE_ACTIONS_MENU_WIDTH: 220,
  createStyles: () => ({})
}))

jest.mock('../../../context/ModalContext', () => ({
  useModal: () => ({ closeModal: jest.fn(), setModal: jest.fn() })
}))

jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (s: string, values?: Record<string, unknown>) =>
      s.replace(/\{(\w+)\}/g, (_, k) => String(values?.[k] ?? `{${k}}`))
  })
}))

jest.mock('../../../utils/logger', () => ({
  logger: { error: jest.fn() }
}))

jest.mock('../RevokeAccessModalContentV2', () => ({
  RevokeAccessModalContentV2: () => null
}))

// Local time, so the formatted date does not depend on the time zone.
const ROTATED_AT = new Date(2026, 9, 24, 14, 5).getTime()
const keyState = (overrides = {}) => ({
  vaultId: 'v1',
  epoch: 'e2',
  legacy: false,
  canRead: true,
  members: ['d1', 'k1'],
  rotatedAt: ROTATED_AT,
  removed: [{ id: 'k1', name: 'Old Phone' }],
  ...overrides
})

describe('PairedDevicesModalContent', () => {
  const ensureEpoch = jest.mocked(pearpassVaultClient.activeVaultEnsureEpoch)

  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(getMyDeviceId).mockResolvedValue('d1')
    jest.mocked(useVault).mockReturnValue({
      data: { id: 'v1', devices: [{ id: 'd1', name: 'Laptop' }] }
    } as unknown as ReturnType<typeof useVault>)
    jest.mocked(getVaultKeyState).mockResolvedValue(keyState())
  })

  const open = async () => {
    await act(async () => {
      render(<PairedDevicesModalContent />)
    })
  }

  it('says when the vault key last rotated', async () => {
    await open()

    expect(screen.getByTestId('see-devices-key-rotated').textContent).toBe(
      'Vault key last rotated 24 Oct 2026 14:05'
    )
  })

  it('keeps a removed device listed as key rotating while another device has to rotate', async () => {
    jest
      .mocked(getVaultKeyState)
      .mockResolvedValue(keyState({ canRead: false }))

    await open()

    expect(screen.getByTestId('see-devices-removed-k1').textContent).toContain(
      'Old Phone'
    )
    expect(
      screen.getByTestId('see-devices-removed-k1-subtitle').textContent
    ).toBe('Removed · key rotating')
    expect(screen.queryByTestId('see-devices-rotate-k1')).toBeNull()
  })

  it('keeps a removed device listed as key not rotated, with Rotate key now', async () => {
    await open()

    expect(
      screen.getByTestId('see-devices-removed-k1-subtitle').textContent
    ).toBe('Removed · key not rotated')

    jest
      .mocked(getVaultKeyState)
      .mockResolvedValue(keyState({ members: ['d1'], removed: [] }))
    await act(async () => {
      fireEvent.click(screen.getByTestId('see-devices-rotate-k1'))
    })

    expect(ensureEpoch).toHaveBeenCalledWith({ start: true })
    expect(screen.queryByTestId('see-devices-removed-k1')).toBeNull()
  })

  it('keeps the newest key-state read when an older one resolves last', async () => {
    type KeyState = Awaited<ReturnType<typeof getVaultKeyState>>
    let resolveFirst: (value: KeyState) => void = () => {}
    jest.mocked(getVaultKeyState).mockReturnValueOnce(
      new Promise<KeyState>((resolve) => {
        resolveFirst = resolve
      })
    )
    jest
      .mocked(getVaultKeyState)
      .mockResolvedValue(keyState({ members: ['d1'], removed: [] }))
    let view: ReturnType<typeof render> | undefined
    await act(async () => {
      view = render(<PairedDevicesModalContent />)
    })

    // The device list changes, so the list reads the key state again.
    jest.mocked(useVault).mockReturnValue({
      data: { id: 'v1', devices: [{ id: 'd1', name: 'Laptop' }] }
    } as unknown as ReturnType<typeof useVault>)
    await act(async () => {
      view?.rerender(<PairedDevicesModalContent />)
    })
    await act(async () => {
      resolveFirst(keyState() as KeyState)
    })

    expect(getVaultKeyState).toHaveBeenCalledTimes(2)
    expect(screen.queryByTestId('see-devices-removed-k1')).toBeNull()
  })

  it("drops the old vault's rows after a switch, even when the new read fails", async () => {
    let view: ReturnType<typeof render> | undefined
    await act(async () => {
      view = render(<PairedDevicesModalContent />)
    })
    expect(screen.getByTestId('see-devices-removed-k1')).toBeTruthy()

    jest.mocked(useVault).mockReturnValue({
      data: { id: 'v2', devices: [{ id: 'd2', name: 'Laptop' }] }
    } as unknown as ReturnType<typeof useVault>)
    jest.mocked(getVaultKeyState).mockRejectedValue(new Error('switching'))
    await act(async () => {
      view?.rerender(<PairedDevicesModalContent />)
    })

    expect(screen.queryByTestId('see-devices-removed-k1')).toBeNull()
    expect(screen.queryByTestId('see-devices-key-rotated')).toBeNull()
  })

  it('names a removed device without a name as Unknown Device', async () => {
    jest
      .mocked(getVaultKeyState)
      .mockResolvedValue(keyState({ removed: [{ id: 'k1', name: null }] }))

    await open()

    expect(screen.getByTestId('see-devices-removed-k1').textContent).toContain(
      'Unknown Device'
    )
  })

  it('shows no key state for another vault', async () => {
    jest
      .mocked(getVaultKeyState)
      .mockResolvedValue(keyState({ vaultId: 'v2' }))

    await open()

    expect(screen.queryByTestId('see-devices-key-rotated')).toBeNull()
    expect(screen.queryByTestId('see-devices-removed-k1')).toBeNull()
  })

  it('shows no rotation time for a vault without rotating keys', async () => {
    jest.mocked(getVaultKeyState).mockResolvedValue(
      keyState({
        epoch: null,
        legacy: true,
        members: [],
        rotatedAt: null,
        removed: []
      })
    )

    await open()

    expect(screen.queryByTestId('see-devices-key-rotated')).toBeNull()
  })

  it('shows the empty state when there are no synced or removed devices', async () => {
    jest.mocked(useVault).mockReturnValue({
      data: { id: 'v1', devices: [] }
    } as unknown as ReturnType<typeof useVault>)
    jest.mocked(getVaultKeyState).mockResolvedValue(
      keyState({ members: ['d1'], removed: [] })
    )

    await open()

    expect(screen.getByText('No devices synced yet')).toBeInTheDocument()
  })
})
