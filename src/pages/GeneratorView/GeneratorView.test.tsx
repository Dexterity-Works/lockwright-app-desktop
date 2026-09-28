import React from 'react'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (s: string) => s })
}))

jest.mock('../../containers/PasswordGenerator/PasswordGenerator', () => {
  const React = require('react')
  return {
    PasswordGenerator: () =>
      React.createElement('div', {
        'data-testid': 'password-generator-body'
      })
  }
})

jest.mock('lockwright-lib-ui-react-native-components', () => {
  const React = require('react')
  return {
    useTheme: () => ({ theme: { colors: {} } }),
    rawTokens: new Proxy({}, { get: () => 0 }),
    PageHeader: ({ title }: { title?: React.ReactNode }) =>
      React.createElement('h1', null, title)
  }
})

import { GeneratorView } from './GeneratorView'

describe('GeneratorView', () => {
  it('renders the page header above the generator body', () => {
    render(<GeneratorView />)

    expect(screen.getByTestId('generator-page')).toBeInTheDocument()
    expect(screen.getByText('Generator')).toBeInTheDocument()
    expect(screen.getByTestId('password-generator-body')).toBeInTheDocument()
  })
})
