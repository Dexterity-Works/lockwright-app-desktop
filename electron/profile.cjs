/**
 * Test profiles: LOCKWRIGHT_PROFILE=<name> runs a desktop with its own data
 * folder, native messaging socket, native host and window identity, so a test
 * build never reads, copies, migrates or kills anything of the installed app.
 * Unset, none of this applies.
 *
 * Shared by the main process, the native messaging server bundle and the
 * bridge bundle. It reads only the environment it is given.
 */
const PROFILE_ENV = 'LOCKWRIGHT_PROFILE'
const PROFILE_NAME_PATTERN = /^[a-z0-9_]{1,24}$/

// The bridge's wrapper passes this so a profile desktop can kill its own
// bridges by command line without touching the installed app's.
const PROFILE_HOST_ARG_PREFIX = '--lockwright-profile='

// The profile build of the extension. The shipped extension IDs never reach
// a profile manifest.
const PROFILE_CHROMIUM_EXTENSION_ID = 'degfjkbgcfkbfhhhecbdllgcokjgcdfb'
const PROFILE_FIREFOX_EXTENSION_ID = 'lockwright-profile@dexterity.works'

function validProfileName(value, source) {
  if (PROFILE_NAME_PATTERN.test(value)) return value
  throw new Error(
    `${source} must be 1 to 24 characters from a-z, 0-9 and _ (got ${JSON.stringify(value)}). Lockwright will not start rather than open the real profile.`
  )
}

/**
 * The desktop's profile name from the environment, or null when the
 * variable is unset. Any other value throws: a typo must never fall back to
 * the real profile.
 * @param {Record<string, string | undefined>} [env]
 * @returns {string | null}
 */
function readProfile(env = process.env) {
  const value = env[PROFILE_ENV]
  if (value === undefined) return null
  return validProfileName(value, PROFILE_ENV)
}

/**
 * The bridge's profile name, from the argument only the profile wrapper
 * passes. The bridge ignores LOCKWRIGHT_PROFILE: a browser started from a
 * shell that exported it would otherwise point the shipped host at a test
 * socket. An invalid value throws rather than use the real socket.
 * @param {string[]} [argv]
 * @returns {string | null}
 */
function readProfileArg(argv = process.argv) {
  const arg = argv.find((a) => a.startsWith(PROFILE_HOST_ARG_PREFIX))
  if (arg === undefined) return null
  return validProfileName(
    arg.slice(PROFILE_HOST_ARG_PREFIX.length),
    PROFILE_HOST_ARG_PREFIX.slice(0, -1)
  )
}

/**
 * Folder name for a profile's userData, also its Linux WM class.
 * @param {string} productName
 * @param {string} profile
 */
function profileDirName(productName, profile) {
  return `${productName}-profile-${profile}`
}

/**
 * Reverse-DNS id for a profile: the native host name and the Windows
 * AppUserModelId.
 * @param {string} appId
 * @param {string} profile
 */
function profileAppId(appId, profile) {
  return `${appId}.profile_${profile}`
}

/**
 * @param {string} title
 * @param {string} profile
 */
function profileWindowTitle(title, profile) {
  return `${title} — profile ${profile}`
}

/**
 * Path segments of the directory holding the native messaging socket (or
 * Windows pointer file) and the bridge's logs. Segments, so callers join
 * them with their file name exactly as they did before profiles.
 * @param {string} home
 * @param {string} socketDirName
 * @param {string | null} profile
 * @returns {string[]}
 */
function ipcSocketDirSegments(home, socketDirName, profile) {
  if (!profile) return [home, socketDirName]
  return [home, socketDirName, 'profiles', profile]
}

/**
 * @param {string} profile
 */
function profileHostArg(profile) {
  return `${PROFILE_HOST_ARG_PREFIX}${profile}`
}

module.exports = {
  PROFILE_CHROMIUM_EXTENSION_ID,
  PROFILE_ENV,
  PROFILE_FIREFOX_EXTENSION_ID,
  PROFILE_NAME_PATTERN,
  ipcSocketDirSegments,
  profileAppId,
  profileDirName,
  profileHostArg,
  profileWindowTitle,
  readProfile,
  readProfileArg
}
