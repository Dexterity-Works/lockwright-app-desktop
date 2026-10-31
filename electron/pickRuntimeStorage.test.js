/* eslint-env jest */

const fs = require('fs')
const os = require('os')
const path = require('path')

const {
  adoptInheritedVault,
  hasVault,
  pickRuntimeStorageDir,
  resolveRuntimeStorageDir
} = require('./pickRuntimeStorage.cjs')

const OLD_ID = 'oldpearpassdkey11111111111111111111111111111111111'
const NEW_ID = 'newlockwrightdkey222222222222222222222222222222222'

function writeVault(storageRoot) {
  const vaultFile = path.join(storageRoot, 'vault', 'core')
  fs.mkdirSync(path.dirname(vaultFile), { recursive: true })
  fs.writeFileSync(vaultFile, 'vault-bytes')
  return vaultFile
}

function writeMasterStore(storageRoot) {
  for (const name of ['encryption', 'vaults']) {
    const marker = path.join(storageRoot, name, 'db', 'CURRENT')
    fs.mkdirSync(path.dirname(marker), { recursive: true })
    fs.writeFileSync(marker, 'corestore')
  }
}

function writeCorestoreDeviceFile(storageRoot) {
  writeMasterStore(storageRoot)
  const file = path.join(storageRoot, 'encryption', 'CORESTORE')
  fs.writeFileSync(
    file,
    [
      'device/platform=linux',
      'device/inode=1',
      'device/created=1',
      'device/attribute=original',
      ''
    ].join('\n')
  )
  return file
}

describe('hasVault', () => {
  let root

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true })
    root = null
  })

  it('is true when encryption and vaults exist without a vault folder', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lockwright-hasvault-'))
    writeMasterStore(root)
    expect(hasVault(root)).toBe(true)
  })

  it('uses real fs when the renderer asks with one argument', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lockwright-hasvault-'))
    writeVault(root)
    expect(hasVault(root)).toBe(true)
  })
})

describe('pickRuntimeStorageDir', () => {
  let root

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true })
    root = null
  })

  it('opens app-storage/by-dkey/{id} when that is the copied PearPass vault', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lockwright-pick-'))
    const userDataDir = path.join(root, 'Lockwright')
    const inherited = path.join(userDataDir, 'app-storage', 'by-dkey', OLD_ID)
    writeVault(inherited)

    expect(
      pickRuntimeStorageDir({
        userDataDir,
        upgrade: `pear://${NEW_ID}`
      })
    ).toBe(inherited)
  })

  it('opens by-dkey/{id} even when the upgrade link is null (Windows / no OTA)', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lockwright-pick-'))
    const userDataDir = path.join(root, 'Lockwright')
    const inherited = path.join(userDataDir, 'app-storage', 'by-dkey', OLD_ID)
    writeVault(inherited)

    expect(
      pickRuntimeStorageDir({
        userDataDir,
        upgrade: null
      })
    ).toBe(inherited)
  })

  it('opens a copied by-dkey store that only has encryption and vaults', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lockwright-pick-'))
    const userDataDir = path.join(root, 'Lockwright')
    const inherited = path.join(userDataDir, 'app-storage', 'by-dkey', OLD_ID)
    writeMasterStore(inherited)

    expect(
      pickRuntimeStorageDir({
        userDataDir,
        upgrade: null
      })
    ).toBe(inherited)
  })

  it('opens userData when PearPass stored encryption at the folder root', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lockwright-pick-'))
    const userDataDir = path.join(root, 'Lockwright')
    writeMasterStore(userDataDir)

    expect(
      pickRuntimeStorageDir({
        userDataDir,
        upgrade: null
      })
    ).toBe(userDataDir)
  })

  it('prefers app-storage/local when that folder already has a vault', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lockwright-pick-'))
    const userDataDir = path.join(root, 'Lockwright')
    const local = path.join(userDataDir, 'app-storage', 'local')
    writeVault(local)
    writeVault(path.join(userDataDir, 'app-storage', 'by-dkey', OLD_ID))

    expect(
      pickRuntimeStorageDir({
        userDataDir,
        upgrade: null
      })
    ).toBe(local)
  })

  it('prefers the inherited by-dkey over the current upgrade link id', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lockwright-pick-'))
    const userDataDir = path.join(root, 'Lockwright')
    const inherited = path.join(userDataDir, 'app-storage', 'by-dkey', OLD_ID)
    const current = path.join(userDataDir, 'app-storage', 'by-dkey', NEW_ID)
    writeVault(inherited)
    writeVault(current)

    expect(
      pickRuntimeStorageDir({
        userDataDir,
        upgrade: `pear://${NEW_ID}`
      })
    ).toBe(inherited)
  })

  it('falls back to app-storage/local when there is no vault and no upgrade link', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lockwright-pick-'))
    const userDataDir = path.join(root, 'Lockwright')

    expect(
      pickRuntimeStorageDir({
        userDataDir,
        upgrade: null
      })
    ).toBe(path.join(userDataDir, 'app-storage', 'local'))
  })
})

