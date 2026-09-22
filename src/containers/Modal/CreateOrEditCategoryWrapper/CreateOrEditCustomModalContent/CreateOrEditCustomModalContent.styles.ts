import { rawTokens } from 'lockwright-lib-ui-react-native-components'

export const createStyles = () => ({
  form: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: `${rawTokens.spacing8}px`,
    width: '100%'
  },
  sectionLabel: {
    marginTop: `${rawTokens.spacing8}px`
  }
})
