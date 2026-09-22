import React from 'react'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

const mockMarkHistoryUsed = jest.fn()
const mockCopyToClipboard = jest.fn()
const mockCloseModal = jest.fn()
const mockOnPasswordInsert = jest.fn()

jest.mock('../../../utils/passwordGeneratorHistory', () => ({
  markHistoryUsed: (value: string, context?: unknown) =>
    mockMarkHistoryUsed(value, context)
}))

jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (s: string) => s })
}))

jest.mock('../../../hooks/useCopyToClipboard.electron', () => ({
  useCopyToClipboard: () => ({ copyToClipboard: mockCopyToClipboard })
}))

jest.mock('../../../context/ModalContext', () => ({
  useModal: () => ({ closeModal: mockCloseModal })
}))

jest.mock('../../../context/ToastContext', () => ({
  useToast: () => ({ setToast: jest.fn() })
}))

jest.mock('../../PasswordGenerator/PasswordGenerator', () => {
  const React = require('react')
  const { PassType } = require('../../../shared/types')
  return {
    PasswordGenerator: ({
      onGeneratedChange
    }: {
      onGeneratedChange?: (value: string, type: string) => void
    }) => {
      React.useEffect(() => {
        onGeneratedChange?.('secret-pw', PassType.Password)
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
    Button: ({
      children,
      onClick,
      'data-testid': dataTestId,
      'aria-label': ariaLabel
    }: {
      children?: React.ReactNode
      onClick?: () => void
      'data-testid'?: string
      'aria-label'?: string
      [key: string]: unknown
    }) =>
      React.createElement(
        'button',
        {
          type: 'button',
          onClick,
          'data-testid': dataTestId,
          'aria-label': ariaLabel
        },
        children
      ),
    Dialog: ({
      children,
      footer,
      title
    }: {
      children?: React.ReactNode
      footer?: React.ReactNode
      title?: React.ReactNode
    }) =>
      React.createElement(
        'div',
        { 'data-testid': 'generatepassword-dialog' },
        React.createElement('h1', null, title),
        children,
        footer
      )
  }
})

jest.mock('lockwright-lib-ui-react-native-components/icons', () => ({
  ContentCopy: () => null
}))

import { GeneratePasswordModalContent } from './GeneratePasswordModalContent'

describe('GeneratePasswordModalContent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('stamps history on Use with the entry title, then inserts', () => {
    render(
      <GeneratePasswordModalContent
        onPasswordInsert={mockOnPasswordInsert}
        contextLabel="My Login"
      />
    )

    fireEvent.click(screen.getByTestId('generatepassword-button-primary'))

    expect(mockMarkHistoryUsed).toHaveBeenCalledWith('secret-pw', {
      contextLabel: 'My Login',
      contextKind: 'entry'
    })
    expect(mockOnPasswordInsert).toHaveBeenCalledWith('secret-pw', 'password')
    expect(mockCopyToClipboard).not.toHaveBeenCalled()
    expect(mockCloseModal).toHaveBeenCalled()
  })

  it('stamps history with site hostname when contextKind is site', () => {
    render(
      <GeneratePasswordModalContent
        onPasswordInsert={mockOnPasswordInsert}
        contextLabel="example.com"
        contextKind="site"
      />
    )

    fireEvent.click(screen.getByTestId('generatepassword-button-primary'))

    expect(mockMarkHistoryUsed).toHaveBeenCalledWith('secret-pw', {
      contextLabel: 'example.com',
      contextKind: 'site'
    })
  })

  it('does not stamp history on bare Copy', () => {
    render(<GeneratePasswordModalContent />)

    fireEvent.click(screen.getByTestId('generatepassword-button-primary'))

    expect(mockMarkHistoryUsed).not.toHaveBeenCalled()
    expect(mockCopyToClipboard).toHaveBeenCalledWith('secret-pw')
    expect(mockOnPasswordInsert).not.toHaveBeenCalled()
  })

  it('does not stamp history when Use has no contextLabel', () => {
    render(
      <GeneratePasswordModalContent onPasswordInsert={mockOnPasswordInsert} />
    )

    fireEvent.click(screen.getByTestId('generatepassword-button-primary'))

    expect(mockMarkHistoryUsed).not.toHaveBeenCalled()
    expect(mockOnPasswordInsert).toHaveBeenCalledWith('secret-pw', 'password')
  })
})
