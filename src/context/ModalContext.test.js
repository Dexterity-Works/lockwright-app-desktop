import React from 'react'

import { render, screen, fireEvent, act } from '@testing-library/react'

import {
  ModalProvider,
  STACK_CLEANUP_BUFFER,
  useModal,
  useModalEntryId
} from './ModalContext'
import { BASE_TRANSITION_DURATION } from '../constants/transitions'
import '@testing-library/jest-dom'

const CLOSE_DURATION = BASE_TRANSITION_DURATION + STACK_CLEANUP_BUFFER

jest.mock('lockwright-lib-utils/generate-unique-id', () => {
  let n = 0
  return { generateUniqueId: jest.fn(() => `id-${n++}`) }
})

jest.mock('../components/Overlay', () => ({
  Overlay: ({ onClick, type, isOpen }) => (
    <div data-testid="overlay" onClick={onClick}>
      Overlay: {type}, isOpen: {isOpen.toString()}
    </div>
  )
}))

jest.mock('../containers/Modal', () => ({
  ModalWrapper: ({ children }) => (
    <div data-testid="modal-wrapper">{children}</div>
  )
}))

jest.mock('../containers/Modal/SideDrawer', () => ({
  SideDrawer: ({ children, isOpen }) => (
    <div data-testid="side-drawer" data-open={isOpen.toString()}>
      {children}
    </div>
  )
}))

const TestComponent = () => {
  const { setModal, closeModal, isOpen } = useModal()

  return (
    <div>
      <button
        onClick={() =>
          setModal(<div data-testid="modal-content">Modal Content</div>)
        }
      >
        Open Modal
      </button>
      <button onClick={closeModal}>Close Modal</button>
      <div data-testid="is-open">{isOpen.toString()}</div>
    </div>
  )
}

const StackedModalsTestComponent = () => {
  const { setModal, closeModal } = useModal()
  return (
    <div>
      <button onClick={() => setModal(<div data-testid="modal-A">A</div>)}>
        open A
      </button>
      <button onClick={() => setModal(<div data-testid="modal-B">B</div>)}>
        open B
      </button>
      <button onClick={closeModal}>close</button>
    </div>
  )
}

const TestSideDrawerComponent = () => {
  const { setModal, isOpen } = useModal()

  return (
    <div>
      <button
        onClick={() =>
          setModal(
            <div data-testid="side-drawer-content">Side Drawer Content</div>,
            { modalType: 'sideDrawer' }
          )
        }
      >
        Open Side Drawer Modal
      </button>
      <div data-testid="is-open">{isOpen.toString()}</div>
    </div>
  )
}

