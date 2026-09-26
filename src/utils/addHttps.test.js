import { addHttps } from './addHttps'

describe('addHttps', () => {
  test('should return the URL unchanged if it already starts with http://', () => {
    const url = 'http://example.com'
    expect(addHttps(url)).toBe(url)
  })

  test('should return the URL unchanged if it already starts with https://', () => {
    const url = 'https://example.com'
    expect(addHttps(url)).toBe(url)
  })

  test('should prepend https:// to the URL if it does not start with http:// or https://', () => {
    const url = 'example.com'
    expect(addHttps(url)).toBe('https://example.com')
  })

  test('should handle URLs with subdomains correctly', () => {
    const url = 'www.example.com'
    expect(addHttps(url)).toBe('https://www.example.com')
  })

  test('should handle URLs with paths correctly', () => {
    const url = 'example.com/path'
    expect(addHttps(url)).toBe('https://example.com/path')
  })

  test('keeps androidapp URIs instead of prefixing https', () => {
    expect(addHttps('androidapp://com.twitter.android')).toBe(
      'androidapp://com.twitter.android'
    )
  })

  test('unwraps an https prefix glued onto an androidapp URI', () => {
    expect(addHttps('https://androidapp://com.twitter.android')).toBe(
      'androidapp://com.twitter.android'
    )
  })
})

describe('addHttps case handling', () => {
  test('lowercases the scheme and host but keeps the path as typed', () => {
    expect(addHttps('HTTPS://Example.COM/Reset/Token?Key=AbC#Frag')).toBe(
      'https://example.com/Reset/Token?Key=AbC#Frag'
    )
  })

  test('lowercases the host when prefixing https', () => {
    expect(addHttps('Example.COM/CaseSensitive')).toBe(
      'https://example.com/CaseSensitive'
    )
  })

  test('keeps userinfo as typed', () => {
    expect(addHttps('https://User:PassWord@Example.com/Path')).toBe(
      'https://User:PassWord@example.com/Path'
    )
  })
})
