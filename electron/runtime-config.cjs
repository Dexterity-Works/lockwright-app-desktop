/**
 * Pear runtime config for P2P OTA updates.
 */
const { formatDisplayVersion, readGitSha6 } = require('./formatDisplayVersion.cjs')
const pkg = require('../package.json')

module.exports = {
  upgrade: pkg.upgrade || null,
  version: formatDisplayVersion(pkg.version ?? '', readGitSha6()),
  productName: pkg.productName ?? pkg.name ?? 'Lockwright',
  legacyChannelLink: pkg.legacyChannelLink || null,
  designVersion: 2
}
