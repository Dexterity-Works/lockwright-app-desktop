import React from 'react'

import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'

let mockAuthenticatorEnabled = false

jest.mock('lockwright-lib-constants', () => ({
  get AUTHENTICATOR_ENABLED() {
    return mockAuthenticatorEnabled
  }
}))

const mockNavigate = jest.fn()
const mockSetModal = jest.fn()

jest.mock('../../context/RouterContext', () => ({
  useRouter: jest.fn()
}))

jest.mock('../../context/ModalContext', () => ({
  useModal: () => ({
    setModal: mockSetModal
  })
}))

jest.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

jest.mock('../../hooks/useRecordMenuItems', () => ({
  useRecordMenuItems: jest.fn()
}))

jest.mock('../../hooks/useCreateOrEditRecord', () => ({
  useCreateOrEditRecord: jest.fn()
}))

jest.mock('../../components/AppHeader', () => {
  const React = require('react')
  return {
    AppHeader: jest.fn((props) =>
      React.createElement(
        'div',
        { 'data-testid': 'app-header-mock' },
        React.createElement('input', {
          'data-testid': 'mock-search',
          value: props.searchValue,
          onChange: (e) => props.onSearchChange(e.target.value)
        }),
        React.createElement(
          'button',
          {
            type: 'button',
            'data-testid': 'mock-import',
            onClick: props.onImportClick
          },
          'Import'
        ),
        props.addItemControl
      )
    ),
    AppHeaderAddItemTrigger: () =>
      React.createElement(
        'button',
        { type: 'button', 'data-testid': 'add-item-trigger' },
        'Add'
      )
  }
})

jest.mock('../Modal/ImportItemOrVaultModalContent', () => ({
  ImportItemOrVaultModalContent: () => null
}))

import { AppHeaderContainer } from './AppHeaderContainer'
import { AppHeader } from '../../components/AppHeader'
import { AppHeaderContextProvider } from '../../context/AppHeaderContext'
import { useRouter } from '../../context/RouterContext'
import { useCreateOrEditRecord } from '../../hooks/useCreateOrEditRecord'
import { useRecordMenuItems } from '../../hooks/useRecordMenuItems'

const renderWithHeaderContext = (ui) =>
  render(<AppHeaderContextProvider>{ui}</AppHeaderContextProvider>)

describe('AppHeaderContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuthenticatorEnabled = false
    mockNavigate.mockReset()
    mockSetModal.mockReset()
    useRouter.mockReturnValue({
      currentPage: 'vault',
      data: { folder: 'folder-1', recordType: 'login' },
      navigate: mockNavigate
    })
    useRecordMenuItems.mockReturnValue({
      categoriesItems: [],
      defaultItems: [],
      popupItems: []
    })
    useCreateOrEditRecord.mockReturnValue({
      handleCreateOrEditRecord: jest.fn()
    })
  })

  it('returns null when current page is not vault', () => {
    useRouter.mockReturnValue({
      currentPage: 'settings',
      data: {},
      navigate: mockNavigate
    })

    const { container } = renderWithHeaderContext(<AppHeaderContainer />)

    expect(container.firstChild).toBeNull()
    expect(AppHeader).not.toHaveBeenCalled()
  })

  it('renders AppHeader on authenticator vault when AUTHENTICATOR_ENABLED', () => {
    mockAuthenticatorEnabled = true
    useRouter.mockReturnValue({
      currentPage: 'vault',
      data: { recordType: 'otp' },
      navigate: mockNavigate
    })

    renderWithHeaderContext(<AppHeaderContainer />)

    expect(screen.getByTestId('app-header-mock')).toBeInTheDocument()
    expect(AppHeader).toHaveBeenCalled()
  })

  it('renders AppHeader on vault when not blocked', () => {
    renderWithHeaderContext(<AppHeaderContainer />)

    expect(screen.getByTestId('app-header-mock')).toBeInTheDocument()
    expect(AppHeader).toHaveBeenCalled()
  })

  it('opens import modal on import', () => {
    renderWithHeaderContext(<AppHeaderContainer />)

    fireEvent.click(screen.getByTestId('mock-import'))

    expect(mockSetModal).toHaveBeenCalledTimes(1)
  })

  it('opens the create modal for the selected type instead of the menu', () => {
    const handleCreateOrEditRecord = jest.fn()
    useCreateOrEditRecord.mockReturnValue({ handleCreateOrEditRecord })

    renderWithHeaderContext(<AppHeaderContainer />)
    fireEvent.click(screen.getByTestId('add-item-trigger'))

    expect(handleCreateOrEditRecord).toHaveBeenCalledWith({
      recordType: 'login',
      selectedFolder: 'folder-1',
      isFavorite: undefined
    })
  })

  it('opens the type menu when All Items is selected', async () => {
    const handleCreateOrEditRecord = jest.fn()
    useCreateOrEditRecord.mockReturnValue({ handleCreateOrEditRecord })
    useRouter.mockReturnValue({
      currentPage: 'vault',
      data: { recordType: 'all' },
      navigate: mockNavigate
    })

    renderWithHeaderContext(<AppHeaderContainer />)
    fireEvent.click(screen.getByTestId('add-item-trigger'))

    expect(await screen.findByRole('menu')).toBeInTheDocument()
    expect(handleCreateOrEditRecord).not.toHaveBeenCalled()
  })

  it('wires search to header context state', () => {
    renderWithHeaderContext(<AppHeaderContainer />)

    fireEvent.change(screen.getByTestId('mock-search'), {
      target: { value: 'find-me' }
    })

    expect(screen.getByTestId('mock-search')).toHaveValue('find-me')
  })
})
