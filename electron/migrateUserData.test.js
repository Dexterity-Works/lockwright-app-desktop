/* eslint-env jest */

const fs = require('fs')
const os = require('os')
const path = require('path')

const {
  LEGACY_USER_DATA_DIR_NAME,
  legacyUserDataDirs,
  migratePearPassUserData
} = require('./migrateUserData.cjs')

function makeTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lockwright-migrate-'))
  const destDir = path.join(root, 'Lockwright')
  const sourceDir = path.join(root, 'PearPass')
  return { root, destDir, sourceDir }
}

function writeVault(dir) {
  const vaultFile = path.join(dir, 'app-storage', 'local', 'vault', 'core')
  fs.mkdirSync(path.dirname(vaultFile), { recursive: true })
  fs.writeFileSync(vaultFile, 'vault-bytes')
  return vaultFile
}

describe('migratePearPassUserData', () => {
  let root

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true })
    root = null
  })

  it('names the legacy folder PearPass next to Lockwright userData', () => {
    expect(LEGACY_USER_DATA_DIR_NAME).toBe('PearPass')
    expect(legacyUserDataDirs('/home/x/.config/Lockwright')).toEqual([
      '/home/x/.config/PearPass',
      '/home/x/.config/pearpass-app-desktop'
    ])
  })

  it('copies a vault left in pearpass-app-desktop (Electron name, not productName)', () => {
    const tree = makeTree()
    root = tree.root
    const namedDir = path.join(tree.root, 'pearpass-app-desktop')
    writeVault(namedDir)

    const result = migratePearPassUserData({
      destDir: tree.destDir,
      sourceDirs: legacyUserDataDirs(tree.destDir)
    })

    expect(result).toEqual({
      migrated: true,
      from: namedDir,
      to: tree.destDir
    })
    expect(
      fs.readFileSync(
        path.join(tree.destDir, 'app-storage', 'local', 'vault', 'core'),
        'utf8'
      )
    ).toBe('vault-bytes')
  })

  it('copies PearPass vault data into an empty Lockwright userData dir', () => {
    const tree = makeTree()
    root = tree.root
    writeVault(tree.sourceDir)

    const result = migratePearPassUserData({
      destDir: tree.destDir,
      sourceDirs: [tree.sourceDir]
    })

    expect(result).toEqual({
      migrated: true,
      from: tree.sourceDir,
      to: tree.destDir
    })
    expect(
      fs.readFileSync(
        path.join(tree.destDir, 'app-storage', 'local', 'vault', 'core'),
        'utf8'
      )
    ).toBe('vault-bytes')
    expect(
      fs.readFileSync(
        path.join(tree.sourceDir, 'app-storage', 'local', 'vault', 'core'),
        'utf8'
      )
    ).toBe('vault-bytes')
  })

  it('does not overwrite a Lockwright dir that already has vault data', () => {
    const tree = makeTree()
    root = tree.root
    writeVault(tree.sourceDir)
    const destVault = writeVault(tree.destDir)
    fs.writeFileSync(destVault, 'lockwright-bytes')

    const result = migratePearPassUserData({
      destDir: tree.destDir,
      sourceDirs: [tree.sourceDir]
    })

    expect(result).toEqual({ migrated: false, reason: 'dest-has-data' })
    expect(fs.readFileSync(destVault, 'utf8')).toBe('lockwright-bytes')
  })

  it('drops copied CORESTORE files so Corestore can restamp this machine', () => {
    const tree = makeTree()
    root = tree.root
    writeVault(tree.sourceDir)
    const corestore = path.join(
      tree.sourceDir,
      'app-storage',
      'local',
      'encryption',
      'CORESTORE'
    )
    fs.mkdirSync(path.dirname(corestore), { recursive: true })
    fs.writeFileSync(
      corestore,
      'device/platform=linux\ndevice/attribute=original\n'
    )

    migratePearPassUserData({
      destDir: tree.destDir,
      sourceDirs: [tree.sourceDir]
    })

    expect(
      fs.existsSync(
        path.join(
          tree.destDir,
          'app-storage',
          'local',
          'encryption',
          'CORESTORE'
        )
      )
    ).toBe(false)
    expect(fs.existsSync(corestore)).toBe(true)
  })

  it('skips when PearPass has no vault data', () => {
    const tree = makeTree()
    root = tree.root
    fs.mkdirSync(tree.sourceDir, { recursive: true })
    fs.writeFileSync(path.join(tree.sourceDir, 'Cookies'), 'chrome')

    const result = migratePearPassUserData({
      destDir: tree.destDir,
      sourceDirs: [tree.sourceDir]
    })

    expect(result).toEqual({ migrated: false, reason: 'no-source' })
    expect(fs.existsSync(path.join(tree.destDir, 'app-storage'))).toBe(false)
  })

  it('still copies when Lockwright already has Chromium files but no vault', () => {
    const tree = makeTree()
    root = tree.root
    writeVault(tree.sourceDir)
    fs.mkdirSync(tree.destDir, { recursive: true })
    fs.writeFileSync(path.join(tree.destDir, 'Cookies'), 'chrome')

    const result = migratePearPassUserData({
      destDir: tree.destDir,
      sourceDirs: [tree.sourceDir]
    })

    expect(result.migrated).toBe(true)
    expect(
      fs.readFileSync(
        path.join(tree.destDir, 'app-storage', 'local', 'vault', 'core'),
        'utf8'
      )
    ).toBe('vault-bytes')
    expect(fs.readFileSync(path.join(tree.destDir, 'Cookies'), 'utf8')).toBe(
      'chrome'
    )
  })
})

describe('migratePearPassUserData under a test profile', () => {
  let root

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true })
    root = null
  })

  it('copies nothing from PearPass siblings and never touches fs', () => {
    ;({ root } = makeTree())
    const destDir = path.join(root, 'Lockwright-profile-test1')
    const sourceDir = path.join(root, 'PearPass')
    writeVault(sourceDir)
    const fsImpl = new Proxy(
      {},
      {
        get: (_, name) => () => {
          throw new Error(`fs.${String(name)} called under a profile`)
        }
      }
    )

    const result = migratePearPassUserData({
      destDir,
      sourceDirs: legacyUserDataDirs(destDir),
      profile: 'test1',
      fsImpl
    })

    expect(result).toEqual({ migrated: false, reason: 'profile' })
    expect(fs.existsSync(destDir)).toBe(false)
  })

  it('main passes the profile to the migration', () => {
    const main = fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8')
    expect(main).toMatch(/migratePearPassUserData\(\{[^}]*\bprofile,/)
  })
})

describe('desktop main process wiring', () => {
  it('migrates PearPass userData after setName and before whenReady', () => {
    const main = fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8')
    const setNameAt = main.indexOf('app.setName(pkg.productName)')
    const migrateAt = main.indexOf('migratePearPassUserData({')
    const readyAt = main.indexOf('app.whenReady()')
    expect(setNameAt).toBeGreaterThan(-1)
    expect(migrateAt).toBeGreaterThan(-1)
    expect(readyAt).toBeGreaterThan(-1)
    expect(setNameAt).toBeLessThan(migrateAt)
    expect(migrateAt).toBeLessThan(readyAt)
  })

  it('pins userData to appData/productName before any getPath userData', () => {
    const main = fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8')
    const setPathAt = main.indexOf("app.setPath('userData'")
    const getUserDataAt = main.indexOf("app.getPath('userData')")
    expect(setPathAt).toBeGreaterThan(-1)
    expect(setPathAt).toBeLessThan(getUserDataAt)
  })
})
