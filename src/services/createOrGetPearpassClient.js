import { PearpassVaultClient } from 'lockwright-lib-vault-core'

let pearpassClient = null

/**
 * @param {import('lockwright-lib-vault-core').PearpassVaultClient} [ipc]
 * @param {string} [storagePath]  absolute path where vaults live
 * @param {{ debugMode?: boolean }} [opts={}]
 * @returns {PearpassVaultClient}
 */
export function createOrGetPearpassClient(ipc, storagePath, opts = {}) {
  if (!pearpassClient) {
    // If we're given an already-constructed client-like object
    // proxy or a real PearpassVaultClient), reuse it directly instead of creating
    // a new low-level client.
    if (ipc && typeof ipc.encryptionGetStatus === 'function') {
      pearpassClient = ipc
    } else {
      if (!ipc || !storagePath) {
        throw new Error(
          'createOrGetPearpassClient: ipc and storagePath are required for initial client creation'
        )
      }
      pearpassClient = new PearpassVaultClient(ipc, storagePath, opts)
    }
  }

  return pearpassClient
}
