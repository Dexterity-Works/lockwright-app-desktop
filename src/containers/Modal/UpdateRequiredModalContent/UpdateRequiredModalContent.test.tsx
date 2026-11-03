import React from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { UpdateRequiredModalContent } from './UpdateRequiredModalContent'
import { BASE_TRANSITION_DURATION } from '../../../constants/transitions'
import {
  ModalProvider,
  STACK_CLEANUP_BUFFER,
  useModal
} from '../../../context/ModalContext'

jest.mock('lockwright-lib-utils/generate-unique-id', () => {
  let n = 0
  return { generateUniqueId: jest.fn(() => `id-${n++}`) }
})

jest.mock('lockwright-lib-ui-react-hooks', () => ({
  useCountDown: () => '02:00'
}))

jest.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (s: string) => s })
}))

jest.mock('../../../components/Overlay', () => ({
  Overlay: () => null
}))

jest.mock('../../../containers/Modal', () => ({
  ModalWrapper: ({ children }: any) => <div>{children}</div>
}))

jest.mock('../../../containers/Modal/SideDrawer', () => ({
  SideDrawer: ({ children }: any) => <div>{children}</div>
}))

jest.mock('lockwright-lib-ui-react-native-components', () => ({
  rawTokens: new Proxy({}, { get: () => 0 }),
  useTheme: () => ({ theme: { colors: {} } }),
  Button: ({ children, onClick, ...rest }: any) => (
    <button type="button" onClick={onClick} {...rest}>
      {children}
    </button>
  ),
  Dialog: ({ children, footer, testID }: any) => (
    <div data-testid={testID}>
      {children}
      {footer}
    </div>
  ),
  Text: ({ children }: any) => <span>{children}</span>
}))

describe('UpdateRequiredModalContent', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('closes its own not-closable modal when Update is clicked', () => {
    const onUpdate = jest.fn()
    const Opener = () => {
      const { setModal } = useModal()
      return (
        <button
          onClick={() =>
            setModal(<UpdateRequiredModalContent onUpdate={onUpdate} />, {
              closable: false
            })
          }
        >
          Open
        </button>
      )
    }
    render(
      <ModalProvider>
        <Opener />
      </ModalProvider>
    )

    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByTestId('updaterequired-dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('updaterequired-update'))
    act(() => {
      jest.advanceTimersByTime(BASE_TRANSITION_DURATION + STACK_CLEANUP_BUFFER)
    })

    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('updaterequired-dialog')).toBeNull()
  })
})
