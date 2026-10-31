/* eslint-env jest */

const fs = require('fs')
const os = require('os')
const path = require('path')

const {
  installAppImageDesktop
} = require('./installAppImageDesktop.cjs')

const APP_ID = 'works.dexterity.lockwright'

describe('installAppImageDesktop', () => {
  let home

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'lw-appimage-desktop-'))
  })

  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true })
  })

  it('no-ops when APPIMAGE is unset', () => {
    const result = installAppImageDesktop({
      appImagePath: '',
      home,
      productName: 'Lockwright',
      appId: APP_ID,
      iconSourcePath: path.join(home, 'icon.png')
    })
    expect(result.installed).toBe(false)
    expect(
      fs.existsSync(path.join(home, '.local/share/applications'))
    ).toBe(false)
  })

  it('refuses a squashfs mount path so a pin cannot outlive the AppImage', () => {
    const result = installAppImageDesktop({
      appImagePath: '/tmp/.mount_LockwrcbbfCk/lockwright-app-desktop.bin',
      home,
      productName: 'Lockwright',
      appId: APP_ID,
      iconSourcePath: path.join(home, 'icon.png')
    })
    expect(result.installed).toBe(false)
    expect(result.reason).toBe('mount-path')
  })

  it('writes Exec to the AppImage file, not the /tmp/.mount_* binary', () => {
    const appImage = path.join(home, 'Apps', 'Lockwright.AppImage')
    fs.mkdirSync(path.dirname(appImage), { recursive: true })
    fs.writeFileSync(appImage, 'elf')
    const icon = path.join(home, 'icon.png')
    fs.writeFileSync(icon, 'png-bytes')

    const result = installAppImageDesktop({
      appImagePath: appImage,
      home,
      productName: 'Lockwright',
      appId: APP_ID,
      iconSourcePath: icon
    })

    expect(result.installed).toBe(true)
    const body = fs.readFileSync(result.desktopPath, 'utf8')
    expect(body).toContain(`Exec="${appImage}" %U`)
    expect(body).not.toMatch(/\/tmp\/\.mount_/)
    expect(body).not.toContain('lockwright-app-desktop.bin')
    expect(body).toContain('StartupWMClass=Lockwright')
    expect(body).toContain(`Icon=${APP_ID}`)
    expect(
      fs.readFileSync(
        path.join(
          home,
          '.local/share/icons/hicolor/256x256/apps',
          `${APP_ID}.png`
        )
      ).toString()
    ).toBe('png-bytes')
  })

  it('rewrites a leftover pin that still Execs a vanished mount', () => {
    const appImage = path.join(home, 'Lockwright.AppImage')
    fs.writeFileSync(appImage, 'elf')
    const desktopDir = path.join(home, '.local/share/applications')
    fs.mkdirSync(desktopDir, { recursive: true })
    const desktopPath = path.join(desktopDir, `${APP_ID}.desktop`)
    fs.writeFileSync(
      desktopPath,
      [
        '[Desktop Entry]',
        'Name=Lockwright',
        'Exec=/tmp/.mount_LockwrcbbfCk/lockwright-app-desktop.bin %U',
        'Type=Application',
        ''
      ].join('\n')
    )

    const result = installAppImageDesktop({
      appImagePath: appImage,
      home,
      productName: 'Lockwright',
      appId: APP_ID,
      iconSourcePath: path.join(home, 'missing.png')
    })

    expect(result.installed).toBe(true)
    const body = fs.readFileSync(desktopPath, 'utf8')
    expect(body).toContain(`Exec="${appImage}" %U`)
    expect(body).not.toMatch(/\/tmp\/\.mount_/)
  })
})

describe('desktop main process wiring', () => {
  it('installs the AppImage .desktop from APPIMAGE before createWindow', () => {
    const main = fs.readFileSync(
      path.join(__dirname, 'main.cjs'),
      'utf8'
    )
    const installAt = main.indexOf('installAppImageDesktop({')
    const defineWindowAt = main.indexOf('function createWindow()')
    const lastWindowCallAt = main.lastIndexOf('createWindow()')
    expect(installAt).toBeGreaterThan(-1)
    expect(main).toContain('process.env.APPIMAGE')
    expect(main).toContain("appendSwitch('class', boot.wmClass)")
    expect(installAt).toBeGreaterThan(defineWindowAt)
    expect(installAt).toBeLessThan(lastWindowCallAt)
  })
})
