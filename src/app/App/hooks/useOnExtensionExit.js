import { useEffect } from 'react'

import { useVaults } from 'lockwright-lib-vault'

import { NAVIGATION_ROUTES } from '../../../constants/navigation'
import { HANDLER_EVENTS } from '../../../constants/services'
import { useModal } from '../../../context/ModalContext'
import { useRouter } from '../../../context/RouterContext'

export const useOnExtensionExit = () => {
  const { navigate } = useRouter()
  const { resetState } = useVaults()
  const { closeModal } = useModal()

  useEffect(() => {
    const handleExtensionExit = () => {
      // Forced, as on any lock: no modal may stay over the lock screen.
      closeModal({ force: true })
      navigate('welcome', { state: NAVIGATION_ROUTES.MASTER_PASSWORD })
      resetState()
    }

    window.addEventListener(HANDLER_EVENTS.extensionExit, handleExtensionExit)
    return () => {
      window.removeEventListener(
        HANDLER_EVENTS.extensionExit,
        handleExtensionExit
      )
    }
  }, [navigate, closeModal])
}
