import React from 'react'

import { Button, Dialog, Text } from 'lockwright-lib-ui-react-native-components'

import { createStyles } from './AccessRemovedModalContent.styles'
import { useModal } from '../../../context/ModalContext'
import { useTranslation } from '../../../hooks/useTranslation'

export type AccessRemovedModalContentProps = {
  vaultName: string
  deviceName?: string
  onClose?: () => void
}

export const AccessRemovedModalContent = ({
  vaultName,
  deviceName,
  onClose
}: AccessRemovedModalContentProps) => {
  const { t } = useTranslation()
  const styles = createStyles()
  const { closeModal } = useModal()

  const handleClose = onClose ?? closeModal

  const lead = deviceName
    ? t('Your access to {vaultName} has been removed by {deviceName}.', {
        vaultName,
        deviceName
      })
    : t('Your access to {vaultName} has been removed.', { vaultName })

  return (
    <Dialog
      title={t('Access Removed')}
      onClose={handleClose}
      testID="access-removed-dialog"
      closeButtonTestID="access-removed-close"
      footer={
        <Button
          variant="primary"
          size="small"
          type="button"
          onClick={handleClose}
          data-testid="access-removed-understood"
        >
          {t('Understood')}
        </Button>
      }
    >
      <div style={styles.body}>
        <Text as="p" variant="label" data-testid="access-removed-lead">
          {lead}
        </Text>
        <Text as="p" variant="label">
          {t('This vault will no longer be available on this device.')}
        </Text>
      </div>
    </Dialog>
  )
}
