const fs = require('fs')
const path = require('path')
const { legacyUserDataDirs } = require('./migrateUserData.cjs')
const { restampCopiedCorestores } = require('./restampCopiedCorestores.cjs')

function dirHasEntries(dir, fsImpl = fs) {
  try {
    if (!fsImpl.existsSync(dir)) return false
    if (!fsImpl.statSync(dir).isDirectory()) return false
    return fsImpl.readdirSync(dir).length > 0
  } catch {
    return false
  }
}

function hasVault(storageRoot, fsImpl = fs) {
  return ['vault', 'vaults', 'encryption'].some((name) =>
    dirHasEntries(path.join(storageRoot, name), fsImpl)
  )
}

function upgradeLinkId(upgrade) {
  if (!upgrade || typeof upgrade !== 'string') return null
  return upgrade.replace(/^pear:\/\//, '')
}

function isLocalStorageDir(storageDir) {
  return path.basename(storageDir) === 'local'
}

function isInheritedStorageDir(storageDir, upgrade) {
  if (isLocalStorageDir(storageDir)) return true
  const linkId = upgradeLinkId(upgrade)
  return !linkId || path.basename(storageDir) !== linkId
}

function listByDkeyStores(userDataDir, fsImpl) {
  const root = path.join(userDataDir, 'app-storage', 'by-dkey')
  if (!dirHasEntries(root, fsImpl)) return []
  return fsImpl
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      id: entry.name,
      dir: path.join(root, entry.name)
    }))
    .filter((entry) => hasVault(entry.dir, fsImpl))
}

function pickRuntimeStorageDir({ userDataDir, upgrade, fsImpl = fs } = {}) {
  if (!userDataDir) return null

  const local = path.join(userDataDir, 'app-storage', 'local')
  if (hasVault(local, fsImpl)) return local

  const stores = listByDkeyStores(userDataDir, fsImpl)
  const linkId = upgradeLinkId(upgrade)
  const inherited = stores.filter((store) => store.id !== linkId)
  if (inherited.length === 1) return inherited[0].dir
  if (inherited.length > 1) {
    inherited.sort((a, b) => a.id.localeCompare(b.id))
    return inherited[0].dir
  }
  if (stores.length === 1) return stores[0].dir
  if (hasVault(userDataDir, fsImpl)) return userDataDir
  if (!upgrade) return local
  return path.join(userDataDir, 'app-storage', 'by-dkey', linkId)
}

function adoptInheritedVault({
  destDir,
  sourceDirs,
  upgrade,
  fsImpl = fs
} = {}) {
  if (!destDir) return null

  const destPick = pickRuntimeStorageDir({
    userDataDir: destDir,
    upgrade,
    fsImpl
  })
  if (
    destPick &&
    hasVault(destPick, fsImpl) &&
    isInheritedStorageDir(destPick, upgrade) &&
    !isLocalStorageDir(destPick)
  ) {
    restampCopiedCorestores(destPick, fsImpl)
    return destPick
  }

  for (const sourceDir of sourceDirs || []) {
    if (!sourceDir || path.resolve(sourceDir) === path.resolve(destDir)) {
      continue
    }
    const found = pickRuntimeStorageDir({
      userDataDir: sourceDir,
      upgrade,
      fsImpl
    })
    if (!found || !hasVault(found, fsImpl)) continue
    const rel = path.relative(sourceDir, found)
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) continue
    const destFound = path.join(destDir, rel)
    if (!hasVault(destFound, fsImpl)) {
      fsImpl.mkdirSync(path.dirname(destFound), { recursive: true })
      fsImpl.cpSync(found, destFound, { recursive: true, force: false })
      restampCopiedCorestores(destFound, fsImpl)
    }
    return destFound
  }

  if (destPick && hasVault(destPick, fsImpl)) return destPick
  return null
}

/**
 * Resolve the storage root the vault opens.
 * 0) A test profile always uses <userData>/app-storage/local: no adoption,
 *    no Pear platform store, no per-link store. It touches nothing on disk.
 * 1) A classic PearPass vault in userData or a sibling folder is adopted.
 * 2) No upgrade link: <userData>/app-storage/local.
 * 3) Flatpak/snap: the per-link folder under userData.
 * 4) If the legacy Pear platform store knows this app (existing install),
 *    use that path for full compatibility; otherwise the per-link folder.
 * @param {object} opts
 * @param {string} opts.userDataDir sandbox-safe userData
 * @param {string | null} [opts.profile]
 * @param {string | null} [opts.upgrade]
 * @param {string | null} [opts.legacyChannelLink]
 * @param {boolean} [opts.isSandboxed] flatpak or snap
 * @param {(link: string) => Promise<string | null>} opts.getLegacyStorage
 * @param {(p: string) => string} [opts.toSandboxSafePath]
 * @param {{ info: Function, warn: Function }} opts.logger
 * @param {typeof fs} [opts.fsImpl]
 * @returns {Promise<string>}
 */
async function resolveRuntimeStorageDir({
  userDataDir,
  profile = null,
  upgrade,
  legacyChannelLink,
  isSandboxed = false,
  getLegacyStorage,
  toSandboxSafePath = (p) => p,
  logger,
  fsImpl = fs
}) {
  if (profile) {
    const storageDir = path.join(userDataDir, 'app-storage', 'local')
    logger.info('[MAIN]', 'Using test profile storage root:', storageDir)
    return storageDir
  }

  let storageDir = userDataDir

  // Classic PearPass stores the vault at userData/app-storage/by-dkey/{id}.
  // Copy+open that folder when Lockwright userData is empty or only has a
  // new per-link store. Do this before the local / upgrade-id fallbacks.
  const inherited = adoptInheritedVault({
    destDir: storageDir,
    sourceDirs: legacyUserDataDirs(storageDir),
    upgrade,
    fsImpl
  })
  if (inherited) {
    logger.info('[MAIN]', 'Using inherited vault storage:', inherited)
    return inherited
  }

  // Local/NSIS builds may omit the pear upgrade channel. Keep vault data under
  // a stable folder and never call String methods on a null upgrade link.
  if (!upgrade) {
    storageDir = path.join(storageDir, 'app-storage', 'local')
    logger.info(
      '[MAIN]',
      'Using local app-storage root (no upgrade link):',
      storageDir
    )
    return storageDir
  }

  const linkId = upgrade.replace(/^pear:\/\//, '')

  if (isSandboxed) {
    storageDir = path.join(storageDir, 'app-storage', 'by-dkey', linkId)
    logger.info('[MAIN]', 'Using sandbox per-link storage root:', storageDir)
    return storageDir
  }

  try {
    const legacyStorageDir = legacyChannelLink
      ? await getLegacyStorage(legacyChannelLink)
      : null

    if (legacyStorageDir) {
      storageDir = toSandboxSafePath(legacyStorageDir)
      logger.info('[MAIN]', 'Using pear legacy storage root:', storageDir)
    } else {
      storageDir = path.join(storageDir, 'app-storage', 'by-dkey', linkId)
      logger.warn(
        'MAIN',
        'pear-runtime-legacy-storage returned null; using per-link Electron storage:',
        storageDir
      )
    }
  } catch (err) {
    storageDir = path.join(userDataDir, 'app-storage', 'by-dkey', linkId)
    logger.warn(
      'MAIN',
      'Failed to resolve legacy pear storage, using per-link Electron storage:',
      legacyChannelLink,
      err && err.message ? err.message : err,
      'storageDir=',
      storageDir
    )
  }

  return storageDir
}

module.exports = {
  adoptInheritedVault,
  hasVault,
  pickRuntimeStorageDir,
  resolveRuntimeStorageDir
}
