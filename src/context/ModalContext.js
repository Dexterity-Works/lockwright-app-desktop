import {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef
} from 'react'

import { html } from 'htm/react'
import { generateUniqueId } from 'lockwright-lib-utils/generate-unique-id'

import { Overlay } from '../components/Overlay'
import { BASE_TRANSITION_DURATION } from '../constants/transitions'
import { ModalWrapper } from '../containers/Modal'
import { SideDrawer } from '../containers/Modal/SideDrawer'

// Pad past the overlay fade so unmount lands after `transitionend`.
export const STACK_CLEANUP_BUFFER = 100

const ModalContext = createContext()
// The id of the modal entry a component renders in, so it can close or
// lock its own entry rather than whichever modal is on top.
const ModalEntryContext = createContext(undefined)

// The topmost entry that is not already fading out.
const getTopOpenIndex = (modalStack) => {
  for (let i = modalStack.length - 1; i >= 0; i--) {
    if (modalStack[i].isOpen) return i
  }
  return -1
}

const DEFAULT_MODAL_PARAMS = {
  hasOverlay: true,
  overlayType: 'default',
  modalType: 'default',
  closable: true,
  replace: false
}

/**
 * @param {{
 *  children: import('react').ReactNode
 * }} props
 */
export const ModalProvider = ({ children }) => {
  const [modalStack, setModalStack] = useState([])
  // Ids that already have a removal timer pending, to avoid duplicates.
  const scheduledIdsRef = useRef(new Set())

  const isOpen = !!modalStack.length
  // Escape reads the latest stack, so a modal can block it while busy.
  const modalStackRef = useRef(modalStack)
  modalStackRef.current = modalStack

  const setModal = useCallback((content, params) => {
    setModalStack((prevState) => {
      if (params?.replace) {
        return [
          {
            content,
            id: generateUniqueId(),
            isOpen: true,
            params: { ...DEFAULT_MODAL_PARAMS, ...params }
          }
        ]
      }

      return [
        ...prevState,
        {
          content,
          id: generateUniqueId(),
          isOpen: true,
          params: { ...DEFAULT_MODAL_PARAMS, ...params }
        }
      ]
    })
  }, [])

  const closeModal = useCallback((id) => {
    setModalStack((prevState) => {
      // closeModal(id) closes that entry only, and does nothing once it is
      // gone. Handlers passed as onClick get an event, not an id.
      if (typeof id === 'string') {
        const i = prevState.findIndex((m) => m.id === id)
        if (i === -1 || !prevState[i].isOpen) return prevState
        const next = [...prevState]
        next[i] = { ...next[i], isOpen: false }
        return next
      }
      // Skip entries already closing so a rapid second close hits the modal
      // beneath one mid-transition. A busy entry stays open: only
      // closeModal(id) from the entry itself closes it.
      const i = getTopOpenIndex(prevState)
      if (i === -1 || prevState[i].params.closable === false) return prevState
      const next = [...prevState]
      next[i] = { ...next[i], isOpen: false }
      return next
    })
  }, [])

  // Lets a modal block Escape and overlay clicks on its own entry while it
  // is busy. Does nothing once the entry is gone.
  const setClosable = useCallback((id, closable) => {
    setModalStack((prev) => {
      const i = prev.findIndex((m) => m.id === id)
      if (i === -1 || prev[i].params.closable === closable) return prev
      const next = [...prev]
      next[i] = { ...next[i], params: { ...next[i].params, closable } }
      return next
    })
  }, [])

  // Drops closing entries after their fade. Runs as an effect because the
  // state closeModal flips isn't visible until the next render.
  useEffect(() => {
    const closingEntries = modalStack.filter(
      (m) => !m.isOpen && !scheduledIdsRef.current.has(m.id)
    )
    if (closingEntries.length === 0) return

    closingEntries.forEach(({ id }) => {
      scheduledIdsRef.current.add(id)
      setTimeout(() => {
        setModalStack((prev) => prev.filter((m) => m.id !== id))
        scheduledIdsRef.current.delete(id)
      }, BASE_TRANSITION_DURATION + STACK_CLEANUP_BUFFER)
    })
  }, [modalStack])

  useEffect(() => {
    const handleKeydown = (event) => {
      if (event.key === 'Escape' && isOpen) {
        const stack = modalStackRef.current
        const topOpen = stack[getTopOpenIndex(stack)]
        if (topOpen && topOpen.params?.closable !== false) {
          void closeModal()
        }
      }
    }

    window.addEventListener('keydown', handleKeydown)

    return () => {
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [isOpen])

  const contextValue = useMemo(
    () => ({ isOpen, setModal, closeModal, setClosable }),
    [isOpen, setModal, closeModal, setClosable]
  )

  return html`
    <${ModalContext.Provider} value=${contextValue}>
      ${children}
      ${modalStack?.map(
        ({ content, id, isOpen, params }) => html`
          <${ModalWrapper} key=${id}>
            ${params.hasOverlay &&
            html`<${Overlay}
              onClick=${params?.closable ? closeModal : undefined}
              type=${params.overlayType}
              isOpen=${isOpen}
            /> `}
            <${ModalEntryContext.Provider} value=${id}>
              ${params.modalType === 'sideDrawer' &&
              html`<${SideDrawer} isOpen=${isOpen}> ${content} <//>`}
              ${params.modalType === 'default' && isOpen && content}
            <//>
          <//>
        `
      )}
    <//>
  `
}

/**
 * @returns {{
 *   isOpen: boolean,
 *   setModal: (content: any, params?: any) => void,
 *   closeModal: (id?: unknown) => void,
 *   setClosable: (id: string | undefined, closable: boolean) => void
 * }}
 */
export const useModal = () => useContext(ModalContext)

/**
 * @returns {string | undefined} id of the modal entry this renders in
 */
export const useModalEntryId = () => useContext(ModalEntryContext)