describe('ModalProvider', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  test('renders children', () => {
    render(
      <ModalProvider>
        <div data-testid="child">Child Content</div>
      </ModalProvider>
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  test('opens and closes default modal using setModal and closeModal', () => {
    render(
      <ModalProvider>
        <TestComponent />
      </ModalProvider>
    )

    expect(screen.getByTestId('is-open').textContent).toBe('false')

    fireEvent.click(screen.getByText('Open Modal'))
    expect(screen.getByTestId('is-open').textContent).toBe('true')
    expect(screen.getByTestId('modal-content')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Close Modal'))

    act(() => {
      jest.advanceTimersByTime(CLOSE_DURATION)
    })

    expect(screen.queryByTestId('modal-content')).not.toBeInTheDocument()
  })

  test('closes modal on Escape key press', () => {
    render(
      <ModalProvider>
        <TestComponent />
      </ModalProvider>
    )

    fireEvent.click(screen.getByText('Open Modal'))
    expect(screen.getByTestId('modal-content')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })

    act(() => {
      jest.advanceTimersByTime(CLOSE_DURATION)
    })

    expect(screen.queryByTestId('modal-content')).not.toBeInTheDocument()
  })

  test('ignores Escape and overlay clicks while the open modal is busy', () => {
    const Busy = () => {
      const { setClosable } = useModal()
      const id = useModalEntryId()
      return (
        <div>
          <button onClick={() => setClosable(id, false)}>Start work</button>
          <button onClick={() => setClosable(id, true)}>Finish work</button>
        </div>
      )
    }
    const Opener = () => {
      const { setModal } = useModal()
      return <button onClick={() => setModal(<Busy />)}>Open Busy</button>
    }
    render(
      <ModalProvider>
        <Opener />
      </ModalProvider>
    )

    fireEvent.click(screen.getByText('Open Busy'))
    fireEvent.click(screen.getByText('Start work'))
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
    fireEvent.click(screen.getByTestId('overlay'))
    act(() => {
      jest.advanceTimersByTime(CLOSE_DURATION)
    })
    expect(screen.getByText('Start work')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Finish work'))
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
    act(() => {
      jest.advanceTimersByTime(CLOSE_DURATION)
    })
    expect(screen.queryByText('Start work')).not.toBeInTheDocument()
  })

  describe('when a modal opens on top of a busy one', () => {
    const Notice = () => <div>Access removed</div>
    const Busy = () => {
      const { setModal, closeModal, setClosable } = useModal()
      const id = useModalEntryId()
      return (
        <div>
          <button onClick={() => setClosable(id, false)}>Start work</button>
          <button onClick={() => setModal(<Notice />)}>Open notice</button>
          <button
            onClick={() => {
              setClosable(id, true)
              closeModal(id)
            }}
          >
            Finish work
          </button>
        </div>
      )
    }
    const Opener = () => {
      const { setModal } = useModal()
      return <button onClick={() => setModal(<Busy />)}>Open Busy</button>
    }
    const settle = () =>
      act(() => {
        jest.advanceTimersByTime(CLOSE_DURATION)
      })

    beforeEach(() => {
      render(
        <ModalProvider>
          <Opener />
        </ModalProvider>
      )
      fireEvent.click(screen.getByText('Open Busy'))
    })

    test('closing by id closes only the busy modal', () => {
      fireEvent.click(screen.getByText('Start work'))
      fireEvent.click(screen.getByText('Open notice'))

      fireEvent.click(screen.getByText('Finish work'))
      settle()

      expect(screen.queryByText('Start work')).not.toBeInTheDocument()
      expect(screen.getByText('Access removed')).toBeInTheDocument()
    })

    test('the closable flag lands on the busy modal, not the top one', () => {
      fireEvent.click(screen.getByText('Open notice'))
      fireEvent.click(screen.getByText('Start work'))

      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
      settle()
      expect(screen.queryByText('Access removed')).not.toBeInTheDocument()

      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
      settle()
      expect(screen.getByText('Start work')).toBeInTheDocument()
    })

    test('Escape twice within the fade leaves the busy modal open', () => {
      fireEvent.click(screen.getByText('Start work'))
      fireEvent.click(screen.getByText('Open notice'))

      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
      settle()

      expect(screen.queryByText('Access removed')).not.toBeInTheDocument()
      expect(screen.getByText('Start work')).toBeInTheDocument()
    })

    test('closing a modal that is already gone does nothing', () => {
      fireEvent.click(screen.getByText('Open notice'))
      const finish = screen.getByText('Finish work')
      fireEvent.click(finish)
      settle()
      fireEvent.click(finish)
      settle()

      expect(screen.getByText('Access removed')).toBeInTheDocument()
    })
  })

  test('closeModal() without an id leaves a busy modal open', () => {
    // Like a dialog underneath that wires its own Escape listener to
    // closeModal.
    const EscapeCloser = () => {
      const { closeModal } = useModal()
      React.useEffect(() => {
        const onKey = (event) => event.key === 'Escape' && closeModal()
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [closeModal])
      return null
    }
    const Busy = () => {
      const { setClosable } = useModal()
      const id = useModalEntryId()
      return (
        <div>
          <button onClick={() => setClosable(id, false)}>Start work</button>
          <button onClick={() => setClosable(id, true)}>Finish work</button>
        </div>
      )
    }
    const Opener = () => {
      const { setModal } = useModal()
      return <button onClick={() => setModal(<Busy />)}>Open Busy</button>
    }
    render(
      <ModalProvider>
        <EscapeCloser />
        <Opener />
      </ModalProvider>
    )

    fireEvent.click(screen.getByText('Open Busy'))
    fireEvent.click(screen.getByText('Start work'))
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    act(() => {
      jest.advanceTimersByTime(CLOSE_DURATION)
    })
    expect(screen.getByText('Start work')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Finish work'))
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    act(() => {
      jest.advanceTimersByTime(CLOSE_DURATION)
    })
    expect(screen.queryByText('Start work')).not.toBeInTheDocument()
  })

  test('a forced close shuts a busy modal', () => {
    const Busy = () => {
      const { setClosable } = useModal()
      const id = useModalEntryId()
      return <button onClick={() => setClosable(id, false)}>Start work</button>
    }
    const Locker = () => {
      const { setModal, closeModal } = useModal()
      return (
        <div>
          <button onClick={() => setModal(<Busy />)}>Open Busy</button>
          <button onClick={() => closeModal({ force: true })}>Lock</button>
        </div>
      )
    }
    render(
      <ModalProvider>
        <Locker />
      </ModalProvider>
    )

    fireEvent.click(screen.getByText('Open Busy'))
    fireEvent.click(screen.getByText('Start work'))
    fireEvent.click(screen.getByText('Lock'))
    act(() => {
      jest.advanceTimersByTime(CLOSE_DURATION)
    })

    expect(screen.queryByText('Start work')).not.toBeInTheDocument()
  })

  test('a modal opened as not closable can still close itself by id', () => {
    const Update = () => {
      const { closeModal } = useModal()
      const id = useModalEntryId()
      return (
        <div>
          <button onClick={() => closeModal()}>Close top</button>
          <button onClick={() => closeModal(id)}>Update now</button>
        </div>
      )
    }
    const Opener = () => {
      const { setModal } = useModal()
      return (
        <button onClick={() => setModal(<Update />, { closable: false })}>
          Open Update
        </button>
      )
    }
    render(
      <ModalProvider>
        <Opener />
      </ModalProvider>
    )

    fireEvent.click(screen.getByText('Open Update'))
    fireEvent.click(screen.getByText('Close top'))
    act(() => {
      jest.advanceTimersByTime(CLOSE_DURATION)
    })
    expect(screen.getByText('Update now')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Update now'))
    act(() => {
      jest.advanceTimersByTime(CLOSE_DURATION)
    })
    expect(screen.queryByText('Update now')).not.toBeInTheDocument()
  })

  test('closes modal on overlay click', () => {
    render(
      <ModalProvider>
        <TestComponent />
      </ModalProvider>
    )

    fireEvent.click(screen.getByText('Open Modal'))
    expect(screen.getByTestId('modal-content')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('overlay'))

    act(() => {
      jest.advanceTimersByTime(CLOSE_DURATION)
    })

    expect(screen.queryByTestId('modal-content')).not.toBeInTheDocument()
  })

  test('removes wrapper from stack after close, not just content', () => {
    render(
      <ModalProvider>
        <TestComponent />
      </ModalProvider>
    )

    fireEvent.click(screen.getByText('Open Modal'))
    expect(screen.getAllByTestId('modal-wrapper').length).toBe(1)

    fireEvent.click(screen.getByText('Close Modal'))
    act(() => {
      jest.advanceTimersByTime(CLOSE_DURATION)
    })

    expect(screen.queryAllByTestId('modal-wrapper').length).toBe(0)
  })

  test('closes stacked modals sequentially', () => {
    render(
      <ModalProvider>
        <StackedModalsTestComponent />
      </ModalProvider>
    )

    fireEvent.click(screen.getByText('open A'))
    fireEvent.click(screen.getByText('open B'))
    expect(screen.getAllByTestId('modal-wrapper').length).toBe(2)

    fireEvent.click(screen.getByText('close'))
    act(() => {
      jest.advanceTimersByTime(CLOSE_DURATION)
    })
    expect(screen.queryByTestId('modal-B')).not.toBeInTheDocument()
    expect(screen.getByTestId('modal-A')).toBeInTheDocument()
    expect(screen.getAllByTestId('modal-wrapper').length).toBe(1)

    fireEvent.click(screen.getByText('close'))
    act(() => {
      jest.advanceTimersByTime(CLOSE_DURATION)
    })
    expect(screen.queryByTestId('modal-A')).not.toBeInTheDocument()
    expect(screen.queryAllByTestId('modal-wrapper').length).toBe(0)
  })

  test('rapid double-close targets the modal beneath one mid-transition', () => {
    render(
      <ModalProvider>
        <StackedModalsTestComponent />
      </ModalProvider>
    )

    fireEvent.click(screen.getByText('open A'))
    fireEvent.click(screen.getByText('open B'))
    fireEvent.click(screen.getByText('close'))
    fireEvent.click(screen.getByText('close'))

    act(() => {
      jest.advanceTimersByTime(CLOSE_DURATION)
    })

    expect(screen.queryByTestId('modal-A')).not.toBeInTheDocument()
    expect(screen.queryByTestId('modal-B')).not.toBeInTheDocument()
    expect(screen.queryAllByTestId('modal-wrapper').length).toBe(0)
  })

  test('renders sideDrawer modal correctly', () => {
    render(
      <ModalProvider>
        <TestSideDrawerComponent />
      </ModalProvider>
    )

    fireEvent.click(screen.getByText('Open Side Drawer Modal'))

    expect(screen.getByTestId('side-drawer')).toBeInTheDocument()
    expect(screen.getByTestId('side-drawer-content')).toBeInTheDocument()
  })
})
