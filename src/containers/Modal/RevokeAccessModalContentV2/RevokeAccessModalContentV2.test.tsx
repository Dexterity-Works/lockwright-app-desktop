import React from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { kickDevice, useVault, waitForKeyRotation } from 'lockwright-lib-vault'

import { RevokeAccessModalContentV2 } from './RevokeAccessModalContentV2'
import { useModal } from '../../../context/ModalContext'
import { useToast } from '../../../context/ToastContext'
import { useTranslation } from '../../../hooks/useTranslation'
import { logger } from '../../../utils/logger'

jest.mock('lockwright-lib-vault', () => ({
  kickDevice: jest.fn(),
  useVault: jest.fn(),
  waitForKeyRotation: jest.fn()
}))

jest.mock('../../../context/ModalContext', () => ({
  useModal: jest.fn(),
  useModalEntryId: () => 'revoke-entry'
}))

jest.mock('../../../context/ToastContext', () => ({
  useToast: jest.fn()
}))

jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: jest.fn()
}))

jest.mock('../../../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn() }
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
  Dialog: ({ children, footer, onClose }: any) => (
    <div>
      {onClose && (
        <button type="button" data-testid="dialog-close" onClick={onClose} />
      )}
      {children}
      {footer}
    </div>
  ),
  Text: ({ children }: any) => <span>{children}</span>
}))

const mockedKickDevice = jest.mocked(kickDevice)
const mockedWait = jest.mocked(waitForKeyRotation)
// Local time, so the formatted date does not depend on the time zone.
const ROTATED_AT = new Date(2026, 9, 24, 14, 5).getTime()
const rotatedState = {
  vaultId: 'v1',
  epoch: 'e2',
  legacy: false,
  canRead: true,
  members: ['d1'],
  rotatedAt: ROTATED_AT,
  removed: []
}

