const { exec } = require('child_process')
const fsp = require('fs/promises')

const { profileHostArg, readProfile } = require('./profile.cjs')

const FLATPAK_APP_ID = 'works.dexterity.lockwright'
const FLATPAK_NATIVE_HOST_COMMAND = 'lockwright-native-host'
// Packaged host argv is `.../native-messaging-bridge.bundle.cjs`, not the
// unbundled package name. pkill -f must match that argv or AppImage remounts
// leave a zombie host on the previous /tmp/.mount_* path.
const NATIVE_HOST_PROCESS_PATTERN = 'native-messaging-bridge.bundle'

// Wrappers emit diagnostics to stderr only: Chrome reads stdout as framed
// native-messaging payloads, so any plain text there drops the port with
// "Native host has exited".
//
// A test profile bakes its name into the wrapper: the browser spawns the
// host with its own environment, not the desktop's. The argument is what
// nativeHostKillCommand matches. Flatpak and snap refuse profiles at startup.
function buildWrapperContent({
  platform,
  isFlatpak,
  electronExecPath,
  bridgeScriptPath,
  profile = null
}) {
  if (platform === 'linux' && isFlatpak) {
    // Chrome runs outside the flatpak sandbox; the wrapper re-enters via
    // `flatpak run` so the in-sandbox /app/* paths resolve correctly.
    return `#!/bin/bash
# Lockwright Native Messaging Host (flatpak)
# Chrome launches this on the host; re-enter the sandbox to run the bridge.
set -u

FLATPAK_BIN="$(command -v flatpak 2>/dev/null || true)"
if [ -z "\${FLATPAK_BIN}" ]; then
  for candidate in /usr/bin/flatpak /usr/local/bin/flatpak /var/lib/flatpak/exports/bin/flatpak; do
    if [ -x "\${candidate}" ]; then
      FLATPAK_BIN="\${candidate}"
      break
    fi
  done
fi
if [ -z "\${FLATPAK_BIN}" ]; then
  echo "lockwright-native-host: flatpak binary not found on PATH" >&2
  exit 127
fi

exec "\${FLATPAK_BIN}" run --command=${FLATPAK_NATIVE_HOST_COMMAND} ${FLATPAK_APP_ID} "$@"
`
  }

  const command = `"${electronExecPath}" "${bridgeScriptPath}"`
  const profileArg = profile ? ` ${profileHostArg(profile)}` : ''

  if (platform === 'darwin' || platform === 'linux') {
    const profileEnv = profile ? `export LOCKWRIGHT_PROFILE=${profile}\n` : ''
    return `#!/bin/bash
# Lockwright Native Messaging Host
# Runs the native messaging bridge via Electron's embedded Node.js

export ELECTRON_RUN_AS_NODE=1
${profileEnv}exec ${command}${profileArg}
`
  }

  if (platform === 'win32') {
    const profileEnv = profile ? `set LOCKWRIGHT_PROFILE=${profile}\n` : ''
    return `@echo off
REM Lockwright Native Messaging Host
REM Runs the native messaging bridge via Electron's embedded Node.js

set ELECTRON_RUN_AS_NODE=1
${profileEnv}${command}${profileArg}
`
  }

  throw new Error(`Unsupported platform: ${platform}`)
}

// Atomic so Chrome can't read a half-written wrapper while spawning the host.
async function writeWrapperAtomic(executablePath, content, platform) {
  const tmpPath = `${executablePath}.tmp-${process.pid}`
  await fsp.writeFile(tmpPath, content, 'utf8')
  if (platform !== 'win32') {
    await fsp.chmod(tmpPath, 0o755)
  }
  await fsp.rename(tmpPath, executablePath)
}

/**
 * Shell command that kills native hosts. Unset profile: every Lockwright
 * bridge, as before. Under a profile: only bridges whose command line ends
 * in that profile's argument, so the installed app's hosts and other
 * profiles' (test1 vs test10) survive.
 * @param {string} platform
 * @param {string | null} [profile]
 */
function nativeHostKillCommand(platform, profile = null) {
  if (platform === 'win32') {
    const like = profile
      ? `*${NATIVE_HOST_PROCESS_PATTERN}* ${profileHostArg(profile)}`
      : `*${NATIVE_HOST_PROCESS_PATTERN}*`
    return `powershell -NoProfile -Command "Get-WmiObject Win32_Process | Where-Object {$_.CommandLine -like '${like}'} | ForEach-Object { taskkill /PID $_.ProcessId /F }"`
  }
  const pattern = profile
    ? `${NATIVE_HOST_PROCESS_PATTERN}.cjs ${profileHostArg(profile)}$`
    : NATIVE_HOST_PROCESS_PATTERN
  return `pkill -f "${pattern}"`
}

// Reads the profile itself, as nativeMessagingSetup does; main validated it.
function killNativeHostProcesses(profile = readProfile()) {
  return new Promise((resolve) => {
    exec(nativeHostKillCommand(process.platform, profile), () => resolve())
  })
}

async function refreshNativeHostWrapperIfPresent({
  executablePath,
  electronExecPath,
  bridgeScriptPath,
  platform,
  isFlatpak,
  profile = null
}) {
  try {
    await fsp.access(executablePath)
  } catch {
    return { refreshed: false, reason: 'not-present' }
  }

  const content = buildWrapperContent({
    platform,
    isFlatpak,
    electronExecPath,
    bridgeScriptPath,
    profile
  })
  await writeWrapperAtomic(executablePath, content, platform)
  return { refreshed: true }
}

module.exports = {
  NATIVE_HOST_PROCESS_PATTERN,
  buildWrapperContent,
  nativeHostKillCommand,
  writeWrapperAtomic,
  refreshNativeHostWrapperIfPresent,
  killNativeHostProcesses
}
