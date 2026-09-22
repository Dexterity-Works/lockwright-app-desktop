import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { AccessRemovedModalContent } from './AccessRemovedModalContent'
import { useModal } from '../../../context/ModalContext'
import { useTranslation } from '../../../hooks/useTranslation'

jest.mock('../../../context/ModalContext', () => ({
  useModal: jest.fn()
}))

jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: jest.fn()
}))

jest.mock('lockwright-lib-ui-react-native-components', () => {
  const liftTestID = ({ testID, ...rest }: any) =>
    testID ? { ...rest, 'data-testid': testID } : rest
  return {
    rawTokens: new Proxy({}, { get: () => 0 }),
    Button: ({ children, onClick, ...rest }: any) => (
      <button type="button" onClick={onClick} {...liftTestID(rest)}>
        {children}
      </button>
    ),
    Dialog: ({ children, footer, ...rest }: any) => {
      const lifted = liftTestID(rest)
      return (
        <div {...lifted}>
          {children}
          {footer}
        </div>
      )
    },
    Text: ({ children, ...rest }: any) => <p {...liftTestID(rest)}>{children}</p>
  }
})

const mockedUseModal = jest.mocked(useModal)
const mockedUseTranslation = jest.mocked(useTranslation)

describe('AccessRemovedModalContent', () => {
  const closeModal = jest.fn()
  const t = jest.fn(
    (
      template: string,
      vars?: Record<string, string>
    ) =>
      vars
        ? template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '')
        : template
  )

  beforeEach(() => {
    jest.clearAllMocks()
    mockedUseModal.mockReturnValue({ closeModal } as unknown as ReturnType<
      typeof useModal
    >)
    mockedUseTranslation.mockReturnValue({ t } as unknown as ReturnType<
      typeof useTranslation
    >)
  })

  it('renders a vaultName-only lead when no deviceName is provided', () => {
    render(<AccessRemovedModalContent vaultName="V1" />)
    const lead = screen.getByTestId('access-removed-lead')
    expect(lead.textContent ?? '').toContain('V1')
    expect(lead.textContent ?? '').not.toContain(' by ')
  })

  it('includes deviceName in the lead when provided', () => {
    render(<AccessRemovedModalContent vaultName="V1" deviceName="mac arm64" />)
    const lead = screen.getByTestId('access-removed-lead')
    expect(lead.textContent).toContain('V1')
    expect(lead.textContent).toContain('mac arm64')
  })

  it('calls closeModal on Understood when no onClose override is provided', () => {
    render(<AccessRemovedModalContent vaultName="V1" />)
    fireEvent.click(screen.getByTestId('access-removed-understood'))
    expect(closeModal).toHaveBeenCalledTimes(1)
  })

  it('prefers the onClose prop over closeModal', () => {
    const onClose = jest.fn()
    render(<AccessRemovedModalContent vaultName="V1" onClose={onClose} />)
    fireEvent.click(screen.getByTestId('access-removed-understood'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(closeModal).not.toHaveBeenCalled()
  })
})
