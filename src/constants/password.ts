import { PasswordIndicatorVariant } from 'lockwright-lib-ui-react-native-components'

const STRENGTH_MAP: Record<string, PasswordIndicatorVariant> = {
  error: 'vulnerable',
  warning: 'decent',
  success: 'strong'
}

export { STRENGTH_MAP }
