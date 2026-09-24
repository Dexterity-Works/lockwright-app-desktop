import type { ThemeColors } from 'lockwright-lib-ui-react-native-components'
import { rawTokens } from 'lockwright-lib-ui-react-native-components'

export const createStyles = (colors: ThemeColors) => ({
  body: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: `${rawTokens.spacing16}px`,
    width: '100%'
  },
  section: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: `${rawTokens.spacing12}px`
  },
  groupedCard: {
    border: `1px solid ${colors.colorBorderPrimary}`,
    borderRadius: `${rawTokens.radius8}px`,
    overflow: 'hidden' as const,
    backgroundColor: colors.colorSurfacePrimary
  },
  generatedPasswordBlock: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: `${rawTokens.spacing16}px`,
    padding: `${rawTokens.spacing24}px ${rawTokens.spacing16}px`,
    borderBottom: `1px solid ${colors.colorBorderPrimary}`,
    textAlign: 'center' as const,
    wordBreak: 'break-word' as const
  },
  optionRow: {
    padding: `${rawTokens.spacing12}px`,
    cursor: 'pointer' as const
  },
  optionRowDivider: {
    borderBottom: `1px solid ${colors.colorBorderPrimary}`
  },
  singleRowCard: {
    border: `1px solid ${colors.colorBorderPrimary}`,
    borderRadius: `${rawTokens.radius8}px`,
    backgroundColor: colors.colorSurfacePrimary,
    padding: `${rawTokens.spacing8}px ${rawTokens.spacing12}px`,
    minHeight: 41,
    display: 'flex' as const,
    alignItems: 'center' as const,
    boxSizing: 'border-box' as const
  },
  sliderRow: {
    display: 'flex' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: `${rawTokens.spacing12}px`,
    width: '100%'
  },
  sliderLabel: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: `${rawTokens.spacing8}px`,
    flexShrink: 0
  },
  lengthInput: {
    width: 72,
    flexShrink: 0
  },
  slider: {
    flex: 1,
    minWidth: 0
  },
  settingRow: {
    display: 'flex' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: `${rawTokens.spacing12}px`,
    padding: `${rawTokens.spacing12}px ${rawTokens.spacing16}px`
  },
  sectionHeader: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: `${rawTokens.spacing8}px`
  },
  historyList: {
    border: `1px solid ${colors.colorBorderPrimary}`,
    borderRadius: `${rawTokens.radius8}px`,
    overflowY: 'auto' as const,
    maxHeight: 220,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    backgroundColor: colors.colorSurfacePrimary
  },
  historyRow: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: `${rawTokens.spacing8}px`,
    padding: `${rawTokens.spacing8}px ${rawTokens.spacing12}px`
  },
  historyRowDivider: {
    borderBottom: `1px solid ${colors.colorBorderPrimary}`
  },
  historyMeta: {
    minWidth: 0,
    flex: 1,
    display: 'flex' as const,
    flexDirection: 'column' as const
  },
  historyValue: {
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const
  },
  historyContext: {
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const
  }
})
