import type { ThemeColors } from 'lockwright-lib-ui-react-native-components'
import { rawTokens } from 'lockwright-lib-ui-react-native-components'

export const createStyles = (colors: ThemeColors) => ({
  card: {
    background: colors.colorSurfacePrimary,
    paddingTop: '55px',
    paddingBottom: '55px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '35px',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    boxSizing: 'border-box' as const
  },

  art: {
    width: '220px',
    height: '220px',
    flex: '0 0 auto'
  },

  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: `${rawTokens.spacing24}px`,
    alignItems: 'stretch',
    justifyContent: 'center',
    width: '100%',
    maxWidth: '500px'
  },

  header: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: `${rawTokens.spacing6}px`,
    width: '100%'
  },

  fieldsWrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: `${rawTokens.spacing12}px`,
    width: '100%'
  },

  footerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%'
  }
})
