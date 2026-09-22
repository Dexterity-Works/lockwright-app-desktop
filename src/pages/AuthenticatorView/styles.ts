import type { ThemeColors } from 'lockwright-lib-ui-react-native-components'
import { rawTokens } from 'lockwright-lib-ui-react-native-components'

import { HEADER_MIN_HEIGHT } from '../../constants/layout'

export const createStyles = (colors: ThemeColors) => ({
  wrapper: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    height: '100%',
    width: '100%',
    backgroundColor: colors.colorSurfacePrimary,
    overflow: 'hidden' as const
  },

  headerContainer: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    height: `${HEADER_MIN_HEIGHT}px`,
    paddingInline: `${rawTokens.spacing12}px`,
    borderBottom: `1px solid ${colors.colorBorderPrimary}`,
    backgroundColor: colors.colorSurfacePrimary,
    boxSizing: 'border-box' as const,
    flexShrink: 0
  },

  breadcrumbWrapper: {
    flex: 1,
    minWidth: 0,
    display: 'flex' as const,
    alignItems: 'center' as const
  },

  headerActions: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: `${rawTokens.spacing4}px`
  }
})
