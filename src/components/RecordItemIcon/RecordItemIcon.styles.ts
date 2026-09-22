import type { ThemeColors } from 'lockwright-lib-ui-react-native-components'
import { rawTokens } from 'lockwright-lib-ui-react-native-components'

export const createStyles = (colors: ThemeColors, size: number) => ({
  wrapper: {
    width: size,
    height: size,
    borderRadius: `${rawTokens.radius8}px`,
    overflow: 'hidden' as const,
    backgroundColor: colors.colorSurfaceHover,
    display: 'flex' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    flexShrink: 0
  },

  image: {
    width: size,
    height: size,
    borderRadius: `${rawTokens.radius8}px`,
    objectFit: 'contain' as const
  }
})
