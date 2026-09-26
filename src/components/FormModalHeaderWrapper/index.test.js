import React from 'react'

import { render, screen } from '@testing-library/react'
import { ThemeProvider } from 'lockwright-lib-ui-react-native-components'

import { FormModalHeaderWrapper } from './index'
import '@testing-library/jest-dom'

describe('FormModalHeaderWrapper', () => {
  const mockChildren = <div data-testid="test-children">Test Children</div>
  const mockButtons = <div data-testid="test-buttons">Test Buttons</div>

  test('renders children and buttons correctly', () => {
    render(
      <ThemeProvider>
        <FormModalHeaderWrapper children={mockChildren} buttons={mockButtons} />
      </ThemeProvider>
    )

    expect(screen.getByTestId('test-children')).toBeInTheDocument()
    expect(screen.getByTestId('test-buttons')).toBeInTheDocument()
  })

  test('renders without children', () => {
    render(
      <ThemeProvider>
        <FormModalHeaderWrapper buttons={mockButtons} />
      </ThemeProvider>
    )

    expect(screen.queryByTestId('test-children')).not.toBeInTheDocument()
    expect(screen.getByTestId('test-buttons')).toBeInTheDocument()
  })

  test('renders without buttons', () => {
    render(
      <ThemeProvider>
        <FormModalHeaderWrapper children={mockChildren} />
      </ThemeProvider>
    )

    expect(screen.getByTestId('test-children')).toBeInTheDocument()
    expect(screen.queryByTestId('test-buttons')).not.toBeInTheDocument()
  })

  test('renders with empty content', () => {
    const { container } = render(
      <ThemeProvider>
        <FormModalHeaderWrapper />
      </ThemeProvider>
    )

    expect(container).toHaveTextContent('')
    expect(screen.queryByTestId('test-children')).not.toBeInTheDocument()
    expect(screen.queryByTestId('test-buttons')).not.toBeInTheDocument()
  })
})
