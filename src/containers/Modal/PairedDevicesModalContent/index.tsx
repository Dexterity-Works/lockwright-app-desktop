import React, { useEffect, useMemo, useRef, useState } from 'react'

import { formatDate, formatDateTime } from '../../../utils/date'
import {
  Button,
  ContextMenu,
  Dialog,
  ListItem,
  NavbarListItem,
  Text,
  useTheme
} from 'lockwright-lib-ui-react-native-components'
import {
  Devices,
  DoNotDisturb,
  LaptopMac,
  LaptopWindows,
  MoreVert,
  PhoneIphone,
  Tablet
} from 'lockwright-lib-ui-react-native-components/icons'
import {
  getMyDeviceId,
  getVaultKeyState,
  useVault,
  type VaultKeyState
} from 'lockwright-lib-vault'
import { pearpassVaultClient } from 'lockwright-lib-vault/src/instances'

import { createStyles, DEVICE_ACTIONS_MENU_WIDTH } from './styles'
import { useModal } from '../../../context/ModalContext'
import { useTranslation } from '../../../hooks/useTranslation'
import { getDeviceDisplayName } from '../../../utils/getDeviceDisplayName'
import { logger } from '../../../utils/logger'
import { RevokeAccessModalContentV2 } from '../RevokeAccessModalContentV2'

const getDeviceIcon = (deviceName?: string) => {
  if (!deviceName) return Devices

  const lowerName = deviceName.toLowerCase()

  if (lowerName.startsWith('ios') || lowerName.includes('iphone'))
    return PhoneIphone
  if (lowerName.startsWith('android')) return PhoneIphone
  if (lowerName.includes('ipad') || lowerName.includes('tablet')) return Tablet
  if (
    lowerName.includes('mac') ||
    lowerName.includes('imac') ||
    lowerName.includes('darwin') ||
    lowerName.includes('macbook')
  )
    return LaptopMac
  if (lowerName.includes('windows')) return LaptopWindows

  return Devices
}

type Device = {
  id?: string
  name?: string
  createdAt?: string | number | Date
}

