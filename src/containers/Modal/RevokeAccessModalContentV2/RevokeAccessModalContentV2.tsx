import React, { useEffect, useRef, useState } from 'react'

import { Button, Dialog, Text, useTheme } from 'lockwright-lib-ui-react-native-components'
import { kickDevice, useVault, waitForKeyRotation } from 'lockwright-lib-vault'

import { createStyles } from './RevokeAccessModalContentV2.styles'
import { useModal, useModalEntryId } from '../../../context/ModalContext'
import { useToast } from '../../../context/ToastContext'
import { useTranslation } from '../../../hooks/useTranslation'
import { formatDateTime } from '../../../utils/date'
import { getDeviceDisplayName } from '../../../utils/getDeviceDisplayName'
import { logger } from '../../../utils/logger'

export type RevokeAccessModalContentV2Props = {
  vaultId: string
  targetDeviceId: string
  deviceName: string
  onClose?: () => void
}

type KickResult = Awaited<ReturnType<typeof kickDevice>>

// After the kick the device is out of the roster. It counts as revoked only
// once the vault's key has rotated past it.
type Outcome =
  | { kind: 'rotating' }
  | { kind: 'rotated'; at: number }
  | { kind: 'pending' }
  | { kind: 'failed' }
  | { kind: 'unknown' }

// The native-messaging path caps a call at 45 s; the in-process path gets a
// little more before the dialog hands control back. The wait for the key
// rotation shares the same deadline.
export const KICK_TIMEOUT_MS = 50_000

