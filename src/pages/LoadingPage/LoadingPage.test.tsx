import React from 'react'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('lockwright-lib-ui-react-native-components', () => {
  const actual = jest.requireActual<
    typeof import('lockwright-lib-ui-react-native-components')
  >('lockwright-lib-ui-react-native-components')
  return {
    ...actual,
    useTheme: () => ({
      theme: { colors: { colorSurfaceHover: '#222', colorPrimary: '#B0D944' } }
    })
  }
})

jest.mock('../../components/OnboardingShell', () => ({
  OnboardingShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )
}))

jest.mock('../Intro/VaultUnlockAnimation', () => ({
  VaultUnlockAnimation: () => null
}))

import { LoadingPage } from './LoadingPage'

describe('LoadingPage', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows real migration progress when there is some', () => {
    render(<LoadingPage migrationProgress={{ done: 2, total: 5 }} />)
    expect(screen.getByText('2 / 5')).toBeInTheDocument()
  })

  it('schedules no timers and shows no fake progress otherwise', () => {
    jest.useFakeTimers()
    render(<LoadingPage />)
    jest.advanceTimersByTime(5000)
    expect(jest.getTimerCount()).toBe(0)
    expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument()
  })
})
