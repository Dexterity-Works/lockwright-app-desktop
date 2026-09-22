import type { ThemeColors } from 'lockwright-lib-ui-react-native-components'
import { rawTokens } from 'lockwright-lib-ui-react-native-components'

export const createStyles = (colors: ThemeColors) => ({
  bodyColumn: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    width: '100%',
    alignItems: 'stretch' as const,
    flex: '1 1 auto' as const,
    minHeight: 0
  },
  vaultPanel: {
    borderWidth: 1,
    borderStyle: 'solid' as const,
    borderColor: colors.colorBorderPrimary,
    borderRadius: rawTokens.radius8,
    backgroundColor: colors.colorSurfacePrimary,
    overflow: 'hidden' as const,
    boxSizing: 'border-box' as const,
    marginTop: `${rawTokens.spacing12}px`,
  },
  lockBadge: {
    width: 32,
    height: 32,
    borderRadius: rawTokens.radius8,
    backgroundColor: colors.colorSurfaceHover,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0
  },
  recordsScroll: {
    maxHeight: 280,
    overflowY: 'auto' as const,
    boxSizing: 'border-box' as const
  },
  recordsListWrapper: {
    margin: rawTokens.spacing12,
    borderWidth: 1,
    borderStyle: 'solid' as const,
    borderColor: colors.colorBorderPrimary,
    borderRadius: rawTokens.radius8,
    boxSizing: 'border-box' as const
  },
  chevronWrap: {
    display: 'inline-flex' as const,
    transition: 'transform 0.15s ease'
  }
})
