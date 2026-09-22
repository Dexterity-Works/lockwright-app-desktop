import { rawTokens } from 'lockwright-lib-ui-react-native-components'

export const createStyles = () => ({
  body: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: `${rawTokens.spacing4}px`,
    width: '100%'
  }
})
