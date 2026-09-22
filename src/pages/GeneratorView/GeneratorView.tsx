import React, { useCallback, useState } from 'react'

import { Button, PageHeader, useTheme } from 'lockwright-lib-ui-react-native-components'
import { ContentCopy } from 'lockwright-lib-ui-react-native-components/icons'

import { createStyles } from './GeneratorView.styles'
import { PasswordGenerator } from '../../containers/PasswordGenerator/PasswordGenerator'
import { useToast } from '../../context/ToastContext'
import { useTranslation } from '../../hooks/useTranslation'
// @ts-ignore - JS module without type declarations
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard.electron'

export const GeneratorView = () => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const styles = createStyles(theme.colors)
  const { setToast } = useToast()
  const [generated, setGenerated] = useState('')

  const { copyToClipboard } = useCopyToClipboard({
    onCopy: () => setToast({ message: t('Copied to clipboard') })
  })

  const handleGeneratedChange = useCallback((value: string) => {
    setGenerated(value)
  }, [])

  return (
    <div style={styles.wrapper} data-testid="generator-page">
      <PageHeader as="h1" title={t('Generator')} />

      <PasswordGenerator onGeneratedChange={handleGeneratedChange} />

      <div style={styles.actions}>
        <Button
          variant="primary"
          size="small"
          type="button"
          disabled={!generated}
          iconBefore={<ContentCopy width={16} height={16} />}
          onClick={() => copyToClipboard(generated)}
          data-testid="generator-copy-password"
        >
          {t('Copy Password')}
        </Button>
      </div>
    </div>
  )
}