describe('RevokeAccessModalContentV2', () => {
  const closeModal = jest.fn()
  const setClosable = jest.fn()
  const setToast = jest.fn<(toast: { message: string }) => void>()
  const t = (s: string, values?: Record<string, unknown>) =>
    s.replace(/\{(\w+)\}/g, (_, k) => String(values?.[k] ?? `{${k}}`))

  beforeEach(() => {
    jest.clearAllMocks()
    // Like the real one: an aborted wait resolves null.
    mockedWait.mockImplementation(async ({ signal }) =>
      signal?.aborted ? null : rotatedState
    )
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
      closeModal,
      setClosable
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
      "Revoking removes this device from the vault and rotates the vault key. Once the key rotates, the device can't read items added or changed after that."
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

  const ROTATED = 'Lost Laptop revoked. Vault key rotated.'
  const ROTATED_LABEL = 'Revoked · key rotated 24 Oct 2026 14:05'
  const PENDING_LABEL = 'Removed · key rotating'
  const PENDING =
    "Lost Laptop can't change this vault. The vault key will rotate when the vault next syncs. Until then it can still read new items."
  const FAILED_LABEL = 'Removed · key not rotated'
  const FAILED =
    "Lost Laptop can't change this vault, but it can still read new items until the key rotates."
  // The dialog stays open with the outcome inline and offers only Done.
  const expectOutcome = (text: string, role = 'alert') => {
    expect(screen.getByRole(role).textContent).toContain(text)
    expect(screen.queryByTestId('revoke-access-submit-v2')).toBeNull()
    expect(screen.queryByTestId('revoke-access-cancel-v2')).toBeNull()
    const done = screen.getByTestId('revoke-access-done-v2')
    expect(document.activeElement).toBe(done)
    expect(closeModal).not.toHaveBeenCalled()
    fireEvent.click(done)
    expect(closeModal.mock.calls).toEqual([['revoke-entry']])
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

  it('says revoked only once the vault key has rotated past the device', async () => {
    const messages = await revoke({
      results: outbox,
      failures: [],
      epoch: { rotated: true, id: 'e1', seq: 2, members: ['d1'], uncovered: [] }
    })
    expect(mockedWait).toHaveBeenCalledWith({
      vaultId: 'v1',
      deviceId: 'd9',
      timeoutMs: 50_000,
      signal: expect.any(AbortSignal)
    })
    expect(messages).toEqual([ROTATED])
    expect(screen.queryByRole('alert')).toBeNull()
    expectOutcome(ROTATED_LABEL, 'status')
  })

  it('shows the key rotating, with no success toast, while it waits', async () => {
    let settle: (state: null) => void = () => {}
    mockedWait.mockReturnValue(new Promise((r) => (settle = r)) as never)
    const messages = await revoke({
      results: outbox,
      failures: [],
      epoch: { rotated: true, uncovered: [] }
    })

    expect(messages).toEqual([])
    expect(screen.getByRole('status').textContent).toBe(PENDING_LABEL)
    expect(setClosable).toHaveBeenLastCalledWith('revoke-entry', false)
    expect(screen.queryByTestId('revoke-access-done-v2')).toBeNull()

    await act(async () => settle(null))

    expect(setToast).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe(PENDING_LABEL + PENDING)
    expectOutcome(PENDING)
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
      ROTATED,
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
      ROTATED,
      uncoveredToast('Old Phone, Unknown Device')
    ])
  })

  it('shows the reach failure and the uncovered warning after a rotation', async () => {
    const messages = await revoke({
      results: [],
      failures: [{ targetDeviceId: 'd9', error: new Error('offline') }],
      epoch: { rotated: true, uncovered: ['d2'] }
    })
    expect(messages).toEqual([UNREACHED, ROTATED, uncoveredToast('Old Phone')])
  })

  for (const reason of [
    'not-writable',
    'self-not-in-roster',
    'legacy',
    'quota-exceeded',
    undefined
  ]) {
    it(`says the key did not rotate, without the reason, for ${reason}`, async () => {
      const messages = await revoke({
        results: outbox,
        failures: [epochFailure(reason ?? 'unknown')],
        epoch: { rotated: false, reason, uncovered: [] }
      })
      expect(messages).toEqual([])
      expect(mockedWait).not.toHaveBeenCalled()
      const text = screen.getByRole('alert').textContent
      expect(text).toBe(FAILED_LABEL + FAILED)
      expect(logger.warn).toHaveBeenCalledWith(
        'RevokeAccessModalContentV2',
        expect.any(String),
        reason
      )
      expectOutcome(FAILED)
    })
  }

  it('says the key is rotating when another device has to rotate it', async () => {
    const messages = await revoke({
      results: outbox,
      failures: [],
      epoch: { rotated: false, reason: 'pending', uncovered: ['d2'] }
    })
    expect(messages).toEqual([uncoveredToast('Old Phone')])
    expect(mockedWait).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe(PENDING_LABEL + PENDING)
    expectOutcome(PENDING)
  })

  it('checks the key when another device already rotated it', async () => {
    const messages = await revoke({
      results: outbox,
      failures: [],
      epoch: { rotated: false, reason: 'current', uncovered: [] }
    })
    expect(mockedWait).toHaveBeenCalledTimes(1)
    expect(messages).toEqual([ROTATED])
    expectOutcome(ROTATED_LABEL, 'status')
  })

  it('still names uncovered devices when the key was already current', async () => {
    const messages = await revoke({
      results: outbox,
      failures: [],
      epoch: { rotated: false, reason: 'current', uncovered: ['d2'] }
    })
    expect(messages).toEqual([ROTATED, uncoveredToast('Old Phone')])
  })

  it('says the key did not rotate when the rotation threw and left no result', async () => {
    const messages = await revoke({
      results: outbox,
      failures: [epochFailure('worklet gone')],
      epoch: null
    })
    expect(messages).toEqual([])
    expectOutcome(FAILED)
  })

  it('says the revoke did not complete when the roster removal failed', async () => {
    const messages = await revoke({
      results: outbox,
      failures: [{ targetDeviceId: 'd9', error: new Error('removal failed') }],
      epoch: null
    })
    expect(closeModal).not.toHaveBeenCalled()
    expect(mockedWait).not.toHaveBeenCalled()
    expect(messages).toEqual(["Couldn't revoke access. Please try again."])
  })

  const pendingKick = () => {
    let resolve: (value: unknown) => void = () => {}
    mockedKickDevice.mockReturnValue(
      new Promise((r) => (resolve = r)) as never
    )
    const view = render(
      <RevokeAccessModalContentV2
        vaultId="v1"
        targetDeviceId="d9"
        deviceName="Lost Laptop"
      />
    )
    fireEvent.click(screen.getByTestId('revoke-access-submit-v2'))
    return { view, resolve: (value: unknown) => resolve(value) }
  }
  const toasts = () => setToast.mock.calls.map(([toast]) => toast.message)

  it('cannot be closed while the revoke runs', async () => {
    const { resolve } = pendingKick()

    expect(setClosable).toHaveBeenLastCalledWith('revoke-entry', false)
    expect(screen.queryByTestId('dialog-close')).toBeNull()

    await act(async () => {
      resolve({
        results: outbox,
        failures: [epochFailure('not-writable')],
        epoch: { rotated: false, reason: 'not-writable', uncovered: [] }
      })
    })

    expect(setClosable).toHaveBeenLastCalledWith('revoke-entry', true)
    expect(screen.getByTestId('dialog-close')).toBeTruthy()
  })

  it('toasts the warning and leaves other modals alone when the dialog is gone', async () => {
    const { view, resolve } = pendingKick()
    view.unmount()

    await act(async () => {
      resolve({
        results: outbox,
        failures: [epochFailure('not-writable')],
        epoch: { rotated: false, reason: 'not-writable', uncovered: [] }
      })
    })

    expect(closeModal).not.toHaveBeenCalled()
    expect(toasts()).toEqual([FAILED])
  })

  it('says the key is rotating, not revoked, when the dialog is gone before the check', async () => {
    const { view, resolve } = pendingKick()
    view.unmount()

    await act(async () => {
      resolve({
        results: outbox,
        failures: [],
        epoch: { rotated: true, uncovered: [] }
      })
    })

    expect(closeModal).not.toHaveBeenCalled()
    expect(toasts()).toEqual([PENDING])
  })

  describe('when a lock closes the dialog after a warning', () => {
    const settleWithWarning = async () => {
      const pending = pendingKick()
      await act(async () => {
        pending.resolve({
          results: outbox,
          failures: [epochFailure('not-writable')],
          epoch: { rotated: false, reason: 'not-writable', uncovered: [] }
        })
      })
      expect(screen.getByRole('alert').textContent).toContain(FAILED)
      return pending
    }

    it('toasts the warning so the lock does not drop it', async () => {
      const { view } = await settleWithWarning()

      // lockAppSession's forced close unmounts the dialog.
      view.unmount()

      expect(toasts()).toEqual([FAILED])
    })

    it('does not repeat the warning after Done', async () => {
      const { view } = await settleWithWarning()

      fireEvent.click(screen.getByTestId('revoke-access-done-v2'))
      view.unmount()

      expect(closeModal.mock.calls).toEqual([['revoke-entry']])
      expect(toasts()).toEqual([])
    })

    it('does not repeat the warning after the close button', async () => {
      const { view } = await settleWithWarning()

      fireEvent.click(screen.getByTestId('dialog-close'))
      view.unmount()

      expect(toasts()).toEqual([])
    })
  })

  describe('when the revoke hangs', () => {
    const TIMED_OUT =
      "The revoke didn't finish in time, so the result is unknown. Check the device list after the next sync."

    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('can be closed again with a warning after 50 s', () => {
      pendingKick()

      act(() => {
        jest.advanceTimersByTime(49_999)
      })
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.queryByTestId('dialog-close')).toBeNull()
      expect(setClosable).toHaveBeenLastCalledWith('revoke-entry', false)

      act(() => {
        jest.advanceTimersByTime(1)
      })
      expect(setClosable).toHaveBeenLastCalledWith('revoke-entry', true)
      expect(screen.getByTestId('dialog-close')).toBeTruthy()
      expect(setToast).not.toHaveBeenCalled()
      expectOutcome(TIMED_OUT)
    })

    it('says the key is rotating when the rotation is not seen by 50 s', async () => {
      mockedWait.mockImplementation(
        ({ signal }) =>
          new Promise((r) => signal?.addEventListener('abort', () => r(null)))
      )
      const { resolve } = pendingKick()
      await act(async () => {
        resolve({ results: outbox, failures: [], epoch: { rotated: true } })
      })
      expect(screen.getByRole('status').textContent).toBe(PENDING_LABEL)

      await act(async () => {
        jest.advanceTimersByTime(50_000)
      })

      expect(setClosable).toHaveBeenLastCalledWith('revoke-entry', true)
      expect(toasts()).toEqual([])
      expectOutcome(PENDING)
    })

    it('never warns when the revoke settles in time', async () => {
      const { resolve } = pendingKick()

      act(() => {
        jest.advanceTimersByTime(49_000)
      })
      await act(async () => {
        resolve({
          results: outbox,
          failures: [],
          epoch: { rotated: true, uncovered: [] }
        })
      })

      act(() => {
        jest.advanceTimersByTime(10_000)
      })
      expect(screen.queryByRole('alert')).toBeNull()
      expect(toasts()).toEqual([ROTATED])
      expectOutcome(ROTATED_LABEL, 'status')
    })

    it('says the key is rotating, not revoked, when the revoke settles late', async () => {
      const { resolve } = pendingKick()

      act(() => {
        jest.advanceTimersByTime(50_000)
      })
      expect(screen.getByRole('alert').textContent).toContain(TIMED_OUT)

      await act(async () => {
        resolve({
          results: outbox,
          failures: [],
          epoch: { rotated: true, uncovered: [] }
        })
      })
      expect(mockedWait).not.toHaveBeenCalled()
      expect(toasts()).toEqual([])
      expectOutcome(PENDING)
    })

    it('toasts the timeout warning when a lock closes the dialog', async () => {
      const { view, resolve } = pendingKick()

      act(() => {
        jest.advanceTimersByTime(50_000)
      })
      expect(screen.getByRole('alert').textContent).toContain(TIMED_OUT)
      view.unmount()
      expect(toasts()).toEqual([TIMED_OUT])

      await act(async () => {
        resolve({
          results: outbox,
          failures: [],
          epoch: { rotated: true, uncovered: [] }
        })
      })
      expect(closeModal).not.toHaveBeenCalled()
      expect(toasts()).toEqual([TIMED_OUT, PENDING])
    })

    it('drops the deadline when the dialog unmounts', async () => {
      const { view, resolve } = pendingKick()
      view.unmount()

      act(() => {
        jest.advanceTimersByTime(60_000)
      })
      await act(async () => {
        resolve({
          results: outbox,
          failures: [],
          epoch: { rotated: true, uncovered: [] }
        })
      })
      expect(setClosable).toHaveBeenLastCalledWith('revoke-entry', false)
      expect(closeModal).not.toHaveBeenCalled()
      expect(toasts()).toEqual([PENDING])
    })
  })
})
