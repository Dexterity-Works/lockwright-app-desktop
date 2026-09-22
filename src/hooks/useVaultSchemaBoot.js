import { useEffect, useRef, useState } from 'react'

import {
  SCHEMA_V2,
  VAULT_EXT_KEY,
  emitSchemaMigrationWarning,
  useVault
} from 'lockwright-lib-vault'
import { pearpassVaultClient } from 'lockwright-lib-vault/src/instances'

import { logger } from '../utils/logger'

const POLL_MS = 100
const POLL_TIMEOUT_MS = 60_000

/**
 * Reject if `promise` does not settle within `ms`.
 * Prevents a hung RPC from defeating the boot-gate timeout.
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
 * After vault open: wait for schema-2 migrate readiness, advertise
 * recordSchema: 2 on this device, and emit SCHEMA_MIGRATION_WARNING once
 * when no other live devices still report schema 1.
 *
 * The splash/boot gate only waits on migration readiness. Device advertise +
 * warning emission run after the gate opens so a hung addDevice cannot pin
 * the UI on the loading screen.
 *
 * @returns {{ isMigrationReady: boolean, migrationProgress: { done: number, total: number }|null }}
 */
export const useVaultSchemaBoot = () => {
  const { data: activeVault, addDevice } = useVault()
  const vaultId = activeVault?.id
  const [isMigrationReady, setIsMigrationReady] = useState(!vaultId)
  const [migrationProgress, setMigrationProgress] = useState(null)
  const ranForVaultRef = useRef(null)
  // useVault().addDevice is not referentially stable — keep a ref.
  const addDeviceRef = useRef(addDevice)
  addDeviceRef.current = addDevice

  useEffect(() => {
    if (!vaultId) {
      setIsMigrationReady(true)
      setMigrationProgress(null)
      ranForVaultRef.current = null
      return
    }

    if (ranForVaultRef.current === vaultId) {
      setIsMigrationReady(true)
      return
    }

    let cancelled = false
    setIsMigrationReady(false)

    const waitForMigration = async () => {
      const client = pearpassVaultClient
      if (typeof client?.getVaultMigrationStatus !== 'function') {
        // Older worklet / client without RPC — init already awaited migrate.
        return { ready: true, migratedToSchema: SCHEMA_V2 }
      }

      const poll = async () => {
        while (!cancelled) {
          const status = await client.getVaultMigrationStatus()
          if (status?.progress && Number(status.progress.total) > 0) {
            setMigrationProgress({
              done: Number(status.progress.done) || 0,
              total: Number(status.progress.total)
            })
          }
          if (
            status?.ready === true &&
            Number(status?.migratedToSchema) >= SCHEMA_V2
          ) {
            return status
          }
          if (status?.error && !status?.inProgress) {
            throw new Error(status.error)
          }
          await new Promise((r) => setTimeout(r, POLL_MS))
        }
        return null
      }

      return withTimeout(
        poll(),
        POLL_TIMEOUT_MS,
        'Timed out waiting for vault schema migration'
      )
    }

    const maybeEmitMigrationWarning = async () => {
      const vaultExt =
        (await pearpassVaultClient.activeVaultGet(VAULT_EXT_KEY)) || {}
      if (vaultExt.blockV1DeleteMirror === true) {
        return
      }

      const devices =
        (await pearpassVaultClient.activeVaultList('device/')) ?? []
      const myWriterKey =
        (await pearpassVaultClient.activeVaultGetWriterKey?.()) ?? null

      const hasOtherV1 = devices.some((device) => {
        if (!device?.id) return false
        if (myWriterKey && device.writerKey === myWriterKey) return false
        // Missing recordSchema ⇒ legacy v1 writer.
        return Number(device.recordSchema ?? 1) < SCHEMA_V2
      })

      if (!hasOtherV1) {
        await emitSchemaMigrationWarning({ vaultId })
      }
    }

    ;(async () => {
      try {
        await waitForMigration()
        if (cancelled) return

        // Release the splash gate before side effects that can hang.
        ranForVaultRef.current = vaultId
        setIsMigrationReady(true)

        try {
          await addDeviceRef.current()
          if (cancelled) return
          await maybeEmitMigrationWarning()
        } catch (err) {
          logger.error('useVaultSchemaBoot post-migration failed', err)
        }
      } catch (err) {
        logger.error('useVaultSchemaBoot failed', err)
        // Fail open so unlock/create flows are not permanently stuck.
        if (!cancelled) {
          ranForVaultRef.current = vaultId
          setIsMigrationReady(true)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [vaultId])

  return { isMigrationReady, migrationProgress }
}
