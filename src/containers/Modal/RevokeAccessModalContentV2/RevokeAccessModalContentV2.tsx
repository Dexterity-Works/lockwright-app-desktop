import React, { useEffect, useRef, useState } from 'react'

import { Button, Dialog, Text, useTheme } from 'lockwright-lib-ui-react-native-components'
import { kickDevice, useVault } from 'lockwright-lib-vault'

import { createStyles } from './RevokeAccessModalContentV2.styles'
import { useModal } from '../../../context/ModalContext'
import { useToast } from '../../../context/ToastContext'
import { useTranslation } from '../../../hooks/useTranslation'
import { getDeviceDisplayName } from '../../../utils/getDeviceDisplayName'
import { logger } from '../../../utils/logger'

export type RevokeAccessModalContentV2Props = {
  vaultId: string
  targetDeviceId: string
  deviceName: string
  onClose?: () => void
}

type KickResult = Awaited<ReturnType<typeof kickDevice>>

export const RevokeAccessModalContentV2 = ({
  vaultId,
  targetDeviceId,
  deviceName,
  onClose
}: RevokeAccessModalContentV2Props) => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const styles = createStyles()
  const { closeModal } = useModal()
  const { setToast } = useToast()
  const { data: vaultData } = useVault()

  const handleClose = onClose ?? closeModal

  const [isLoading, setIsLoading] = useState(false)
  // Set once the device is removed but the key did not rotate. The dialog
  // stays open with this warning and only offers Done.
  const [rotationWarning, setRotationWarning] = useState<string | null>(null)
  const doneRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (rotationWarning) doneRef.current?.focus()
  }, [rotationWarning])

  const onRevoke = async () => {
    if (isLoading) return
    setIsLoading(true)
    let result: KickResult
    try {
      result = await kickDevice({ vaultId, targetDeviceId })
    } catch (error) {
      logger.error('RevokeAccessModalContentV2', 'kickDevice failed:', error)
      setToast({
        message: t("Couldn't revoke access. Please try again.")
      })
      setIsLoading(false)
      return
    }

    const failures = result?.failures ?? []
    const epoch = result?.epoch ?? null
    const rotationFailed = failures.some((failure) => failure?.kind === 'epoch')

    // No rotation result and no rotation failure: kickDevice stopped before
    // the rotation step, so the device is still in the roster.
    if (!epoch && !rotationFailed) {
      setToast({
        message: t("Couldn't revoke access. Please try again.")
      })
      setIsLoading(false)
      return
    }

    setToast({
      message: failures.some((failure) => !failure?.kind)
        ? t(
            "Couldn't reach the device. It will stop editing next time it comes online."
          )
        : t('Device can no longer edit this vault')
    })

    // 'current': the latest key already leaves this device out.
    // 'pending': another member rotates when it syncs.
    if (
      !epoch ||
      (!epoch.rotated &&
        epoch.reason !== 'current' &&
        epoch.reason !== 'pending')
    ) {
      setRotationWarning(
        epoch?.reason
          ? t(
              "Couldn't rotate the vault key ({reason}). The revoked device can still read new items.",
              { reason: epoch.reason }
            )
          : t(
              "Couldn't rotate the vault key. The revoked device can still read new items."
            )
      )
      setIsLoading(false)
      return
    }

    closeModal()

    if (epoch.reason === 'pending') {
      setToast({
        message: t('Another device will rotate the vault key when it next syncs.')
      })
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
      title={t('Revoke access for {deviceName}?', { deviceName })}
      onClose={handleClose}
      testID="revoke-access-dialog-v2"
      closeButtonTestID="revoke-access-close-v2"
      footer={
        rotationWarning ? (
          <Button
            ref={doneRef}
            variant="primary"
            size="small"
            type="button"
            onClick={handleClose}
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
        {rotationWarning && (
          <div role="alert" data-testid="revoke-access-warning-v2">
            <Text as="p" variant="caption">
              {rotationWarning}
            </Text>
          </div>
        )}
        <div style={styles.intro}>
          <Text
            as="p"
            variant="caption"
            color={theme.colors.colorTextSecondary}
          >
            {t(
              'Revoking removes this device from the vault and rotates the vault key. It can no longer read items added or changed from now on.'
            )}
          </Text>
          <Text
            as="p"
            variant="caption"
            color={theme.colors.colorTextSecondary}
          >
            {t('Before you proceed, please note:')}
          </Text>
        </div>
        <ul style={styles.bulletList}>
          <li style={styles.bulletItem}>
            <Text as="span" variant="caption">
              {t(
                'Items already on the device: anything it synced before now stays there. Revoking cannot delete it. Change passwords the device could see, especially if it was lost or stolen.'
              )}
            </Text>
          </li>
          <li style={styles.bulletItem}>
            <Text as="span" variant="caption">
              {t(
                'Older versions: devices still on an older Lockwright version must update before they can read new items.'
              )}
            </Text>
          </li>
        </ul>
      </div>
    </Dialog>
  )
}
