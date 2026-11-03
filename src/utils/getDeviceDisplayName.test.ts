import { getDeviceDisplayName } from './getDeviceDisplayName'

describe('getDeviceDisplayName', () => {
  const t = (value: string) => `translated:${value}`

  it('translates Android device names case insensitively', () => {
    expect(getDeviceDisplayName('Android Pixel', t)).toBe('translated:Android')
  })
})
