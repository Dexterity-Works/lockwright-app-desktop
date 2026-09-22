import React, { FormEvent, useRef, useState } from 'react'

import {
  Button,
  Form,
  PasswordField,
  Text,
  Title,
  useTheme
} from 'lockwright-lib-ui-react-native-components'
import { KeyboardArrowRightFilled } from 'lockwright-lib-ui-react-native-components/icons'
import {
  useCreateVault,
  useUserData,
  useVault,
  useVaults
} from 'lockwright-lib-vault'
import {
  clearBuffer,
  stringToBuffer
} from 'lockwright-lib-vault/src/utils/buffer'

import { VaultUnlockAnimation } from '../../Intro/VaultUnlockAnimation'
import { createStyles } from './styles'
import { NAVIGATION_ROUTES } from '../../../constants/navigation'
import { useGlobalLoading } from '../../../context/LoadingContext'
import { useRouter } from '../../../context/RouterContext'
import { useTranslation } from '../../../hooks/useTranslation'
import { logger } from '../../../utils/logger'
import { sortByName } from '../../../utils/sortByName'

export const CardUnlockPearPass = (): React.ReactElement => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const styles = createStyles(theme.colors)
  const { currentPage, navigate } = useRouter()
  const { initVaults, refetch: refetchVaults } = useVaults()
  const { isVaultProtected, addDevice, refetch: refetchVault } = useVault()
  const { createVault } = useCreateVault()
  const { logIn, refreshMasterPasswordStatus } = useUserData()

  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  // Sync guard — React state alone cannot prevent double submit from
  // form onSubmit + button click racing in the same tick.
  const submitInFlightRef = useRef(false)

  useGlobalLoading({ isLoading })

  const handlePasswordChange = (value: string) => {
    setPassword(value)

    if (error) {
      setError('')
    }
  }

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()

    if (submitInFlightRef.current || isLoading) {
      return
    }

    if (!password) {
      setError(t('Password is required'))
      return
    }

    const passwordBuffer = stringToBuffer(password)
    submitInFlightRef.current = true

    try {
      setIsLoading(true)
      setError('')

      await logIn({ password: passwordBuffer })
      await initVaults({ password: passwordBuffer })

      const vaults = await refetchVaults()
      const firstVault = sortByName(vaults)[0]

      if (firstVault) {
        const isProtected = await isVaultProtected(firstVault.id)

        if (isProtected) {
          navigate(currentPage, {
            state: 'vaultPassword',
            vaultId: firstVault.id
          })
        } else {
          await refetchVault(firstVault.id)
          navigate('vault', { recordType: 'all' })
        }
      } else {
        await createVault({ name: t('Personal') })
        await addDevice()
        navigate('vault', { recordType: 'all' })
      }
    } catch (submitError) {
      const status = await refreshMasterPasswordStatus()

      if (status?.isLocked) {
        navigate('welcome', { state: NAVIGATION_ROUTES.SCREEN_LOCKED })
        return
      }

      const attemptsLeft =
        typeof status?.remainingAttempts === 'number'
          ? status.remainingAttempts
          : null
      const rawMessage =
        submitError instanceof Error
          ? submitError.message
          : typeof submitError === 'string'
            ? submitError
            : ''

      // Only show the attempts copy for real credential failures; surface
      // other unlock errors so packaging/storage bugs are not mislabeled.
      const isCredentialFailure =
        /incorrect|invalid password|decrypting vault key|do not match|credentials/i.test(
          rawMessage
        )

      setError(
        isCredentialFailure && attemptsLeft !== null
          ? t(
              `Incorrect password. You have ${attemptsLeft} ${attemptsLeft === 1 ? 'attempt' : 'attempts'} before the app will be temporarily locked`
            )
          : rawMessage || t('Invalid password')
      )

      logger.error(
        'CardUnlockPearPass',
        'Error unlocking with master password:',
        submitError
      )
    } finally {
      clearBuffer(passwordBuffer)
      submitInFlightRef.current = false
      setIsLoading(false)
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.art}>
        <VaultUnlockAnimation />
      </div>
      {/* @ts-ignore - plain CSS objects passed to react-strict-dom components */}
      <Form onSubmit={handleSubmit} style={styles.container}>
        <div style={styles.header}>
          <Title as="h2">{t('Enter Your Master Password')}</Title>
          <Text as="p" variant="label" color={theme.colors.colorTextSecondary}>
            {t('Please enter your master password to continue')}
          </Text>
        </div>

        <div style={styles.fieldsWrapper}>
          <PasswordField
            label={t('Password')}
            value={password}
            placeholderText={t('Enter Master Password')}
            onChangeText={handlePasswordChange}
            error={error || undefined}
            testID="login-password-input"
          />
        </div>

        <div style={styles.footerRow}>
          <Button
            type="submit"
            variant="primary"
            size="small"
            isLoading={isLoading}
            disabled={isLoading}
            data-testid="login-continue-button"
            iconAfter={<KeyboardArrowRightFilled width={16} height={16} />}
          >
            {t('Continue')}
          </Button>
        </div>
      </Form>
    </div>
  )
}
