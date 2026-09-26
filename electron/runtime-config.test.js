/* eslint-env jest */

describe('runtime-config version', () => {
  const original = process.env.LOCKWRIGHT_GIT_SHA

  afterEach(() => {
    if (original === undefined) {
      delete process.env.LOCKWRIGHT_GIT_SHA
    } else {
      process.env.LOCKWRIGHT_GIT_SHA = original
    }
    jest.resetModules()
  })

  it('is package version plus sha6 from LOCKWRIGHT_GIT_SHA', () => {
    process.env.LOCKWRIGHT_GIT_SHA = 'cafeba1234'
    jest.resetModules()
    const cfg = require('./runtime-config.cjs')
    const { version } = require('../package.json')
    expect(cfg.version).toBe(`${version}-cafeba`)
  })
})
