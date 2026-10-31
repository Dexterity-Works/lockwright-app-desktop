const fs = require('fs')
const path = require('path')
const { restampCopiedCorestores } = require('./restampCopiedCorestores.cjs')

const LEGACY_USER_DATA_DIR_NAME = 'PearPass'
// Electron userData is appData/<package.json name> unless setPath pins it.
// Official PearPass and a Lockwright build that only called setName land here.
const PACKAGE_USER_DATA_DIR_NAME = 'pearpass-app-desktop'

const VAULT_DIR_NAMES = [
  'app-storage',
  'encryption',
  'vault',
  'vaults',
  'pear-runtime'
]

function dirHasEntries(dir, fsImpl) {
  try {
    if (!fsImpl.existsSync(dir)) return false
    if (!fsImpl.statSync(dir).isDirectory()) return false
    return fsImpl.readdirSync(dir).length > 0
  } catch {
    return false
  }
}

function hasVaultData(root, fsImpl) {
  if (!root || !dirHasEntries(root, fsImpl)) return false
  return VAULT_DIR_NAMES.some((name) =>
    dirHasEntries(path.join(root, name), fsImpl)
  )
}

function legacyUserDataDirs(destDir) {
  if (!destDir) return []
  const parent = path.dirname(destDir)
  return [
    path.join(parent, LEGACY_USER_DATA_DIR_NAME),
    path.join(parent, PACKAGE_USER_DATA_DIR_NAME)
  ]
}

function migratePearPassUserData({
  destDir,
  sourceDirs,
  profile = null,
  fsImpl = fs,
  logger
} = {}) {
  // A test profile never copies from the installed app's siblings.
  if (profile) {
    return { migrated: false, reason: 'profile' }
  }

  if (!destDir) {
    return { migrated: false, reason: 'no-dest' }
  }

  if (hasVaultData(destDir, fsImpl)) {
    return { migrated: false, reason: 'dest-has-data' }
  }

  const sources = (sourceDirs || []).filter(
    (dir) => dir && path.resolve(dir) !== path.resolve(destDir)
  )
  const from = sources.find((dir) => hasVaultData(dir, fsImpl))
  if (!from) {
    return { migrated: false, reason: 'no-source' }
  }

  fsImpl.mkdirSync(destDir, { recursive: true })
  fsImpl.cpSync(from, destDir, { recursive: true, force: false })
  restampCopiedCorestores(destDir, fsImpl)
  logger?.info?.('[MAIN]', 'Migrated PearPass userData', { from, to: destDir })
  return { migrated: true, from, to: destDir }
}

module.exports = {
  LEGACY_USER_DATA_DIR_NAME,
  hasVaultData,
  legacyUserDataDirs,
  migratePearPassUserData
}
