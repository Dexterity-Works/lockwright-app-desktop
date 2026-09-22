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

  passwordWrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    width: '100%',
    isolation: 'isolate' as const
  },

  checklist: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: `${rawTokens.spacing6}px`,
    width: '100%'
  },
  checklistRow: {
    display: 'flex',
    alignItems: 'center' as const
  },
  ruleMet: {
    color: colors.colorTextPrimary
  },
  ruleUnmet: {
    color: colors.colorTextTertiary
  },
  footerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%'
  },
  touContainer: {
    padding: '5px 0',
    maxWidth: '302px',
  },
  touText: {
    color: colors.colorTextSecondary
  },
  touLink: {
    fontFamily: "'Inter', sans-serif",
    fontSize: `${rawTokens.fontSize12}px`,
    fontWeight: 400,
    color: colors.colorLinkText,
    textDecoration: 'underline',
    textDecorationStyle: 'solid' as const
  }
})