export const PairedDevicesModalContent = () => {
  const { t } = useTranslation()
  const { closeModal, setModal } = useModal()
  const { theme } = useTheme()
  const styles = createStyles(theme.colors)

  const { data: vaultData } = useVault()
  const vaultId = (vaultData as { id?: string } | undefined)?.id ?? ''

  const devices = useMemo<Device[]>(
    () =>
      Array.isArray(vaultData?.devices) ? (vaultData.devices as Device[]) : [],
    [vaultData]
  )

  const [myDeviceId, setMyDeviceId] = useState<string | null>(null)
  // Removed devices stay listed until the vault key rotates past them.
  const [readState, setKeyState] = useState<VaultKeyState | null>(null)
  // Only the latest read counts, and only for the vault on screen: an
  // older read can resolve last, and a switch can leave the old state.
  const readSeq = useRef(0)
  const keyState = readState?.vaultId === vaultId ? readState : null
  const readKeyState = () => {
    const seq = ++readSeq.current
    return getVaultKeyState()
      .then((state) => {
        if (seq === readSeq.current) setKeyState(state)
      })
      .catch((error: unknown) => {
        logger.error('PairedDevicesModalContent', 'key state failed:', error)
      })
  }

  useEffect(() => {
    if (vaultId) void readKeyState()
  }, [vaultId, devices])

  const rotateNow = async () => {
    try {
      await pearpassVaultClient.activeVaultEnsureEpoch({ start: true })
    } catch (error) {
      logger.error('PairedDevicesModalContent', 'rotation failed:', error)
    }
    await readKeyState()
  }

  useEffect(() => {
    let cancelled = false
    getMyDeviceId()
      .then((id: string | null) => {
        if (!cancelled) setMyDeviceId(id ?? null)
      })
      .catch((error: unknown) => {
        logger.error('PairedDevicesModalContent', 'getMyDeviceId failed:', error)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const openRevokeModal = (device: Device, displayName: string) => {
    if (!device.id || !vaultId) return
    setModal(
      <RevokeAccessModalContentV2
        vaultId={vaultId}
        targetDeviceId={device.id}
        deviceName={displayName}
      />
    )
  }

  return (
    <Dialog
      title={t('Paired Devices')}
      onClose={closeModal}
      testID="see-devices-dialog"
      closeButtonTestID="see-devices-close"
      footer={
        <Button
          size="small"
          type="button"
          onClick={closeModal}
          data-testid="see-devices-close-button"
        >
          {t('Understood')}
        </Button>
      }
    >
      {devices.length === 0 && !keyState?.removed.length ? (
        <div style={styles.emptyState}>
          <Text as="p" variant="body" color={theme.colors.colorTextSecondary}>
            {t('No devices synced yet')}
          </Text>
        </div>
      ) : (
        <div style={styles.list}>
          {devices.map((device, index) => {
            const deviceName = getDeviceDisplayName(device.name, t)
            const DeviceIcon = getDeviceIcon(device.name)
            const createdAt = device.createdAt
              ? formatDate(new Date(device.createdAt), 'dd-mmm-yyyy', ' ')
              : null
            const isCurrentDevice = !!myDeviceId && device.id === myDeviceId

            return (
              <ListItem
                key={device.id ?? `${deviceName}-${index}`}
                icon={
                  <div style={styles.iconWrap}>
                    <DeviceIcon
                      width={16}
                      height={16}
                      color={theme.colors.colorAccentActive}
                    />
                  </div>
                }
                title={deviceName}
                subtitle={
                  createdAt ? `${t('Paired on')} ${createdAt}` : undefined
                }
                testID={`see-devices-item-${device.id ?? index}`}
                rightElement={
                  isCurrentDevice || !device.id ? undefined : (
                    <ContextMenu
                      menuWidth={DEVICE_ACTIONS_MENU_WIDTH}
                      testID={`see-devices-row-menu-${device.id}`}
                      trigger={
                        <Button
                          variant="tertiary"
                          size="small"
                          aria-label={t('Device actions')}
                          iconBefore={
                            <MoreVert
                              width={16}
                              height={16}
                              color={theme.colors.colorTextPrimary}
                            />
                          }
                        />
                      }
                    >
                      <NavbarListItem
                        size="small"
                        variant="destructive"
                        icon={
                          <DoNotDisturb
                            color={theme.colors.colorSurfaceDestructiveElevated}
                          />
                        }
                        label={t('Revoke Access')}
                        testID={`see-devices-row-revoke-${device.id}`}
                        onClick={() => openRevokeModal(device, deviceName)}
                      />
                    </ContextMenu>
                  )
                }
              />
            )
          })}
          {keyState?.removed.map((device) => (
            <ListItem
              key={device.id}
              icon={
                <div style={styles.iconWrap}>
                  <DoNotDisturb width={16} height={16} />
                </div>
              }
              title={getDeviceDisplayName(device.name ?? undefined, t)}
              subtitle={
                // A device that cannot open the latest key leaves the
                // rotation to a member that can, on its next sync.
                keyState.canRead
                  ? t('Removed · key not rotated')
                  : t('Removed · key rotating')
              }
              testID={`see-devices-removed-${device.id}`}
              rightElement={
                keyState.canRead ? (
                  <Button
                    variant="secondary"
                    size="small"
                    type="button"
                    onClick={rotateNow}
                    data-testid={`see-devices-rotate-${device.id}`}
                  >
                    {t('Rotate key now')}
                  </Button>
                ) : undefined
              }
            />
          ))}
        </div>
      )}
      {keyState?.rotatedAt ? (
        <Text
          as="p"
          variant="caption"
          color={theme.colors.colorTextSecondary}
          data-testid="see-devices-key-rotated"
        >
          {t('Vault key last rotated {dateTime}', {
            dateTime: formatDateTime(keyState.rotatedAt)
          })}
        </Text>
      ) : null}
    </Dialog>
  )
}
