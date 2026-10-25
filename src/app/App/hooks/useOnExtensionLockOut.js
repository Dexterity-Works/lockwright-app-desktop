import { useEffect } from 'react'

import { NAVIGATION_ROUTES } from '../../../constants/navigation'
import { HANDLER_EVENTS } from '../../../constants/services'
import { useModal } from '../../../context/ModalContext'
import { useRouter } from '../../../context/RouterContext'

export const useOnExtensionLockOut = () => {
  const { navigate } = useRouter()
  const { closeModal } = useModal()

  useEffect(() => {
    const handleExtensionLockOut = () => {
      // Forced, as on any lock: no modal may stay over the lock screen.
      closeModal({ force: true })
      navigate('welcome', { state: NAVIGATION_ROUTES.SCREEN_LOCKED })
    }

    window.addEventListener(
      HANDLER_EVENTS.extensionLock,
      handleExtensionLockOut
    )

    return () => {
      window.removeEventListener(
        HANDLER_EVENTS.extensionLock,
        handleExtensionLockOut
      )
    }
  }, [navigate, closeModal])
}
