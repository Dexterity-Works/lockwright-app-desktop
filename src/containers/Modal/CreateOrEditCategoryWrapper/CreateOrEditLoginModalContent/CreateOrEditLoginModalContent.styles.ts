import { rawTokens } from 'lockwright-lib-ui-react-native-components'

export const createStyles = () => ({
  form: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: `${rawTokens.spacing8}px`,
    width: '100%'
  },
  sectionLabel: {
    marginTop: `${rawTokens.spacing8}px`
  },
  websiteFieldWrap: {
    position: 'relative' as const,
    width: '100%'
  },
  websiteMatchAccessory: {
    position: 'absolute' as const,
    top: rawTokens.spacing12,
    zIndex: 1,
    display: 'flex' as const,
    alignItems: 'center' as const,
    pointerEvents: 'auto' as const
  }
})
