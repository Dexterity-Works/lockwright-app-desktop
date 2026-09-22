import React, { useRef, useState } from 'react'

import { useForm } from 'lockwright-lib-ui-react-hooks'
import { Validator } from 'lockwright-utils-validator'
import { PRIVACY_POLICY } from 'lockwright-lib-constants'
import {
  useCreateVault,
  useUserData,
  useVault,
  useVaults
} from 'lockwright-lib-vault'
import {
  stringToBuffer,
  clearBuffer
} from 'lockwright-lib-vault/src/utils/buffer'
import { checkPasswordStrength } from 'lockwright-utils-password-check'
import {
  AlertMessage,
  Button,
  Dialog,
  Form,
  Link,
  PasswordField,
  Text,
  Title
} from 'lockwright-lib-ui-react-native-components'
import type { PasswordIndicatorVariant } from 'lockwright-lib-ui-react-native-components'
import { KeyboardArrowRightFilled } from 'lockwright-lib-ui-react-native-components/icons'
import { useTheme } from 'lockwright-lib-ui-react-native-components'

import { createStyles } from './styles'
import { LOCAL_STORAGE_KEYS } from '../../../constants/localStorage'
import { NAVIGATION_ROUTES } from '../../../constants/navigation'
import { useGlobalLoading } from '../../../context/LoadingContext'
import { useRouter } from '../../../context/RouterContext'
import { clearStaleVaultsDir } from '../../../electron'
import { useTranslation } from '../../../hooks/useTranslation'
import { logger } from '../../../utils/logger'
import { STRENGTH_MAP } from '../../../constants/password'

const ACCEPT_RULES = [
  { key: 'minLength', label: 'At least 8 characters' },
  { key: 'hasLowerCase', label: 'One lowercase letter' },
  { key: 'hasUpperCase', label: 'One uppercase letter' },
  { key: 'hasNumbers', label: 'One number' },
  { key: 'hasSymbols', label: 'One special character' }
] as const

