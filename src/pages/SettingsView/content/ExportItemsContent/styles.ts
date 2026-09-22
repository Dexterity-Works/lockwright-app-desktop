import type { ThemeColors } from 'lockwright-lib-ui-react-native-components'
import { rawTokens } from 'lockwright-lib-ui-react-native-components'

export const createStyles = (colors: ThemeColors) => ({
  container: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: `${rawTokens.spacing24}px`
  },

  toggleCard: {
    border: `1px solid ${colors.colorBorderPrimary}`,
    borderRadius: `${rawTokens.radius8}px`,
    overflow: 'hidden' as const,
    padding: `${rawTokens.spacing12}px`,
    display: 'flex' as const,
    flexDirection: 'column' as const
  },

  passwordFieldsWrapper: {
    overflow: 'hidden' as const,
    transition: 'max-height 0.3s ease-in-out, opacity 0.3s ease-in-out'
  },

  passwordFields: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: `${rawTokens.spacing12}px`,
    paddingTop: `${rawTokens.spacing12}px`
  },

  actionsRow: {
    display: 'flex' as const,
    justifyContent: 'flex-end' as const
  }
})
