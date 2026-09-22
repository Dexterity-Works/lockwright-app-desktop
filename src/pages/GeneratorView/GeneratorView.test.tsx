import React from 'react'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

const mockCopyToClipboard = jest.fn()
const mockMarkHistoryUsed = jest.fn()

jest.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (s: string) => s })
}))

jest.mock('../../hooks/useCopyToClipboard.electron', () => ({
  useCopyToClipboard: () => ({ copyToClipboard: mockCopyToClipboard })
}))

jest.mock('../../context/ToastContext', () => ({
  useToast: () => ({ setToast: jest.fn() })
}))

jest.mock('../../utils/passwordGeneratorHistory', () => ({
  markHistoryUsed: (value: string, context?: unknown) =>
    mockMarkHistoryUsed(value, context)
}))

jest.mock('../../containers/PasswordGenerator/PasswordGenerator', () => {
  const React = require('react')
  return {
    PasswordGenerator: ({
      onGeneratedChange
    }: {
      onGeneratedChange?: (value: string) => void
    }) => {
      React.useEffect(() => {
        onGeneratedChange?.('page-pw')
      }, [])
      return React.createElement('div', {
        'data-testid': 'password-generator-body'
      })
    }
  }
})

jest.mock('lockwright-lib-ui-react-native-components', () => {
  const React = require('react')
  return {
    useTheme: () => ({ theme: { colors: {} } }),
    rawTokens: new Proxy({}, { get: () => 0 }),
    PageHeader: ({ title }: { title?: React.ReactNode }) =>
      React.createElement('h1', null, title),
    Button: ({
      children,
      onClick,
      'data-testid': dataTestId
    }: {
      children?: React.ReactNode
      onClick?: () => void
      'data-testid'?: string
      [key: string]: unknown
    }) =>
      React.createElement(
        'button',
        { type: 'button', onClick, 'data-testid': dataTestId },
        children
      )
  }
})

jest.mock('lockwright-lib-ui-react-native-components/icons', () => ({
  ContentCopy: () => null
}))

import { GeneratorView } from './GeneratorView'

describe('GeneratorView', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the generator page and copies without stamping history', () => {
    render(<GeneratorView />)

    expect(screen.getByTestId('generator-page')).toBeInTheDocument()
    expect(screen.getByText('Generator')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('generator-copy-password'))

    expect(mockCopyToClipboard).toHaveBeenCalledWith('page-pw')
    expect(mockMarkHistoryUsed).not.toHaveBeenCalled()
  })
})
