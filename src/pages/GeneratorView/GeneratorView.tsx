import React from 'react'

import { PageHeader, useTheme } from 'lockwright-lib-ui-react-native-components'

import { createStyles } from './GeneratorView.styles'
import { PasswordGenerator } from '../../containers/PasswordGenerator/PasswordGenerator'
import { useTranslation } from '../../hooks/useTranslation'

export const GeneratorView = () => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const styles = createStyles(theme.colors)

  return (
    <div style={styles.wrapper} data-testid="generator-page">
      <PageHeader as="h1" title={t('Generator')} />

      <PasswordGenerator />
    </div>
  )
}