export const RevokeAccessModalContentV2 = ({
  vaultId,
  targetDeviceId,
  deviceName,
  onClose
}: RevokeAccessModalContentV2Props) => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const styles = createStyles()
  const { closeModal: closeModals, setClosable } = useModal()
  // Act on this dialog's own entry: another modal may open on top while
  // the revoke runs.
  const entryId = useModalEntryId()
  const closeModal = () => closeModals(entryId)
  const { setToast } = useToast()
  const { data: vaultData } = useVault()

  const handleClose = onClose ?? closeModal

  const [isLoading, setIsLoading] = useState(false)
  const [outcome, setOutcomeState] = useState<Outcome | null>(null)
  const detailFor = (kind: Outcome['kind']) => {
    switch (kind) {
      case 'pending':
        return t(
          "{deviceName} can't change this vault. The vault key will rotate when the vault next syncs. Until then it can still read new items.",
          { deviceName }
        )
      case 'failed':
        return t(
          "{deviceName} can't change this vault, but it can still read new items until the key rotates.",
          { deviceName }
        )
      case 'unknown':
        return t(
          "The revoke didn't finish in time, so the result is unknown. Check the device list after the next sync."
        )
      default:
        return null
    }
  }
  // The warning still on screen. A forced close on lock unmounts the dialog
  // before the user reads it, so the unmount toasts it instead. Closing
  // from the dialog's own buttons clears it first.
  const unreadWarningRef = useRef<string | null>(null)
  const outcomeRef = useRef<Outcome | null>(null)
  const setOutcome = (next: Outcome | null) => {
    outcomeRef.current = next
    unreadWarningRef.current = next ? detailFor(next.kind) : null
    setOutcomeState(next)
  }
  const settled = !!outcome && outcome.kind !== 'rotating'
  const labelFor = (current: Outcome) => {
    switch (current.kind) {
      case 'rotated':
        return t('Revoked · key rotated {dateTime}', {
          dateTime: formatDateTime(current.at)
        })
      case 'failed':
        return t('Removed · key not rotated')
      case 'unknown':
        return null
      default:
        return t('Removed · key rotating')
    }
  }
  const setToastRef = useRef(setToast)
  setToastRef.current = setToast
  const dismiss = () => {
    unreadWarningRef.current = null
    handleClose()
  }
  const doneRef = useRef<HTMLButtonElement>(null)
  const deadlineRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const waitRef = useRef<AbortController | null>(null)

  const clearDeadline = () => {
    if (deadlineRef.current !== null) {
      clearTimeout(deadlineRef.current)
      deadlineRef.current = null
    }
  }

  // A late kickDevice result must not touch state or close whatever modal
  // is on top once this one is gone.
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearDeadline()
      waitRef.current?.abort()
      if (unreadWarningRef.current) {
        setToastRef.current({ message: unreadWarningRef.current })
      }
    }
  }, [])

  useEffect(() => {
    if (settled) doneRef.current?.focus()
  }, [settled])

  const onRevoke = async () => {
    if (isLoading) return
    setIsLoading(true)
    setClosable(entryId, false)
    const wait = new AbortController()
    waitRef.current = wait
    // A hung kickDevice would otherwise leave lock or restart as the only
    // way out. A rotation not seen by then stays "key rotating".
    deadlineRef.current = setTimeout(() => {
      deadlineRef.current = null
      wait.abort()
      if (!mounted.current) return
      setIsLoading(false)
      setClosable(entryId, true)
      setOutcome({ kind: outcomeRef.current ? 'pending' : 'unknown' })
    }, KICK_TIMEOUT_MS)
    try {
      await revoke(wait.signal)
    } finally {
      clearDeadline()
      if (mounted.current) {
        setIsLoading(false)
        setClosable(entryId, true)
      }
    }
  }

  // Shows the outcome, or toasts its warning once the dialog is gone.
  const show = (next: Outcome) => {
    if (mounted.current) setOutcome(next)
    else if (next.kind !== 'rotating' && next.kind !== 'rotated') {
      setToast({ message: detailFor(next.kind) as string })
    }
  }

  const revoke = async (signal: AbortSignal) => {
    let result: KickResult
    try {
      result = await kickDevice({ vaultId, targetDeviceId })
    } catch (error) {
      logger.error('RevokeAccessModalContentV2', 'kickDevice failed:', error)
      if (mounted.current) setOutcome(null)
      setToast({
        message: t("Couldn't revoke access. Please try again.")
      })
      return
    }

    const failures = result?.failures ?? []
    const epoch = result?.epoch ?? null
    const rotationFailed = failures.some((failure) => failure?.kind === 'epoch')

    // No rotation result and no rotation failure: kickDevice stopped before
    // the rotation step, so the device is still in the roster.
    if (!epoch && !rotationFailed) {
      if (mounted.current) setOutcome(null)
      setToast({
        message: t("Couldn't revoke access. Please try again.")
      })
      return
    }

    if (failures.some((failure) => !failure?.kind)) {
      setToast({
        message: t(
          "Couldn't reach the device. It will stop editing next time it comes online."
        )
      })
    }

    // 'current': the latest key already leaves this device out.
    // 'pending': another member rotates when it syncs.
    if (
      !epoch ||
      (!epoch.rotated &&
        epoch.reason !== 'current' &&
        epoch.reason !== 'pending')
    ) {
      logger.warn(
        'RevokeAccessModalContentV2',
        'vault key did not rotate:',
        epoch?.reason
      )
      show({ kind: 'failed' })
      return
    }

    // A late kick is past the deadline: the rotation is not confirmed.
    if (epoch.reason === 'pending' || signal.aborted) {
      show({ kind: 'pending' })
    } else {
      show({ kind: 'rotating' })
      const state = await waitForKeyRotation({
        vaultId,
        deviceId: targetDeviceId,
        timeoutMs: KICK_TIMEOUT_MS,
        signal
      })
      if (state) {
        show({ kind: 'rotated', at: state.rotatedAt ?? Date.now() })
        setToast({
          message: t('{deviceName} revoked. Vault key rotated.', { deviceName })
        })
      } else {
        show({ kind: 'pending' })
      }
    }

    if (epoch.uncovered?.length) {
      const devices: Array<{ id?: string; name?: string }> = Array.isArray(
        vaultData?.devices
      )
        ? vaultData.devices
        : []
      const deviceNames = [
        ...new Set(
          epoch.uncovered.map((id) =>
            getDeviceDisplayName(
              devices.find((device) => device.id === id)?.name,
              t
            )
          )
        )
      ].join(', ')
      setToast({
        message: t(
          "{deviceNames} can't read new items until they open this vault once on a current Lockwright version.",
          { deviceNames }
        )
      })
    }
  }

  return (
    <Dialog
      title={t('Revoke {deviceName}?', { deviceName })}
      onClose={isLoading ? undefined : dismiss}
      testID="revoke-access-dialog-v2"
      closeButtonTestID="revoke-access-close-v2"
      footer={
        settled ? (
          <Button
            ref={doneRef}
            variant="primary"
            size="small"
            type="button"
            onClick={dismiss}
            data-testid="revoke-access-done-v2"
          >
            {t('Done')}
          </Button>
        ) : (
        <>
          <Button
            variant="secondary"
            size="small"
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            data-testid="revoke-access-cancel-v2"
          >
            {t('Cancel')}
          </Button>
          <Button
            variant="destructive"
            size="small"
            type="button"
            isLoading={isLoading}
            onClick={onRevoke}
            data-testid="revoke-access-submit-v2"
          >
            {t('Revoke Access')}
          </Button>
        </>
        )
      }
    >
      <div style={styles.body} data-testid="revoke-access-body-v2">
        {outcome && (
          <div
            role={detailFor(outcome.kind) ? 'alert' : 'status'}
            data-testid="revoke-access-warning-v2"
          >
            {labelFor(outcome) && (
              <Text as="p" variant="labelEmphasized">
                {labelFor(outcome)}
              </Text>
            )}
            {detailFor(outcome.kind) && (
              <Text as="p" variant="caption">
                {detailFor(outcome.kind)}
              </Text>
            )}
          </div>
        )}
        {[
          {
            intro: t('Revoking this device:'),
            items: [
              t("removes it from the vault, so it can't add or change items"),
              t(
                "rotates the vault key, so it can't read anything saved or changed after that"
              )
            ]
          },
          {
            intro: t("It doesn't:"),
            items: [
              t(
                "erase what's already on the device. It can still read every item it synced before the key rotated."
              )
            ]
          }
        ].map(({ intro, items }) => (
          <div key={intro} style={styles.intro}>
            <Text
              as="p"
              variant="caption"
              color={theme.colors.colorTextSecondary}
            >
              {intro}
            </Text>
            <ul style={styles.bulletList}>
              {items.map((item) => (
                <li key={item} style={styles.bulletItem}>
                  <Text as="span" variant="caption">
                    {item}
                  </Text>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <Text as="p" variant="caption" color={theme.colors.colorTextSecondary}>
          {t(
            'If the device was lost or stolen, change the passwords it could see.'
          )}
        </Text>
      </div>
    </Dialog>
  )
}
