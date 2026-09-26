/**
 * Persistence for main-process device preferences.
 *
 * Stored as JSON at `<storageDir>/device-preferences.json`. Read at
 * main-process startup (sync) and rewritten when a setting changes.
 * Missing/malformed file → everything falls back to DEFAULTS. Adding a new
 * preference means adding a key to DEFAULTS and reading/writing it through
 * this module.
 */
const fs = require('fs')
const path = require('path')

const FILE_NAME = 'device-preferences.json'

const DEFAULTS = {
  loggingEnabled: false,
  // Extension public keys whose pairing the user confirmed. Lets the
  // extension ask "am I paired?" before the vault is unlocked.
  nmClientPublicKeys: []
}

const stringList = (value) =>
  Array.isArray(value) ? value.filter((key) => typeof key === 'string') : []

function read(storageDir) {
  try {
    const raw = fs.readFileSync(path.join(storageDir, FILE_NAME), 'utf8')
    const parsed = JSON.parse(raw)
    return {
      loggingEnabled: parsed.loggingEnabled === true,
      nmClientPublicKeys: stringList(parsed.nmClientPublicKeys)
    }
  } catch {
    return { ...DEFAULTS, nmClientPublicKeys: [] }
  }
}

function write(storageDir, partial) {
  fs.mkdirSync(storageDir, { recursive: true })
  const merged = { ...read(storageDir), ...partial }
  const out = {
    loggingEnabled: !!merged.loggingEnabled,
    nmClientPublicKeys: stringList(merged.nmClientPublicKeys)
  }
  fs.writeFileSync(
    path.join(storageDir, FILE_NAME),
    JSON.stringify(out) + '\n',
    'utf8'
  )
}

module.exports = { read, write }
