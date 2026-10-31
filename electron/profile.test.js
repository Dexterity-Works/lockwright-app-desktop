/* eslint-env jest */

const {
  ipcSocketDirSegments,
  profileAppId,
  profileDirName,
  profileWindowTitle,
  readProfile,
  readProfileArg
} = require('./profile.cjs')

describe('readProfile', () => {
  it('is null when LOCKWRIGHT_PROFILE is unset', () => {
    expect(readProfile({})).toBeNull()
  })

  it.each(['test1', 'a', 'epoch_rekey', 'x'.repeat(24), '0'])(
    'accepts %p',
    (name) => {
      expect(readProfile({ LOCKWRIGHT_PROFILE: name })).toBe(name)
    }
  )

  it.each([
    ['empty', ''],
    ['uppercase', 'Test1'],
    ['a dash', 'test-1'],
    ['a space', 'test 1'],
    ['a path', '../Lockwright'],
    ['a dot', 'test.1'],
    ['25 characters', 'x'.repeat(25)],
    ['a trailing newline', 'test1\n']
  ])('refuses %s rather than falling back to the real profile', (_, name) => {
    expect(() => readProfile({ LOCKWRIGHT_PROFILE: name })).toThrow(
      /LOCKWRIGHT_PROFILE must be 1 to 24 characters/
    )
  })

  it('reads process.env by default', () => {
    const previous = process.env.LOCKWRIGHT_PROFILE
    process.env.LOCKWRIGHT_PROFILE = 'test1'
    try {
      expect(readProfile()).toBe('test1')
    } finally {
      if (previous === undefined) delete process.env.LOCKWRIGHT_PROFILE
      else process.env.LOCKWRIGHT_PROFILE = previous
    }
  })
})

describe('profile names', () => {
  it('names the folder, host, window and socket dir after the profile', () => {
    expect(profileDirName('Lockwright', 'test1')).toBe(
      'Lockwright-profile-test1'
    )
    expect(profileAppId('works.dexterity.lockwright', 'test1')).toBe(
      'works.dexterity.lockwright.profile_test1'
    )
    expect(profileWindowTitle('Lockwright', 'test1')).toBe(
      'Lockwright — profile test1'
    )
    expect(ipcSocketDirSegments('/home/u', '.lockwright', 'test1')).toEqual([
      '/home/u',
      '.lockwright',
      'profiles',
      'test1'
    ])
  })

  it('keeps the shared socket dir when no profile is set', () => {
    expect(ipcSocketDirSegments('/home/u', '.lockwright', null)).toEqual([
      '/home/u',
      '.lockwright'
    ])
  })
})

describe('readProfileArg', () => {
  const host = ['/opt/electron', '/opt/native-messaging-bridge.bundle.cjs']

  it('is null without the argument', () => {
    expect(readProfileArg(host)).toBeNull()
  })

  it('reads the name the profile wrapper passes', () => {
    expect(readProfileArg([...host, '--lockwright-profile=test1'])).toBe(
      'test1'
    )
  })

  it.each(['', 'Test1', 'test-1', '../x', 'x'.repeat(25)])(
    'refuses %p',
    (name) => {
      expect(() =>
        readProfileArg([...host, `--lockwright-profile=${name}`])
      ).toThrow(/--lockwright-profile must be 1 to 24 characters/)
    }
  )
})
