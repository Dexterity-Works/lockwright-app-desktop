import React, { useCallback, useRef, useState } from 'react'

import { Button, Dialog } from 'lockwright-lib-ui-react-native-components'
import { ContentCopy } from 'lockwright-lib-ui-react-native-components/icons'

import { PasswordGenerator } from '../../PasswordGenerator/PasswordGenerator'
import { useModal } from '../../../context/ModalContext'
import { useToast } from '../../../context/ToastContext'
import { useTranslation } from '../../../hooks/useTranslation'
// @ts-ignore - JS module without type declarations
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard.electron'
import { PassType } from '../../../shared/types'
import { markHistoryUsed } from '../../../utils/passwordGeneratorHistory'

export type GeneratePasswordModalContentProps = {
  onPasswordInsert?: (pass: string, type: PassType) => void
  /** Non-empty label stamped on USE (entry title or site hostname). */
  contextLabel?: string
  contextKind?: 'site' | 'entry'
}

export const GeneratePasswordModalContent = ({
  onPasswordInsert,
  contextLabel,
  contextKind = 'entry'
}: GeneratePasswordModalContentProps) => {
  const { t } = useTranslation()
  const { closeModal } = useModal()
  const { setToast } = useToast()

  const { copyToClipboard } = useCopyToClipboard({
    onCopy: () => setToast({ message: t('Copied to clipboard') })
  })

  const [generated, setGenerated] = useState('')
  const passTypeRef = useRef<PassType>(PassType.Password)

  const handleGeneratedChange = useCallback((value: string, type: PassType) => {
    setGenerated(value)
    passTypeRef.current = type
  }, [])

  const handlePrimaryAction = () => {
    if (onPasswordInsert) {
      const label = contextLabel?.trim()
      if (label) {
        void markHistoryUsed(generated, {
          contextLabel: label,
          contextKind: contextKind === 'site' ? 'site' : 'entry'
        })
      }
      onPasswordInsert(generated, passTypeRef.current)
      closeModal()
      return
    }
    copyToClipboard(generated)
    closeModal()
  }

  const isCopyMode = !onPasswordInsert

  return (
    <Dialog
      title={t('New Password Item')}
      onClose={closeModal}
      testID="generatepassword-dialog"
      closeButtonTestID="generatepassword-close"
      footer={
        <>
          <Button
            variant="secondary"
            size="small"
            type="button"
            onClick={closeModal}
            data-testid="generatepassword-button-discard"
          >
            {t('Discard')}
          </Button>
          <Button
            variant="primary"
            size="small"
            type="button"
            disabled={!generated}
            iconBefore={
              isCopyMode ? <ContentCopy width={16} height={16} /> : undefined
            }
            onClick={handlePrimaryAction}
            data-testid="generatepassword-button-primary"
          >
            {isCopyMode ? t('Copy Password') : t('Use Password')}
          </Button>
        </>
      }
    >
      <PasswordGenerator onGeneratedChange={handleGeneratedChange} />
    </Dialog>
  )
}
