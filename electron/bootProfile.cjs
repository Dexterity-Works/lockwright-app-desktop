/**
 * Boot decisions that depend on LOCKWRIGHT_PROFILE, taken once at the top of
 * main.cjs before userData is set. Unset, every value is what the installed
 * app used before profiles existed.
 */
const { profileAppId, profileDirName, readProfile } = require('./profile.cjs')

// Flatpak and snap have fixed data paths and a fixed native host wrapper,
// shared with the installed app, so a profile there could not be separate.
const SANDBOX_REFUSAL =
  'LOCKWRIGHT_PROFILE is not supported in the flatpak or snap build: their data folder and native host are fixed and shared with the installed app. Run a test profile from a source checkout or an AppImage.'

/**
 * @param {object} opts
 * @param {Record<string, string | undefined>} [opts.env]
 * @param {string} opts.productName
 * @param {string} opts.appId
 * @param {boolean} [opts.isSandboxed] flatpak or snap
 * @param {boolean} [opts.isPackaged]
 * @param {string | null} [opts.upgrade] the configured OTA link
 * @param {string | undefined} [opts.appImagePath] APPIMAGE from the runtime
 * @returns {{ refuse: string } | {
 *   refuse: null,
 *   profile: string | null,
 *   userDataDirName: string,
 *   wmClass: string,
 *   appUserModelId: string,
 *   singleInstance: boolean,
 *   tracing: boolean,
 *   upgrade: string | null,
 *   appImagePath: string | undefined
 * }}
 *   `refuse` is the message to show when the app must not start.
 */
function bootProfile({
  env = process.env,
  productName,
  appId,
  isSandboxed = false,
  isPackaged = false,
  upgrade = null,
  appImagePath
}) {
  let profile
  try {
    profile = readProfile(env)
  } catch (err) {
    return { refuse: err.message }
  }
  if (profile && isSandboxed) return { refuse: SANDBOX_REFUSAL }

  const userDataDirName = profile
    ? profileDirName(productName, profile)
    : productName
  const upgradeDisabled =
    env.PEARPASS_DISABLE_UPGRADE === '1' ||
    env.PEARPASS_DISABLE_UPGRADE === 'true'

  return {
    refuse: null,
    profile,
    userDataDirName,
    wmClass: userDataDirName,
    appUserModelId: profile ? profileAppId(appId, profile) : appId,
    // A test profile always takes the single-instance lock, so two
    // instances of one profile never share a store.
    singleInstance:
      isPackaged || Boolean(profile) || env.LOCKWRIGHT_SINGLE_INSTANCE === '1',
    tracing: Boolean(profile) || env.LOCKWRIGHT_TRACE === '1',
    // A test profile never takes an OTA update: it runs the code it was
    // started with, and pear-runtime stays out of its folder.
    upgrade: profile || upgradeDisabled ? null : upgrade,
    // A test profile never rewrites the installed app's desktop entry.
    appImagePath: profile ? undefined : appImagePath
  }
}

module.exports = { bootProfile }
