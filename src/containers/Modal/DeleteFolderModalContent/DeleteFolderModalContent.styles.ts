import { rawTokens } from 'lockwright-lib-ui-react-native-components'

export const createStyles = () => ({
  body: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: `${rawTokens.spacing16}px`,
    whiteSpace: 'pre-line' as const
  }
})
