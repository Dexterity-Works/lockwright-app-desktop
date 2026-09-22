import React, { useCallback, useEffect, useRef } from 'react'

import {
  useCreateVault,
  useVault,
  useVaults,
  type Vault
} from 'lockwright-lib-vault'
import { pearpassVaultClient } from 'lockwright-lib-vault/src/instances'

import { useVaultSwitch } from './useVaultSwitch'
import { AccessRemovedModalContent } from '../containers/Modal/AccessRemovedModalContent'
import { useModal } from '../context/ModalContext'
import { useRouter } from '../context/RouterContext'
import { useToast } from '../context/ToastContext'
import { useTranslation } from './useTranslation'
import { logger } from '../utils/logger'

/**
 * Receive-side handler for "another device removed me from this vault".
 * Wipes local data, recovers to a fresh "Personal" vault when nothing
 * remains, and shows the access-removed modal.
 */
export const useVaultAccessRevoked = () => {
  const { t } = useTranslation()
  const { setModal } = useModal()
  const { setToast } = useToast()
  const { navigate } = useRouter()
  const { data: vaults } = useVaults()
  const { data: activeVault, deleteVaultLocal, addDevice } = useVault()
  const { switchVault } = useVaultSwitch()
  const { createVault } = useCreateVault()

  const latest = useRef({
    vaults,
    activeVault,
    deleteVaultLocal,
    addDevice,
    switchVault,
    createVault,
    setModal,
    setToast,
    navigate,
    t
  })
  useEffect(() => {
    latest.current = {
      vaults,
      activeVault,
      deleteVaultLocal,
      addDevice,
      switchVault,
      createVault,
      setModal,
      setToast,
      navigate,
      t
    }
  })

  const handleAccessRevoked = useCallback(
    async (
      { vaultId, actor }: { vaultId: string; actor?: string } = {} as {
        vaultId: string
        actor?: string
      }
    ) => {
      if (!vaultId) return
      const {
        vaults,
        activeVault,
        deleteVaultLocal,
        addDevice,
        switchVault,
        createVault,
        setModal,
        setToast,
        navigate,
        t
      } = latest.current

      const vault = (vaults ?? []).find((v: Vault) => v.id === vaultId)
      if (!vault) return
      const vaultName = vault.name ?? vaultId
      const deviceName = (vault.devices ?? []).find(
        (d: { id?: string }) => d?.id === actor
      )?.name as string | undefined
      const wasActive = activeVault?.id === vaultId

      try {
        await deleteVaultLocal(vaultId)
      } catch (error) {
        logger.error(
          'useVaultAccessRevoked',
          'deleteVaultLocal failed:',
          error
        )
        setModal(
          <AccessRemovedModalContent
            vaultName={vaultName}
            deviceName={deviceName}
          />
        )
        return
      }

      if (wasActive) {
        const next = (vaults ?? []).find((v: Vault) => v.id !== vaultId)
        if (next) {
          await switchVault(next)
        } else {
          try {
            await createVault({ name: t('Personal') })
            await addDevice()
            navigate('vault', { recordType: 'all' })
            setToast({
              message: t('A new "Personal" vault was created')
            })
          } catch (error) {
            logger.error(
              'useVaultAccessRevoked',
              'failed to create fallback Personal vault:',
              error
            )
            setToast({
              message: t("Couldn't create a starter vault. Please try again.")
            })
          }
        }
      }

      setModal(
        <AccessRemovedModalContent
          vaultName={vaultName}
          deviceName={deviceName}
        />
      )
    },
    []
  )

  useEffect(() => {
    const client = pearpassVaultClient as
      | undefined
      | {
          on?: (event: string, handler: (payload: unknown) => void) => void
          off?: (event: string, handler: (payload: unknown) => void) => void
        }
    if (!client?.on) return
    client.on(
      'vault-access-revoked',
      handleAccessRevoked as (payload: unknown) => void
    )
    return () => {
      client.off?.(
        'vault-access-revoked',
        handleAccessRevoked as (payload: unknown) => void
      )
    }
  }, [handleAccessRevoked])
}
