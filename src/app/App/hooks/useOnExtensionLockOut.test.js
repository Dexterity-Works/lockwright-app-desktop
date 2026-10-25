import React from 'react'

import { render } from '@testing-library/react'

import { useOnExtensionLockOut } from './useOnExtensionLockOut'
import { NAVIGATION_ROUTES } from '../../../constants/navigation'
import { HANDLER_EVENTS } from '../../../constants/services'

const mockNavigate = jest.fn()
const mockCloseModal = jest.fn()

jest.mock('../../../context/RouterContext', () => ({
  useRouter: () => ({
    navigate: mockNavigate
  })
}))

jest.mock('../../../context/ModalContext', () => ({
  useModal: () => ({
    closeModal: mockCloseModal
  })
}))

describe('useOnExtensionLockOut', () => {
  let addEventListenerSpy
  let removeEventListenerSpy

  beforeEach(() => {
    addEventListenerSpy = jest.spyOn(window, 'addEventListener')
    removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should add and remove extension-lock listener on mount/unmount', () => {
    function TestComponent() {
      useOnExtensionLockOut()
      return null
    }

    const { unmount } = render(<TestComponent />)

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      HANDLER_EVENTS.extensionLock,
      expect.any(Function)
    )

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      HANDLER_EVENTS.extensionLock,
      expect.any(Function)
    )
  })

  it('should close modals and navigate on extension-lock event', () => {
    let handler
    addEventListenerSpy.mockImplementation((event, cb) => {
      if (event === HANDLER_EVENTS.extensionLock) {
        handler = cb
      }
    })

    function TestComponent() {
      useOnExtensionLockOut()
      return null
    }

    render(<TestComponent />)

    handler()

    expect(mockNavigate).toHaveBeenCalledWith('welcome', {
      state: NAVIGATION_ROUTES.SCREEN_LOCKED
    })
    expect(mockCloseModal).toHaveBeenCalledWith({ force: true })
  })
})
