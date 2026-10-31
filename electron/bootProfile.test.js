/* eslint-env jest */

const fs = require('fs')
const path = require('path')

const { bootProfile } = require('./bootProfile.cjs')

const UPGRADE = 'pear://upgradelink'
const APPIMAGE = '/home/u/Apps/Lockwright.AppImage'
const base = {
  productName: 'Lockwright',
  appId: 'works.dexterity.lockwright',
  isSandboxed: false,
  isPackaged: true,
  upgrade: UPGRADE,
  appImagePath: APPIMAGE
}

describe('bootProfile', () => {
  it('unset, keeps every value the installed app used', () => {
    expect(bootProfile({ ...base, env: {} })).toEqual({
      refuse: null,
      profile: null,
      userDataDirName: 'Lockwright',
      wmClass: 'Lockwright',
      appUserModelId: 'works.dexterity.lockwright',
      singleInstance: true,
      tracing: false,
      upgrade: UPGRADE,
      appImagePath: APPIMAGE
    })
  })

  it('unset, keeps the dev lock, trace and upgrade switches', () => {
    const dev = { ...base, isPackaged: false }
    expect(bootProfile({ ...dev, env: {} }).singleInstance).toBe(false)
    expect(
      bootProfile({ ...dev, env: { LOCKWRIGHT_SINGLE_INSTANCE: '1' } })
        .singleInstance
    ).toBe(true)
    expect(
      bootProfile({ ...base, env: { LOCKWRIGHT_TRACE: '1' } }).tracing
    ).toBe(true)
    for (const value of ['1', 'true']) {
      expect(
        bootProfile({ ...base, env: { PEARPASS_DISABLE_UPGRADE: value } })
          .upgrade
      ).toBeNull()
    }
  })

  it('unset under flatpak or snap still starts', () => {
    expect(bootProfile({ ...base, isSandboxed: true, env: {} }).refuse).toBe(
      null
    )
  })

  it('under a profile separates everything and never updates', () => {
    expect(
      bootProfile({
        ...base,
        isPackaged: false,
        env: { LOCKWRIGHT_PROFILE: 'test1' }
      })
    ).toEqual({
      refuse: null,
      profile: 'test1',
      userDataDirName: 'Lockwright-profile-test1',
      wmClass: 'Lockwright-profile-test1',
      appUserModelId: 'works.dexterity.lockwright.profile_test1',
      singleInstance: true,
      tracing: true,
      upgrade: null,
      appImagePath: undefined
    })
  })

  it('refuses a bad name', () => {
    const boot = bootProfile({ ...base, env: { LOCKWRIGHT_PROFILE: 'Test-1' } })
    expect(boot).toEqual({
      refuse: expect.stringMatching(/LOCKWRIGHT_PROFILE/)
    })
  })

  it('refuses a profile under flatpak or snap', () => {
    const boot = bootProfile({
      ...base,
      isSandboxed: true,
      env: { LOCKWRIGHT_PROFILE: 'test1' }
    })
    expect(boot).toEqual({ refuse: expect.stringMatching(/flatpak or snap/) })
  })
})

describe('desktop main process wiring', () => {
  const main = fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8')

  it('decides and refuses before userData is first set', () => {
    const bootAt = main.indexOf('const boot = bootProfile({')
    const refuseAt = main.indexOf('if (boot.refuse) {')
    const firstSetPathAt = main.indexOf('app.setPath(')
    const userDataAt = main.indexOf(
      "app.setPath('userData', path.join(app.getPath('appData'), boot.userDataDirName))"
    )
    expect(bootAt).toBeGreaterThan(-1)
    expect(bootAt).toBeLessThan(refuseAt)
    // The only earlier setPath is the refusal's temp folder, inside the block.
    expect(refuseAt).toBeLessThan(firstSetPathAt)
    expect(userDataAt).toBeGreaterThan(refuseAt)
    expect(main.slice(refuseAt, userDataAt)).toMatch(
      /fs\.rmSync\(refusedDir, \{ recursive: true, force: true \}\)\s+app\.exit\(1\)/
    )
    expect(main.slice(refuseAt, userDataAt)).toMatch(/\n  return\n\}/)
  })

  it('passes the profile to the wrapper refresh', () => {
    const call = main.slice(
      main.indexOf('refreshNativeHostWrapperIfPresent({'),
      main.indexOf('if (result.refreshed)')
    )
    expect(call).toMatch(/\bprofile\n/)
  })

  it('uses the boot values for the window identity, OTA and desktop entry', () => {
    expect(main).toContain('app.setAppUserModelId(boot.appUserModelId)')
    expect(main).toContain("appendSwitch('class', boot.wmClass)")
    expect(main).toContain('const wantsSingleInstance = boot.singleInstance')
    expect(main).toContain('const upgrade = boot.upgrade')
    expect(main).toContain('appImagePath: boot.appImagePath')
  })
})