describe('adoptInheritedVault', () => {
  let root

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true })
    root = null
  })

  it('still adopts PearPass when dest already has a new local vault', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lockwright-adopt-'))
    const destDir = path.join(root, 'Lockwright')
    const sourceDir = path.join(root, 'PearPass')
    writeVault(path.join(destDir, 'app-storage', 'local'))
    writeVault(path.join(sourceDir, 'app-storage', 'by-dkey', OLD_ID))

    const adopted = adoptInheritedVault({
      destDir,
      sourceDirs: [sourceDir],
      upgrade: null
    })

    const destInherited = path.join(destDir, 'app-storage', 'by-dkey', OLD_ID)
    expect(adopted).toBe(destInherited)
    expect(
      fs.readFileSync(path.join(destInherited, 'vault', 'core'), 'utf8')
    ).toBe('vault-bytes')
  })

  it('copies PearPass by-dkey/{id} into Lockwright userData when dest has no inherited vault', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lockwright-adopt-'))
    const destDir = path.join(root, 'Lockwright')
    const sourceDir = path.join(root, 'PearPass')
    const sourceVault = path.join(sourceDir, 'app-storage', 'by-dkey', OLD_ID)
    writeVault(sourceVault)
    writeVault(path.join(destDir, 'app-storage', 'by-dkey', NEW_ID))

    const adopted = adoptInheritedVault({
      destDir,
      sourceDirs: [sourceDir],
      upgrade: `pear://${NEW_ID}`
    })

    const destInherited = path.join(destDir, 'app-storage', 'by-dkey', OLD_ID)
    expect(adopted).toBe(destInherited)
    expect(fs.readFileSync(path.join(destInherited, 'vault', 'core'), 'utf8')).toBe(
      'vault-bytes'
    )
    expect(fs.readFileSync(path.join(sourceVault, 'vault', 'core'), 'utf8')).toBe(
      'vault-bytes'
    )
  })

  it('drops copied CORESTORE files so Corestore can restamp this machine', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lockwright-adopt-'))
    const destDir = path.join(root, 'Lockwright')
    const sourceDir = path.join(root, 'PearPass')
    const sourceVault = path.join(sourceDir, 'app-storage', 'by-dkey', OLD_ID)
    writeCorestoreDeviceFile(sourceVault)
    writeVault(path.join(destDir, 'app-storage', 'by-dkey', NEW_ID))

    const adopted = adoptInheritedVault({
      destDir,
      sourceDirs: [sourceDir],
      upgrade: `pear://${NEW_ID}`
    })

    expect(adopted).toBe(
      path.join(destDir, 'app-storage', 'by-dkey', OLD_ID)
    )
    expect(
      fs.existsSync(path.join(adopted, 'encryption', 'CORESTORE'))
    ).toBe(false)
    expect(
      fs.existsSync(path.join(sourceVault, 'encryption', 'CORESTORE'))
    ).toBe(true)
    expect(
      fs.existsSync(path.join(adopted, 'encryption', 'db', 'CURRENT'))
    ).toBe(true)
  })

  it('restamps CORESTORE on an inherited vault copied on a previous launch', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lockwright-adopt-'))
    const destDir = path.join(root, 'Lockwright')
    const destInherited = path.join(destDir, 'app-storage', 'by-dkey', OLD_ID)
    writeCorestoreDeviceFile(destInherited)

    const adopted = adoptInheritedVault({
      destDir,
      sourceDirs: [],
      upgrade: `pear://${NEW_ID}`
    })

    expect(adopted).toBe(destInherited)
    expect(
      fs.existsSync(path.join(destInherited, 'encryption', 'CORESTORE'))
    ).toBe(false)
  })
})

