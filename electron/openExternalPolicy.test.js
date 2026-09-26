/* eslint-env jest */

const {
  isAllowedExternalUrl,
  openExternalIfAllowed
} = require('./openExternalPolicy.cjs')

describe('openExternalPolicy', () => {
  it.each([
    'https://example.com/path?q=1',
    'http://example.com',
    'mailto:someone@example.com'
  ])('allows %s', (url) => {
    expect(isAllowedExternalUrl(url)).toBe(true)
  })

  it.each([
    'file:///etc/passwd',
    'javascript:alert(1)',
    'smb://server/share',
    'ftp://example.com',
    'pear://dbkezmhetxwo95ab1kcojfraw1eryzf7kex5cahykf6b9c3amd6o',
    'not a url',
    '',
    undefined,
    null,
    42
  ])('rejects %p', (url) => {
    expect(isAllowedExternalUrl(url)).toBe(false)
  })

  it('opens an allowed URL through shell.openExternal', async () => {
    const shell = { openExternal: jest.fn(() => Promise.resolve()) }
    const logger = { warn: jest.fn() }

    await expect(
      openExternalIfAllowed({ shell, logger }, 'https://example.com')
    ).resolves.toBe(true)
    expect(shell.openExternal).toHaveBeenCalledWith('https://example.com')
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('refuses a rejected URL, never calls the shell, and warns', async () => {
    const shell = { openExternal: jest.fn(() => Promise.resolve()) }
    const logger = { warn: jest.fn() }

    await expect(
      openExternalIfAllowed({ shell, logger }, 'file:///etc/passwd')
    ).resolves.toBe(false)
    expect(shell.openExternal).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      'MAIN',
      expect.stringContaining('Refused'),
      'file:///etc/passwd'
    )
  })
})
