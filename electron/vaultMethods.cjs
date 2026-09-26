/**
 * Vault client methods the renderer may invoke over `vault:invoke`.
 * Main checks against this list before touching the client, so the IPC
 * channel cannot reach EventEmitter internals or any other property.
 */

// `removeVault` deletes a whole vault (disk wipe + master entry).
// `vaultsRemove` deletes a single key from the master vault. Distinct.
const VAULT_METHODS = [
  'setStoragePath',
  'vaultsInit',
  'vaultsGetStatus',
  'vaultsGet',
  'vaultsClose',
  'vaultsAdd',
  'removeVault',
  'activeVaultGetFile',
  'activeVaultRemoveFile',
  'vaultsList',
  'activeVaultInit',
  'activeVaultGetStatus',
  'getVaultMigrationStatus',
  'recordFailedMasterPassword',
  'getMasterPasswordStatus',
  'resetFailedAttempts',
  'createMasterPassword',
  'initWithPassword',
  'updateMasterPassword',
  'initWithCredentials',
  'activeVaultClose',
  'activeVaultAdd',
  'activeVaultRemove',
  'activeVaultRemoveWriter',
  'activeVaultList',
  'activeVaultGet',
  'activeVaultCreateInvite',
  'activeVaultDeleteInvite',
  'pairActiveVault',
  'cancelPairActiveVault',
  'initListener',
  'getBlindMirrors',
  'addBlindMirrors',
  'removeBlindMirror',
  'addDefaultBlindMirrors',
  'removeAllBlindMirrors',
  'encryptionInit',
  'encryptExportData',
  'encryptionGetStatus',
  'encryptionGet',
  'encryptionAdd',
  'hashPassword',
  'encryptVaultKeyWithHashedPassword',
  'encryptVaultWithKey',
  'getDecryptionKey',
  'decryptVaultKey',
  'encryptionClose',
  'closeAllInstances',
  'activeVaultAddFile',
  'activeVaultGetFile',
  'beginBackground',
  'endBackground',
  'generateOtpCodesByIds',
  'generateHotpNext',
  'addOtpToRecord',
  'exportOtpRecords',
  'removeOtpFromRecord',
  'findOtpDuplicates',
  'fetchFavicon',
  'decryptExportData',
  'decryptBitwardenExport',
  'decryptProtonExport',
  'keepassArgon2',
  'activeVaultFind',
  'activeVaultGetWriterKey',
  'personalSwarmInit',
  'personalSwarmClose',
  'personalSwarmGetTopic',
  'personalSwarmSend',
  'vaultsRemove',
  'vaultsFind',
  'signMessage',
  'verifySignature'
]

const VAULT_METHOD_SET = new Set(VAULT_METHODS)

/**
 * @param {unknown} method
 * @throws {Error} when the method is not a listed vault client method
 */
function assertVaultMethod(method) {
  if (typeof method !== 'string' || !VAULT_METHOD_SET.has(method)) {
    throw new Error(`Unknown vault method: ${method}`)
  }
}

module.exports = { VAULT_METHODS, assertVaultMethod }