describe('desktop main process wiring', () => {
  it('tells the renderer when the opened storage already has a vault', () => {
    const main = fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8')
    expect(main).toMatch(/hasVault:\s*hasVault\(/)
  })

  it('resolves storage through resolveRuntimeStorageDir with the profile', () => {
    const main = fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8')
    expect(main).toMatch(/pickRuntimeStorage/)
    expect(main).toMatch(/resolveStorageRoot\(\{[^}]*\bprofile,/)
    expect(main).not.toMatch(/adoptInheritedVault\(/)
  })
})

describe('resolveRuntimeStorageDir', () => {
  const UPGRADE = `pear://${NEW_ID}`
  const LEGACY_LINK = 'pear://legacychannel'
  const logger = { info: jest.fn(), warn: jest.fn() }
  let root

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true })
    root = null
    jest.clearAllMocks()
  })

  // A PearPass sibling with a vault and a Pear platform store that knows the
  // app: everything the installed app would adopt or open.
  function installedAppTree() {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lockwright-resolve-'))
    const pearPass = path.join(root, 'PearPass')
    writeVault(path.join(pearPass, 'app-storage', 'by-dkey', OLD_ID))
    const platformStore = path.join(root, 'pear', 'corestores', 'platform')
    return { pearPass, platformStore }
  }

  // Any fs call throws, so the profile branch is proven not to look.
  const untouchableFs = new Proxy(
    {},
    {
      get: (_, name) => () => {
        throw new Error(`fs.${String(name)} called under a profile`)
      }
    }
  )

  it('under a profile opens <userData>/app-storage/local and touches nothing else', async () => {
    const { platformStore } = installedAppTree()
    const userDataDir = path.join(root, 'Lockwright-profile-test1')
    const getLegacyStorage = jest.fn().mockResolvedValue(platformStore)

    const storage = await resolveRuntimeStorageDir({
      userDataDir,
      profile: 'test1',
      upgrade: UPGRADE,
      legacyChannelLink: LEGACY_LINK,
      getLegacyStorage,
      logger,
      fsImpl: untouchableFs
    })

    expect(storage).toBe(path.join(userDataDir, 'app-storage', 'local'))
    expect(getLegacyStorage).not.toHaveBeenCalled()
    // Nothing copied in from the PearPass sibling.
    expect(fs.existsSync(userDataDir)).toBe(false)
  })

  it('unset, still adopts the PearPass sibling vault first', async () => {
    installedAppTree()
    const userDataDir = path.join(root, 'Lockwright')
    const getLegacyStorage = jest.fn()

    const storage = await resolveRuntimeStorageDir({
      userDataDir,
      upgrade: UPGRADE,
      legacyChannelLink: LEGACY_LINK,
      getLegacyStorage,
      logger
    })

    const adopted = path.join(userDataDir, 'app-storage', 'by-dkey', OLD_ID)
    expect(storage).toBe(adopted)
    expect(hasVault(adopted)).toBe(true)
    expect(getLegacyStorage).not.toHaveBeenCalled()
  })

  it('unset, opens the Pear platform store when nothing is inherited', async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lockwright-resolve-'))
    const platformStore = path.join(root, 'pear', 'corestores', 'platform')
    const getLegacyStorage = jest.fn().mockResolvedValue(platformStore)

    const storage = await resolveRuntimeStorageDir({
      userDataDir: path.join(root, 'Lockwright'),
      upgrade: UPGRADE,
      legacyChannelLink: LEGACY_LINK,
      getLegacyStorage,
      toSandboxSafePath: (p) => p,
      logger
    })

    expect(getLegacyStorage).toHaveBeenCalledWith(LEGACY_LINK)
    expect(storage).toBe(platformStore)
  })

  it('unset, keeps the local, sandbox and per-link fallbacks', async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lockwright-resolve-'))
    const userDataDir = path.join(root, 'Lockwright')
    const base = { userDataDir, legacyChannelLink: LEGACY_LINK, logger }
    const perLink = path.join(userDataDir, 'app-storage', 'by-dkey', NEW_ID)

    await expect(
      resolveRuntimeStorageDir({ ...base, upgrade: null })
    ).resolves.toBe(path.join(userDataDir, 'app-storage', 'local'))
    await expect(
      resolveRuntimeStorageDir({ ...base, upgrade: UPGRADE, isSandboxed: true })
    ).resolves.toBe(perLink)
    await expect(
      resolveRuntimeStorageDir({
        ...base,
        upgrade: UPGRADE,
        getLegacyStorage: jest.fn().mockResolvedValue(null)
      })
    ).resolves.toBe(perLink)
    await expect(
      resolveRuntimeStorageDir({
        ...base,
        upgrade: UPGRADE,
        getLegacyStorage: jest.fn().mockRejectedValue(new Error('boom'))
      })
    ).resolves.toBe(perLink)
  })
})
