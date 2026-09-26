/**
 * Only web and mail links may leave the app. A record's website field is
 * user- and sync-supplied, so anything else (file:, javascript:, smb:, ...)
 * handed to shell.openExternal would let vault data launch local handlers.
 */
const ALLOWED_PROTOCOLS = new Set(['https:', 'http:', 'mailto:'])

function isAllowedExternalUrl(url) {
  if (typeof url !== 'string') return false
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  return ALLOWED_PROTOCOLS.has(parsed.protocol)
}

async function openExternalIfAllowed({ shell, logger }, url) {
  if (!isAllowedExternalUrl(url)) {
    logger.warn('MAIN', 'Refused to open external URL:', url)
    return false
  }
  await shell.openExternal(url)
  return true
}

module.exports = {
  isAllowedExternalUrl,
  openExternalIfAllowed
}
