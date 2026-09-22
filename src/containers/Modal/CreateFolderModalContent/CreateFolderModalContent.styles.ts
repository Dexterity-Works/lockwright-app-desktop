import { rawTokens } from 'lockwright-lib-ui-react-native-components'

export const createStyles = () => ({
  form: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: `${rawTokens.spacing16}px`,
    width: '100%'
  }
})
