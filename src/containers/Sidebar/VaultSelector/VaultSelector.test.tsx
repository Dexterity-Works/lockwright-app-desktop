import React, { isValidElement } from 'react'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

import { VaultSelector } from './VaultSelector'
import { DeleteVaultModalContent } from '../../Modal/DeleteVaultModalContent'

const mockSetModal = jest.fn()
const mockSwitchVault =
  jest.fn<(vault: unknown, onSuccess: () => void) => void>()

jest.mock('lockwright-lib-constants', () => ({ UNSUPPORTED: false }))

jest.mock('lockwright-lib-vault', () => ({
  useVaults: () => ({
    data: [
      { id: 'x', name: 'X' },
      { id: 'y', name: 'Y' }
    ]
  }),
  useVault: () => ({ data: { id: 'x', name: 'X' } }),
  useInvite: () => ({ data: null, createInvite: jest.fn() })
}))

jest.mock('lockwright-lib-ui-react-native-components', () => {
  const R = require('react')
  return {
    useTheme: () => ({ theme: { colors: {} } }),
    Button: ({ onClick, 'data-testid': testId }: Record<string, never>) =>
      R.createElement('button', { type: 'button', 'data-testid': testId, onClick }),
    ContextMenu: ({ children }: { children: React.ReactNode }) =>
      R.createElement('div', null, children),
    ListItem: ({ rightElement }: { rightElement?: React.ReactNode }) =>
      R.createElement('div', null, rightElement),
    NavbarListItem: ({ onClick, testID }: Record<string, never>) =>
      R.createElement('button', { type: 'button', 'data-testid': testID, onClick }),
    Text: ({ children }: { children: React.ReactNode }) =>
      R.createElement('span', null, children)
  }
})

jest.mock('lockwright-lib-ui-react-native-components/icons', () =>
  new Proxy({}, { get: () => () => null })
)

jest.mock('./VaultSelector.styles', () => ({
  VAULT_ACTIONS_MENU_WIDTH: 180,
  createStyles: () => ({})
}))

jest.mock('../../../context/LoadingContext', () => ({
  useLoadingContext: () => ({ setIsLoading: jest.fn() })
}))

jest.mock('../../../context/ModalContext', () => ({
  useModal: () => ({ setModal: mockSetModal, closeModal: jest.fn() })
}))

jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (s: string) => s })
}))

jest.mock('../../../hooks/useVaultSwitch', () => ({
  useVaultSwitch: () => ({ switchVault: mockSwitchVault })
}))

jest.mock('../../Modal/DeleteVaultModalContent', () => ({
  DeleteVaultModalContent: () => null
}))

describe('VaultSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // The delete dialog reads the device count and sends the erase through the
  // active vault, so that vault has to be the one being deleted.
  it('switches to the vault before it opens the delete dialog', () => {
    render(<VaultSelector />)

    fireEvent.click(screen.getByTestId('vault-row-delete-x'))

    expect(mockSwitchVault).toHaveBeenCalledWith(
      { id: 'x', name: 'X' },
      expect.any(Function)
    )
    expect(mockSetModal).not.toHaveBeenCalled()

    mockSwitchVault.mock.calls[0][1]()

    const modal = mockSetModal.mock.calls[0][0] as React.ReactElement
    expect(isValidElement(modal) && modal.type).toBe(DeleteVaultModalContent)
    expect(modal.props).toEqual({ vaultId: 'x', vaultName: 'X' })
  })
})