export const CardCreateMasterPassword = () => {
  const { t } = useTranslation()
  const { navigate } = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [warningOpen, setWarningOpen] = useState(false)
  const warningConfirmedRef = useRef(false)
  const submitInFlightRef = useRef(false)
  const { theme } = useTheme()
  const styles = createStyles(theme.colors)

  useGlobalLoading({ isLoading })

  const { createMasterPassword, logIn } = useUserData()
  const { initVaults } = useVaults()
  const { addDevice } = useVault()
  const { createVault } = useCreateVault()

  const schema = Validator.object({
    password: Validator.string().required(t('Password is required')),
    passwordConfirm: Validator.string().required(t('Password is required'))
  })

  const { register, handleSubmit, setErrors, setValue, values, errors } =
    useForm({
      initialValues: {
        password: '',
        passwordConfirm: ''
      },
      validate: (formValues: { password: string; passwordConfirm: string }) =>
        schema.validate(formValues)
    })

  const passwordStrength = values.password
    ? checkPasswordStrength(values.password)
    : null

  const isPasswordStrong = passwordStrength?.strengthType === 'success'
  const passwordsMatch =
    isPasswordStrong &&
    values.password.length > 0 &&
    values.password === values.passwordConfirm
  const isFormValid = isPasswordStrong && passwordsMatch

  const passwordIndicator: PasswordIndicatorVariant | undefined =
    passwordStrength ? STRENGTH_MAP[passwordStrength.strengthType] : undefined

  const handlePasswordChange = (val: string) => {
    register('password').onChange(val)
    if (!val) {
      setErrors({})
    }
  }

  const handleConfirmChange = (val: string) => {
    register('passwordConfirm').onChange(val)
  }

  const onSubmit = async (formValues: {
    password: string
    passwordConfirm: string
  }) => {
    if (!warningConfirmedRef.current) {
      setWarningOpen(true)
      return
    }

    if (submitInFlightRef.current || isLoading) return

    const strength = checkPasswordStrength(formValues.password)
    if (strength.strengthType !== 'success') {
      setErrors({
        password: strength.errors?.[0] || t('Password is not strong enough')
      })
      setValue('passwordConfirm', '')
      return
    }

    if (formValues.password !== formValues.passwordConfirm) {
      setErrors({ passwordConfirm: t('Passwords do not match') })
      return
    }

    const createBuffer = stringToBuffer(formValues.password)
    const loginBuffer = stringToBuffer(formValues.password)
    const CREATE_TIMEOUT_MS = 12_000
    const withTimeout = <T,>(promise: Promise<T>, label: string) =>
      new Promise<T>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`${label} timed out`)),
          CREATE_TIMEOUT_MS
        )
        promise.then(
          (value) => {
            clearTimeout(timer)
            resolve(value)
          },
          (err) => {
            clearTimeout(timer)
            reject(err)
          }
        )
      })

    const runStep = async <T,>(label: string, fn: () => Promise<T>) => {
      logger.log('CardCreateMasterPassword', `start ${label}`)
      try {
        const result = await withTimeout(fn(), label)
        logger.log('CardCreateMasterPassword', `ok ${label}`)
        return result
      } catch (err) {
        logger.error('CardCreateMasterPassword', `fail ${label}`, err)
        throw err
      }
    }

    submitInFlightRef.current = true
    try {
      setIsLoading(true)
      localStorage.setItem(LOCAL_STORAGE_KEYS.TOU_ACCEPTED, 'true')
      await runStep('clearStaleVaultsDir', () => clearStaleVaultsDir())
      await runStep('createMasterPassword', () =>
        createMasterPassword(createBuffer)
      )
      await runStep('logIn', () => logIn({ password: loginBuffer }))
      await runStep('initVaults', () => initVaults({ password: loginBuffer }))
      await runStep('createVault', () => createVault({ name: t('Personal') }))
      await runStep('addDevice', () => addDevice())
      navigate('vault', { recordType: 'all' })
      setIsLoading(false)
    } catch (error) {
      setIsLoading(false)
      const message = error instanceof Error ? error.message : String(error)
      if (/already exists/i.test(message)) {
        // Existing encryption store — send user to unlock instead of spinning.
        navigate('welcome', { state: NAVIGATION_ROUTES.MASTER_PASSWORD })
        return
      }
      // Surface the real failure so local packaging issues are diagnosable.
      setErrors({
        password: /timed out/i.test(message)
          ? t('Creating your vault timed out. Please try again.') + ` (${message})`
          : `${t('Error creating master password')}: ${message}`
      })
      logger.error(
        'CardCreateMasterPassword',
        'Error creating master password:',
        error
      )
    } finally {
      clearBuffer(loginBuffer)
      submitInFlightRef.current = false
    }
  }

  const ruleTicks = (
    checkPasswordStrength(values.password || '') as unknown as {
      rules: Record<(typeof ACCEPT_RULES)[number]['key'], boolean>
    }
  ).rules

  const handleConfirmWarning = () => {
    warningConfirmedRef.current = true
    setWarningOpen(false)
    void handleSubmit(onSubmit)()
  }

  return (
    <div style={styles.card}>
      {/* @ts-ignore - plain CSS objects passed to react-strict-dom components */}
      <Form onSubmit={handleSubmit(onSubmit)} style={styles.container}>
        <div style={styles.header}>
          <Title as="h2">{t('Create Master Password')}</Title>
        </div>

        <div style={styles.fieldsWrapper}>
          <div style={styles.passwordWrapper}>
            <PasswordField
              label={t('Password')}
              placeholderText={t('Enter Master Password')}
              value={values.password}
              onChangeText={handlePasswordChange}
              passwordIndicator={passwordIndicator}
              error={errors.password || undefined}
              testID="master-password-field"
            />
          </div>
          <div
            data-testid="password-accept-checklist"
            style={styles.checklist}
          >
            {ACCEPT_RULES.map((rule) => {
              const met = Boolean(ruleTicks[rule.key])
              return (
                <div
                  key={rule.key}
                  data-testid={`password-accept-rule-${rule.key}`}
                  aria-checked={met}
                  role="checkbox"
                  style={{
                    ...styles.checklistRow,
                    ...(met ? styles.ruleMet : styles.ruleUnmet)
                  }}
                >
                  <Text as="span" variant="caption">
                    {`${met ? '\u2713' : '\u25CB'} ${t(rule.label)}`}
                  </Text>
                </div>
              )
            })}
          </div>

          <PasswordField
            label={t('Repeat Password')}
            placeholderText={t('Repeat Master Password')}
            value={values.passwordConfirm}
            onChangeText={handleConfirmChange}
            passwordIndicator={passwordsMatch ? 'match' : undefined}
            error={errors.passwordConfirm || undefined}
            testID="confirm-password-field"
          />

          {errors.password && /Error creating|timed out/i.test(errors.password) && (
            <AlertMessage
              variant="error"
              size="small"
              title={t('Could not create vault')}
              description={errors.password}
              testID="create-master-password-error"
            />
          )}

          {isFormValid && !errors.password && (
            <AlertMessage
              variant="warning"
              size="small"
              title=""
              description={t(
                "Don't forget your Master password. It's the only way to access your vault. We can't help recover it. Back it up securely."
              )}
            />
          )}
        </div>

        <div style={styles.footerRow}>
          <div style={styles.touContainer}>
            {/* @ts-ignore */}
            <Text as="span" variant="caption" style={styles.touText}>
              {t(
                'By clicking Continue, you confirm that you have read and agree to the '
              )}
            </Text>{' '}
            <Link
              // @ts-ignore - plain CSS object
              style={styles.touLink}
              href={PRIVACY_POLICY}
              isExternal
            >
              {t('Lockwright Privacy Policy')}
            </Link>
            <Text as="span">.</Text>
          </div>
          <Button
            type="submit"
            variant="primary"
            size="small"
            disabled={!isFormValid || isLoading}
            isLoading={isLoading}
            iconAfter={<KeyboardArrowRightFilled width={16} height={16} />}
            data-testid="create-master-password-continue"
          >
            {t('Continue')}
          </Button>
        </div>
      </Form>
      <Dialog
        open={warningOpen}
        title={t('We cannot reset this password')}
        hideCloseButton
        closeOnOutsideClick
        onClose={() => setWarningOpen(false)}
        testID="lost-password-dialog"
        footer={
          <>
            <Button
              variant="tertiary"
              onClick={() => setWarningOpen(false)}
              data-testid="lost-password-cancel"
            >
              {t('Go back')}
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmWarning}
              data-testid="lost-password-confirm"
            >
              {t('I understand — create vault')}
            </Button>
          </>
        }
      >
        <Text as="p">
          {t(
            'Other apps can email you a new password. Lockwright cannot. If you lose this Master password, the vault is gone. There is no recovery.'
          )}
        </Text>
      </Dialog>
    </div>
  )
}
