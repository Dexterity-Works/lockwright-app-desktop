/// <reference types="@testing-library/jest-dom" />

import React from 'react'

import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'

import { ReportAProblemContent } from './index'

const mockOpenExternal = jest.fn()

jest.mock('../../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (str: string) => str
  })
}))

jest.mock('lockwright-lib-constants', () => ({
  PEARPASS_WEBSITE: 'https://lockwright.dexterity.works'
}))

jest.mock('./styles', () => ({
  createStyles: () => ({
    root: {},
    actions: {}
  })
}))

jest.mock('lockwright-lib-ui-react-native-components/icons', () => ({
  Send: () => null
}))

jest.mock('lockwright-lib-ui-react-native-components', () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div data-testid="settings-report-page-header">
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  ),
  Button: ({
    children,
    onClick,
    'data-testid': dataTestid
  }: {
    children: React.ReactNode
    onClick?: () => void
    'data-testid'?: string
  }) => (
    <button type="button" data-testid={dataTestid} onClick={onClick}>
      {children}
    </button>
  )
}))

const TEST_IDS = {
  root: 'settings-card-report',
  open: 'settings-report-open-button'
} as const

describe('ReportAProblemContent', () => {
  const originalElectronAPI = window.electronAPI

  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: { openExternal: mockOpenExternal }
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: originalElectronAPI
    })
  })

  it('renders header and an enabled open-form button', () => {
    render(<ReportAProblemContent />)

    expect(screen.getByTestId(TEST_IDS.root)).toBeInTheDocument()
    expect(
      screen.getByTestId('settings-report-page-header').textContent
    ).toContain('Report a problem')
    expect(screen.getByTestId(TEST_IDS.open)).not.toHaveAttribute('disabled')
    expect(screen.queryByTestId('settings-report-textarea')).not.toBeInTheDocument()
  })

  it('opens the Lockwright contact form', () => {
    render(<ReportAProblemContent />)

    fireEvent.click(screen.getByTestId(TEST_IDS.open))

    expect(mockOpenExternal).toHaveBeenCalledTimes(1)
    expect(mockOpenExternal).toHaveBeenCalledWith(
      'https://lockwright.dexterity.works/contact/'
    )
  })
})
