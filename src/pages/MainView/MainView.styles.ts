import type { ThemeColors } from 'lockwright-lib-ui-react-native-components'

export const createStyles = (colors: ThemeColors) => ({
  wrapper: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    height: '100%',
    width: '100%',
    backgroundColor: colors.colorSurfacePrimary,
    overflow: 'hidden' as const
  }
})
