/* eslint-env jest */

jest.mock('os')

const os = require('os')

const { getDeviceName } = require('./getDeviceName.cjs')

describe('getDeviceName', () => {
  it('should return the device name in the format "<hostname> <platform> <release>"', () => {
    os.hostname.mockReturnValue('my-host')
    os.platform.mockReturnValue('darwin')
    os.release.mockReturnValue('22.5.0')

    expect(getDeviceName()).toBe('my-host darwin 22.5.0')
  })

  it('should handle empty strings from os methods', () => {
    os.hostname.mockReturnValue('')
    os.platform.mockReturnValue('')
    os.release.mockReturnValue('')

    expect(getDeviceName()).toBe('  ')
  })
})
