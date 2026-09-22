import { html } from 'htm/react'
import {
  Check,
  ErrorFilled,
  ReportProblem
} from 'lockwright-lib-ui-react-native-components/icons'

import { NoticeTextComponent, NoticeTextWrapper } from './styles'

/**
 * @param {{
 *  text: string
 *  type: 'success' | 'error' | 'warning'
 *  testId?: string
 * }} props
 */
export const NoticeText = ({ text, type = 'success', testId }) => {
  const getIconByType = () => {
    switch (type) {
      case 'success':
        return Check
      case 'error':
        return ErrorFilled
      case 'warning':
        return ReportProblem
      default:
        return null
    }
  }

  const Icon = getIconByType()

  return html`
    <${NoticeTextWrapper}>
      ${Icon && html`<${Icon} width="10" height="10" />`}
      <${NoticeTextComponent} data-testid=${testId} type=${type}> ${text} <//>
    <//>
  `
}
