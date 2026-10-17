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
  Button: jest.requireActual<typeof React>('react').forwardRef(
    ({ children, onClick, disabled, ...rest }: any, ref: any) => (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        disabled={disabled}
        {...rest}
      >
        {children}
      </button>
    )
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
          { id: 'd3' },
          { id: 'd4', name: 'Old Phone' },
          { id: 'd5', name: 'ios-17' }
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

  const SUCCESS = 'Device can no longer edit this vault'
  const ROTATION_FAILED =
    "Couldn't rotate the vault key. The revoked device can still read new items."
  // The device is out but the key did not rotate: the dialog stays open with
  // the warning inline and offers only Done.
  const expectInlineWarning = (text: string) => {
    expect(screen.getByRole('alert').textContent).toContain(text)
    expect(screen.queryByTestId('revoke-access-submit-v2')).toBeNull()
    expect(screen.queryByTestId('revoke-access-cancel-v2')).toBeNull()
    const done = screen.getByTestId('revoke-access-done-v2')
    expect(document.activeElement).toBe(done)
    expect(closeModal).not.toHaveBeenCalled()
    fireEvent.click(done)
    expect(closeModal).toHaveBeenCalledTimes(1)
    expect(mockedKickDevice).toHaveBeenCalledTimes(1)
  }
  const UNREACHED =
    "Couldn't reach the device. It will stop editing next time it comes online."
  const outbox = [{ targetDeviceId: 'd9', channel: 'outbox' }]
  const epochFailure = (reason: string) => ({
    targetDeviceId: 'd9',
    kind: 'epoch',
    error: new Error(`epoch rotation failed: ${reason}`)
  })
  const uncoveredToast = (names: string) =>
    `${names} can't read new items until they open this vault once on a current Lockwright version.`

  it('shows only the success toast when the key rotated to every device', async () => {
    const messages = await revoke({
      results: outbox,
      failures: [],
      epoch: { rotated: true, id: 'e1', seq: 2, members: ['d1'], uncovered: [] }
    })
    expect(closeModal).toHaveBeenCalled()
    expect(messages).toEqual([SUCCESS])
  })

  it('names the uncovered devices after a rotation', async () => {
    const messages = await revoke({
      results: outbox,
      failures: [],
      epoch: {
        rotated: true,
        id: 'e1',
        seq: 2,
        members: ['d1'],
        uncovered: ['d2', 'd3', 'd5']
      }
    })
    expect(messages).toEqual([
      SUCCESS,
      uncoveredToast('Old Phone, Unknown Device, iPhone')
    ])
  })

  it('names each uncovered device name once', async () => {
    const messages = await revoke({
      results: outbox,
      failures: [],
      epoch: { rotated: true, uncovered: ['d2', 'd4', 'd3', 'd-gone'] }
    })
    expect(messages).toEqual([
      SUCCESS,
      uncoveredToast('Old Phone, Unknown Device')
    ])
  })

  it('shows the reach failure and the uncovered warning after a rotation', async () => {
    const messages = await revoke({
      results: [],
      failures: [{ targetDeviceId: 'd9', error: new Error('offline') }],
      epoch: { rotated: true, uncovered: ['d2'] }
    })
    expect(messages).toEqual([UNREACHED, uncoveredToast('Old Phone')])
  })

  it('shows the revoke result, then warns with the reason when the key did not rotate', async () => {
    const messages = await revoke({
      results: outbox,
      failures: [epochFailure('not-writable')],
      epoch: { rotated: false, reason: 'not-writable', uncovered: [] }
    })
    expect(messages).toEqual([SUCCESS])
    expectInlineWarning(
      "Couldn't rotate the vault key (not-writable). The revoked device can still read new items."
    )
  })

  it('warns without a reason when the rotation result gives none', async () => {
    const messages = await revoke({
      results: outbox,
      failures: [epochFailure('unknown')],
      epoch: { rotated: false, uncovered: [] }
    })
    expect(messages).toEqual([SUCCESS])
    const warning = screen.getByRole('alert').textContent
    expect(warning).not.toContain('undefined')
    expect(warning).not.toContain('(')
    expectInlineWarning(ROTATION_FAILED)
  })

  it('says another device will rotate when the reason is pending', async () => {
    const messages = await revoke({
      results: outbox,
      failures: [],
      epoch: { rotated: false, reason: 'pending', uncovered: ['d2'] }
    })
    expect(messages).toEqual([
      SUCCESS,
      'Another device will rotate the vault key when it next syncs.',
      uncoveredToast('Old Phone')
    ])
  })

  it('shows the success toast when another device already rotated the key', async () => {
    const messages = await revoke({
      results: outbox,
      failures: [],
      epoch: { rotated: false, reason: 'current', uncovered: [] }
    })
    expect(messages).toEqual([SUCCESS])
    expect(closeModal).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('still names uncovered devices when the key was already current', async () => {
    const messages = await revoke({
      results: outbox,
      failures: [],
      epoch: { rotated: false, reason: 'current', uncovered: ['d2'] }
    })
    expect(messages).toEqual([SUCCESS, uncoveredToast('Old Phone')])
  })

  it('warns when the rotation threw and left no result', async () => {
    const messages = await revoke({
      results: outbox,
      failures: [epochFailure('worklet gone')],
      epoch: null
    })
    expect(messages).toEqual([SUCCESS])
    expectInlineWarning(ROTATION_FAILED)
  })

  it('says the revoke did not complete when the roster removal failed', async () => {
    const messages = await revoke({
      results: outbox,
      failures: [{ targetDeviceId: 'd9', error: new Error('removal failed') }],
      epoch: null
    })
    expect(closeModal).not.toHaveBeenCalled()
    expect(messages).toEqual(["Couldn't revoke access. Please try again."])
  })
})
