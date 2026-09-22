/**
 * Pear runtime config for P2P OTA updates.
 */
const fs = require('fs')
const path = require('path')

const { formatDisplayVersion, readGitSha6 } = require('./formatDisplayVersion.cjs')
const pkg = require('../package.json')

function readDesignVersion() {
  try {
    const flagsPath = path.join(
      __dirname,
      '..',
      'node_modules',
      'lockwright-lib-constants',
      'src',
      'constants',
      'flags.js'
    )
    const content = fs.readFileSync(flagsPath, 'utf8')
    const match = content.match(/DESKTOP_DESIGN_VERSION\s*=\s*(\d+)/)
    return match ? Number(match[1]) : 1
  } catch {
    return 1
  }
}
module.exports = {
  upgrade: pkg.upgrade || null,
  version: formatDisplayVersion(pkg.version ?? '', readGitSha6()),
  productName: pkg.productName ?? pkg.name ?? 'Lockwright',
  legacyChannelLink: pkg.legacyChannelLink || null,
  designVersion: readDesignVersion()
}
