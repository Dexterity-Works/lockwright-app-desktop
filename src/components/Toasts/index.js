import { html } from 'htm/react'
import { Snackbar } from 'lockwright-lib-ui-react-native-components'

import { ToastStack } from './styles'

/**
 * @param {{
 *  toasts: Array.<{
 *    message: string
 *    icon?: import('react').ElementType
 *  }>
 * }} props
 */
export const Toasts = ({ toasts }) => html`
  <${ToastStack}>
    ${toasts?.map((toast, index) => {
      const Icon = toast.icon
      return html`
        <${Snackbar}
          key=${index}
          text=${toast.message}
          icon=${Icon ? html`<${Icon} />` : undefined}
        />
      `
    })}
  <//>
`
