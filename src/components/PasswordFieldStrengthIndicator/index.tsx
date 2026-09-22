import React, { useMemo } from 'react'
import {
  PasswordField,
  PasswordIndicatorVariant
} from 'lockwright-lib-ui-react-native-components'
import { PassType } from '../../shared/types'
import { getPasswordStrength } from '../../utils/getPasswordStrengthInfo'
import { STRENGTH_MAP } from '../../constants/password'
import { useTranslation } from '../../hooks/useTranslation'

interface IPasswordField {
  onChange: (value: string) => void
  onBlur: (event: React.FocusEvent<HTMLInputElement>) => void
  name: string
  value: string
  error: string
}

interface IPasswordFieldStrengthIndicatorProps {
  label?: string
  placeholder?: string
  passwordField: IPasswordField
  testID: string
  passwordType: PassType
  setPasswordType: React.Dispatch<React.SetStateAction<PassType>>
  isGrouped?: boolean
}

export const PasswordFieldStrengthIndicator = ({
  label = 'Password',
  placeholder = 'Enter Password',
  passwordType,
  setPasswordType,
  passwordField,
  testID,
  isGrouped
}: IPasswordFieldStrengthIndicatorProps) => {
  const { t } = useTranslation()
  const passwordStrength = useMemo(() => {
    return getPasswordStrength(passwordField.value, passwordType)
  }, [passwordField.value, passwordType])

  const passwordIndicator: PasswordIndicatorVariant | undefined =
    passwordStrength ? STRENGTH_MAP[passwordStrength.strengthType] : undefined

  return (
    <PasswordField
      label={t(label)}
      placeholder={t(placeholder)}
      value={passwordField.value}
      onChange={(e) => {
        passwordField.onChange(e.target.value)
        if (passwordType !== PassType.Password) {
          setPasswordType(PassType.Password)
        }
      }}
      error={passwordField.error || undefined}
      testID={testID}
      passwordIndicator={passwordIndicator}
      isGrouped={isGrouped}
    />
  )
}
