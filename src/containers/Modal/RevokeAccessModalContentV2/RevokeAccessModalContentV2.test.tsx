import React from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { kickDevice, useVault } from 'lockwright-lib-vault'

import { RevokeAccessModalContentV2 } from './RevokeAccessModalContentV2'
import { useModal } from '../../../context/ModalContext'
import { useToast } from '../../../context/ToastContext'
import { useTranslation } from '../../../hooks/useTranslation'

jest.mock('lockwright-lib-vault', () => ({
  kickDevice: jest.fn(),
  useVault: jest.fn()
}))

jest.mock('../../../context/ModalContext', () => ({
  useModal: jest.fn()
}))

jest.mock('../../../context/ToastContext', () => ({
  useToast: jest.fn()
}))

jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: jest.fn()
}))

jest.mock('../../../utils/logger', () => ({
  logger: { error: jest.fn() }
}))

jest.mock('lockwright-lib-ui-react-native-components', () => ({
  rawTokens: new Proxy({}, { get: () => 0 }),
  useTheme: () => ({ theme: { colors: {} } }),
  Button: ({ children, onClick, disabled, ...rest }: any) => (
    <button type="button" onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
  Dialog: ({ children, footer }: any) => (
    <div>
      {children}
      {footer}
    </div>
  ),
  Text: ({ children }: any) => <span>{children}</span>
}))

const mockedKickDevice = jest.mocked(kickDevice)

describe('RevokeAccessModalContentV2', () => {
  const closeModal = jest.fn()
  const setToast = jest.fn<(toast: { message: string }) => void>()
  const t = (s: string, values?: Record<string, unknown>) =>
    s.replace(/\{(\w+)\}/g, (_, k) => String(values?.[k] ?? `{${k}}`))

  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useVault).mockReturnValue({
      data: {
        id: 'v1',
        devices: [
          { id: 'd1', name: 'Laptop' },
          { id: 'd2', name: 'Old Phone' },
          { id: 'd3' }
        ]
      }
    } as unknown as ReturnType<typeof useVault>)
    jest.mocked(useModal).mockReturnValue({
      closeModal
    } as unknown as ReturnType<typeof useModal>)
    jest.mocked(useToast).mockReturnValue({
      setToast
    } as unknown as ReturnType<typeof useToast>)
    jest.mocked(useTranslation).mockReturnValue({
      t
    } as unknown as ReturnType<typeof useTranslation>)
  })

  const revoke = async (resolved: unknown) => {
    mockedKickDevice.mockResolvedValue(resolved as never)
    render(
      <RevokeAccessModalContentV2
        vaultId="v1"
        targetDeviceId="d9"
        deviceName="Lost Laptop"
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByTestId('revoke-access-submit-v2'))
    })
    expect(mockedKickDevice).toHaveBeenCalledWith({
      vaultId: 'v1',
      targetDeviceId: 'd9'
    })
    return setToast.mock.calls.map(([toast]) => toast.message)
  }

  it('says the key rotates, synced items stay, and older versions must update', () => {
    mockedKickDevice.mockResolvedValue({} as never)
    render(
      <RevokeAccessModalContentV2
        vaultId="v1"
        targetDeviceId="d9"
        deviceName="Lost Laptop"
      />
    )
    const body = screen.getByTestId('revoke-access-body-v2').textContent
    expect(body).toContain(
      'Revoking removes this device from the vault and rotates the vault key. It can no longer read items added or changed from now on.'
    )
    expect(body).toContain(
      'Items already on the device: anything it synced before now stays there. Revoking cannot delete it. Change passwords the device could see, especially if it was lost or stolen.'
    )
    expect(body).toContain(
      'Older versions: devices still on an older Lockwright version must update before they can read new items.'
    )
    expect(body).not.toContain('synced later')
    expect(body).not.toContain('new vault')
  })

  it('shows only the success toast when the key rotated to every device', async () => {
    const messages = await revoke({
      results: [{ targetDeviceId: 'd9', channel: 'outbox' }],
      failures: [],
      epoch: { rotated: true, id: 'e1', seq: 2, members: ['d1'], uncovered: [] }
    })
    expect(closeModal).toHaveBeenCalled()
    expect(messages).toEqual(['Device can no longer edit this vault'])
  })

  it('names the uncovered devices after a rotation', async () => {
    const messages = await revoke({
      results: [{ targetDeviceId: 'd9', channel: 'outbox' }],
      failures: [],
      epoch: {
        rotated: true,
        id: 'e1',
        seq: 2,
        members: ['d1'],
        uncovered: ['d2', 'd3']
      }
    })
    expect(messages).toEqual([
      'Device can no longer edit this vault',
      "Old Phone, d3 can't read new items until they open this vault once on a current Lockwright version."
    ])
  })

  it('warns with the reason when the key did not rotate', async () => {
    const messages = await revoke({
      results: [{ targetDeviceId: 'd9', channel: 'outbox' }],
      failures: [{ targetDeviceId: 'd9', error: new Error('not-writable') }],
      epoch: { rotated: false, reason: 'not-writable', uncovered: [] }
    })
    expect(messages).toEqual([
      "Couldn't rotate the vault key (not-writable). The revoked device can still read new items."
    ])
  })

  it('shows the success toast when another device already rotated the key', async () => {
    const messages = await revoke({
      results: [{ targetDeviceId: 'd9', channel: 'outbox' }],
      failures: [],
      epoch: { rotated: false, reason: 'current', uncovered: [] }
    })
    expect(messages).toEqual(['Device can no longer edit this vault'])
  })

  it('still names uncovered devices when the key was already current', async () => {
    const messages = await revoke({
      results: [{ targetDeviceId: 'd9', channel: 'outbox' }],
      failures: [],
      epoch: { rotated: false, reason: 'current', uncovered: ['d2'] }
    })
    expect(messages).toEqual([
      'Device can no longer edit this vault',
      "Old Phone can't read new items until they open this vault once on a current Lockwright version."
    ])
  })

  it('warns when kickDevice returns no rotation result', async () => {
    const messages = await revoke({
      results: [{ targetDeviceId: 'd9', channel: 'outbox' }],
      failures: [],
      epoch: null
    })
    expect(messages).toEqual([
      "Couldn't rotate the vault key. The revoked device can still read new items."
    ])
  })
})
