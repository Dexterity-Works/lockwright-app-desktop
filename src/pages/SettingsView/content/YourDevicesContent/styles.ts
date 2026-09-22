import type { ThemeColors } from 'lockwright-lib-ui-react-native-components'
import { rawTokens } from 'lockwright-lib-ui-react-native-components'

export const createStyles = (colors: ThemeColors) => ({
  root: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: `${rawTokens.spacing8}px`,
    width: '100%'
  },

  sectionHeading: {
    marginTop: `${rawTokens.spacing16}px`,
    marginBottom: `${rawTokens.spacing4}px`
  },

  sectionCard: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    borderRadius: `${rawTokens.radius8}px`,
    borderWidth: 1,
    borderStyle: 'solid' as const,
    borderColor: colors.colorBorderPrimary,
    background: colors.colorSurfacePrimary,
    boxSizing: 'border-box' as const
  },

  sectionDescription: {
    marginBottom: `${rawTokens.spacing4}px`
  },

  list: {
    display: 'flex' as const,
    flexDirection: 'column' as const
  },

  footer: {
    display: 'flex' as const,
    justifyContent: 'flex-start' as const,
    padding: `${rawTokens.spacing4}px`,
    borderTop: `1px solid ${colors.colorBorderPrimary}`
  },

  listItemBorder: {
    borderBottom: `1px solid ${colors.colorBorderPrimary}`
  },

  iconWrap: {
    width: `${rawTokens.spacing32}px`,
    height: `${rawTokens.spacing32}px`,
    borderRadius: `${rawTokens.radius8}px`,
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    background: colors.colorSurfaceHover,
    flexShrink: 0
  },

  emptyBrowserStateWrap: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    alignItems: 'flex-start' as const
  },

  emptyStateCaptions: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: `${rawTokens.spacing6}px`,
    padding: `${rawTokens.spacing12}px`,
    paddingBottom: `${rawTokens.spacing4}px`
  },

  emptyStateFooter: {
    display: 'flex' as const,
    justifyContent: 'flex-start' as const,
    flexWrap: 'wrap' as const,
    gap: `${rawTokens.spacing4}px`,
    padding: `${rawTokens.spacing4}px`
  }
})
