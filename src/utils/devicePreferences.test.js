/* eslint-env jest */

import fs from 'fs'
import os from 'os'
import path from 'path'

const { read, write } = require('./devicePreferences.cjs')

describe('devicePreferences', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'device-preferences-'))
  })
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns defaults when the file is missing', () => {
    expect(read(tmpDir)).toEqual({
      loggingEnabled: false,
      nmClientPublicKeys: []
    })
  })

  it('returns defaults on malformed JSON', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'device-preferences.json'),
      'not-json{',
      'utf8'
    )
    expect(read(tmpDir)).toEqual({
      loggingEnabled: false,
      nmClientPublicKeys: []
    })
  })

  it('writes then reads back loggingEnabled=true', () => {
    write(tmpDir, { loggingEnabled: true })
    expect(read(tmpDir)).toEqual({
      loggingEnabled: true,
      nmClientPublicKeys: []
    })
  })

  it('coerces truthy/falsy values to booleans', () => {
    write(tmpDir, { loggingEnabled: 'yes' })
    expect(read(tmpDir)).toEqual({
      loggingEnabled: true,
      nmClientPublicKeys: []
    })

    write(tmpDir, { loggingEnabled: 0 })
    expect(read(tmpDir)).toEqual({
      loggingEnabled: false,
      nmClientPublicKeys: []
    })
  })

  it('creates the storage directory if missing', () => {
    const nested = path.join(tmpDir, 'does', 'not', 'exist')
    write(nested, { loggingEnabled: true })
    expect(fs.existsSync(path.join(nested, 'device-preferences.json'))).toBe(
      true
    )
  })

  it('partial write preserves other keys', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'device-preferences.json'),
      JSON.stringify({ loggingEnabled: true }) + '\n',
      'utf8'
    )
    write(tmpDir, {})
    expect(read(tmpDir)).toEqual({
      loggingEnabled: true,
      nmClientPublicKeys: []
    })
  })

  it('keeps only string entries in nmClientPublicKeys and preserves loggingEnabled', () => {
    write(tmpDir, { loggingEnabled: true })
    write(tmpDir, { nmClientPublicKeys: ['a', 1, null, 'b'] })
    expect(read(tmpDir)).toEqual({
      loggingEnabled: true,
      nmClientPublicKeys: ['a', 'b']
    })
  })
})
