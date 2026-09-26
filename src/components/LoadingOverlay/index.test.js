import React from 'react'

import { render } from '@testing-library/react'
import { ThemeProvider } from 'lockwright-lib-ui-react-native-components'

import { LoadingOverlay } from './index'
import '@testing-library/jest-dom'

describe('LoadingOverlay', () => {
  test('renders', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <LoadingOverlay data-testid="loading-overlay" />
      </ThemeProvider>
    )

    expect(getByTestId('loading-overlay')).toBeInTheDocument()
  })

  test('passes props correctly', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <LoadingOverlay
          data-testid="loading-overlay"
          id="test-id"
          className="test-class"
        />
      </ThemeProvider>
    )

    const overlay = getByTestId('loading-overlay')
    expect(overlay).toHaveAttribute('id', 'test-id')
    expect(overlay).toHaveClass('test-class')
  })
})
