import type { ThemeColors } from 'lockwright-lib-ui-react-native-components'
import { rawTokens } from 'lockwright-lib-ui-react-native-components'

export const RECORD_ROW_CONTEXT_MENU_WIDTH = 240

export const createStyles = (colors: ThemeColors) => ({
  menuDivider: {
    width: '100%',
    height: 1,
    border: 'none',
    margin: 0,
    marginBlock: rawTokens.spacing4,
    backgroundColor: colors.colorBorderPrimary,
    flexShrink: 0
  }
})
