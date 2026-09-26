/* eslint-env jest */

const { assertVaultMethod, VAULT_METHODS } = require('./vaultMethods.cjs')

describe('vault method allowlist', () => {
  it('lets a listed vault client method through', () => {
    expect(() => assertVaultMethod('vaultsList')).not.toThrow()
    expect(VAULT_METHODS).toContain('vaultsList')
  })

  it.each(['emit', 'removeAllListeners', 'constructor', '__proto__', ''])(
    'refuses %p, which is not a vault client method',
    (method) => {
      expect(() => assertVaultMethod(method)).toThrow(
        `Unknown vault method: ${method}`
      )
    }
  )
})
