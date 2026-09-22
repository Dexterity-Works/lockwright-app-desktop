import { rawTokens } from 'lockwright-lib-ui-react-native-components'

export const createStyles = () => ({
  container: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: `${rawTokens.spacing8}px`,
    width: '100%'
  }
})
