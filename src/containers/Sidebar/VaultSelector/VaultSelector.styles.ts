import type { ThemeColors } from 'lockwright-lib-ui-react-native-components'
import { rawTokens } from 'lockwright-lib-ui-react-native-components'

export const VAULT_ACTIONS_MENU_WIDTH = 215

export const createStyles = (colors: ThemeColors) => ({
  wrapper: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: rawTokens.spacing4,
    width: '100%'
  },

  titleRow: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: rawTokens.spacing4,
    padding: `${rawTokens.spacing8}px ${rawTokens.spacing4}px`,
    borderRadius: rawTokens.radius8,
    width: '100%',
    boxSizing: 'border-box' as const
  },

  titleLabel: {
    flex: 1,
    minWidth: 0
  },

  list: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 1,
    width: '100%',
    cursor: 'pointer' as const
  },

  vaultRow: {
    minHeight: '58px',
    gap: `${rawTokens.spacing8}px`,
    paddingInline: `${rawTokens.spacing8}px`
  },

  rowActions: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: `${rawTokens.spacing8}px`
  },

  iconActionButton: {
    paddingInline: '0',
    paddingBlock: '0',
    borderWidth: '0'
  },

  menuGroup: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    width: '100%'
  },

  menuDivider: {
    width: '100%',
    height: 1,
    backgroundColor: colors.colorBorderPrimary,
    border: 'none',
    margin: 0,
    flexShrink: 0
  }
})
