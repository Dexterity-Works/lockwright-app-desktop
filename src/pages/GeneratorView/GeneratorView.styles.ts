import type { ThemeColors } from 'lockwright-lib-ui-react-native-components'
import { rawTokens } from 'lockwright-lib-ui-react-native-components'

export const createStyles = (colors: ThemeColors) => ({
  wrapper: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    height: '100%',
    width: '100%',
    minHeight: 0,
    overflowY: 'auto' as const,
    padding: `${rawTokens.spacing24}px`,
    gap: `${rawTokens.spacing24}px`,
    boxSizing: 'border-box' as const,
    backgroundColor: colors.colorSurfacePrimary
  },
  actions: {
    display: 'flex' as const,
    justifyContent: 'flex-end' as const
  }
})
