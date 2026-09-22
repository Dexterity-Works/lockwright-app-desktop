import { useEffect, useState } from 'react'

import { useUserData } from 'lockwright-lib-vault'

import { NAVIGATION_ROUTES } from '../../../constants/navigation'
import { useRouter } from '../../../context/RouterContext'
import { logger } from '../../../utils/logger'

const INIT_TIMEOUT_MS = 5_000

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} message
 * @returns {Promise<T>}
 */
const withTimeout = (promise, ms, message) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })

/**
 * @returns {Object} An object containing:
 * @property {boolean} isLoading - Indicates if the user data is currently loading.
 */
export const useRedirect = () => {
  const [isLoading, setIsLoading] = useState(true)

  const { navigate } = useRouter()

  const { refetch: refetchUser } = useUserData()

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const diskHasVault = await Promise.resolve(
        window.electronAPI?.getConfig?.()
      )
        .then((config) => !!config?.hasVault)
        .catch(() => false)

      try {
        setIsLoading(true)
        const userData = await withTimeout(
          refetchUser(),
          INIT_TIMEOUT_MS,
          'Timed out initializing user'
        )
        if (cancelled) return

        if (userData?.masterPasswordStatus?.isLocked) {
          navigate('welcome', {
            state: NAVIGATION_ROUTES.SCREEN_LOCKED
          })
          return
        }

        if (userData?.hasPasswordSet || diskHasVault) {
          navigate('welcome', {
            state: NAVIGATION_ROUTES.MASTER_PASSWORD
          })
          return
        }

        navigate('intro')
      } catch (error) {
        logger.error('Error fetching user data:', error)
        // Router defaults to currentPage 'loading'. Always leave that page,
        // or Routes will keep rendering LoadingPage forever.
        // Empty storage: intro. Copied/existing vault: unlock, even if
        // initializeUser timed out — create-password would fork the store.
        if (!cancelled) {
          if (diskHasVault) {
            navigate('welcome', {
              state: NAVIGATION_ROUTES.MASTER_PASSWORD
            })
          } else {
            navigate('intro')
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return {
    isLoading
  }
}
