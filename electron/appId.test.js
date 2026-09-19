/* eslint-env jest */

const fs = require('fs')
const path = require('path')

const APP_ID = 'works.dexterity.lockwright'

const root = path.join(__dirname, '..')

describe('Lockwright app id', () => {
  it('is works.dexterity.lockwright in package.json and electron-builder configs', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8')
    )
    expect(pkg.build.appId).toBe(APP_ID)

    for (const file of [
      'electron-builder.win.json',
      'electron-builder.linux.json',
      'electron-builder.mac.json'
    ]) {
      const cfg = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
      expect(cfg.appId).toBe(APP_ID)
    }
  })

  it('pins @tetherto/pearpass-lib-constants to Dexterity-Works git, not Tether or file:', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8')
    )
    expect(pkg.dependencies['@tetherto/pearpass-lib-constants']).toBe(
      'git+https://github.com/Dexterity-Works/lockwright-lib-constants.git#0cf657575130f2168f883579c17daf344e4aaefd'
    )
  })

  it('pins @tetherto/pearpass-lib-ui-kit to Dexterity-Works git, not Tether', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8')
    )
    expect(pkg.dependencies['@tetherto/pearpass-lib-ui-kit']).toBe(
      'git+https://github.com/Dexterity-Works/lockwright-lib-ui-react-native-components.git#design-system-v2'
    )
  })

  it('uses package name lockwright-app-desktop, not pearpass-app-desktop', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8')
    )
    expect(pkg.name).toBe('lockwright-app-desktop')
    expect(pkg.pear.name).toBe('lockwright-app-desktop')
  })

  it('ships productName Lockwright, not PearPass', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8')
    )
    expect(pkg.productName).toBe('Lockwright')
    expect(pkg.description).toMatch(/Lockwright/)
    expect(pkg.author).toBe('Lockwright')
    expect(pkg.productName).not.toMatch(/PearPass/)

    const win = JSON.parse(
      fs.readFileSync(path.join(root, 'electron-builder.win.json'), 'utf8')
    )
    expect(win.productName).toBe('Lockwright')
    expect(win.nsis.shortcutName).toBe('Lockwright')
    expect(win.nsis.uninstallDisplayName).toBe('Lockwright')
  })

  it('points Lockwright import help at lockwright.dexterity.works, not PearPass docs', () => {
    const src = fs.readFileSync(
      path.join(
        root,
        'src/pages/SettingsView/content/ImportItemsContent/index.tsx'
      ),
      'utf8'
    )
    expect(src).not.toMatch(/docs\.pass\.pears\.com/)
    expect(src).toMatch(/PEARPASS_WEBSITE/)
  })

  it('report-a-problem opens the Lockwright contact form, not Tether Slack or Google Form', () => {
    const src = fs.readFileSync(
      path.join(
        root,
        'src/pages/SettingsView/content/ReportAProblemContent/index.tsx'
      ),
      'utf8'
    )
    expect(src).not.toMatch(/sendSlackFeedback|sendGoogleFormFeedback/)
    expect(src).toMatch(/PEARPASS_WEBSITE/)
    expect(src).toMatch(/\/contact\//)

    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8')
    )
    const links = (pkg.pear.links || []).join('\n')
    expect(links).not.toMatch(/slack\.com/)
    expect(links).not.toMatch(/docs\.google\.com\/forms/)
  })

  it('nulls the pear upgrade link for Linux AppImage like Windows', () => {
    const linux = JSON.parse(
      fs.readFileSync(path.join(root, 'electron-builder.linux.json'), 'utf8')
    )
    expect(linux.extraMetadata.upgrade).toBeNull()

    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8')
    )
    expect(pkg.scripts['dist:linux:x64']).toMatch(/PEARPASS_DISABLE_UPGRADE=1/)
    expect(pkg.scripts['dist:linux:arm64']).toMatch(/PEARPASS_DISABLE_UPGRADE=1/)
  })

  it('runs electron-builder through the stack-capping wrapper', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8')
    )
    expect(pkg.scripts['dist:linux:x64']).toMatch(
      /scripts\/run-electron-builder\.cjs/
    )
    expect(pkg.scripts['dist:linux:arm64']).toMatch(
      /scripts\/run-electron-builder\.cjs/
    )
    expect(pkg.scripts['dist:win:nsis:x64']).toMatch(
      /scripts\/run-electron-builder\.cjs/
    )
  })

  it('sets StartupWMClass so a taskbar pin matches the running window', () => {
    const linux = JSON.parse(
      fs.readFileSync(path.join(root, 'electron-builder.linux.json'), 'utf8')
    )
    // electron-builder 26: linux.desktop is LinuxDesktopFile { entry }, not
    // a flat Name/StartupWMClass map (schema rejects that as "should be null").
    expect(linux.linux.desktop.entry.StartupWMClass).toBe('Lockwright')
    expect(linux.linux.desktop.Name).toBeUndefined()

    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8')
    )
    expect(pkg.build.linux.desktop.entry.StartupWMClass).toBe('Lockwright')
    expect(pkg.build.linux.desktop.Name).toBeUndefined()
  })
})
