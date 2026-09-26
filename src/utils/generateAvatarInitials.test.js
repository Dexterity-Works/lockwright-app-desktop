import { generateAvatarInitials } from './generateAvatarInitials'

describe('generateAvatarInitials', () => {
  it('takes two letters of a single name, one from each of two names', () => {
    expect(generateAvatarInitials('john')).toBe('JO')
    expect(generateAvatarInitials('John Peter Doe')).toBe('JP')
  })

  it('returns an empty string for non-strings and empty input', () => {
    expect(generateAvatarInitials(undefined)).toBe('')
    expect(generateAvatarInitials('')).toBe('')
  })
})
