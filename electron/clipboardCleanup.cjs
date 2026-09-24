const { spawn } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const DEFAULT_CLIPBOARD_CLEAR_DELAY_MS = 30000
const CLIPBOARD_CLEANUP_STATE_FILE = 'pearpass-clipboard-cleanup-current.token'

function getClipboardCleanupStatePath(app) {
  return path.join(app.getPath('temp'), CLIPBOARD_CLEANUP_STATE_FILE)
}

function removeFileIfExists(filePath) {
  try {
    fs.unlinkSync(filePath)
  } catch (err) {
    if (err && err.code !== 'ENOENT') throw err
  }
}

function removeClipboardCleanupTokenIfCurrent(statePath, token) {
  try {
    const currentToken = fs.readFileSync(statePath, 'utf8')
    if (currentToken === token) {
      removeFileIfExists(statePath)
    }
  } catch (err) {
    if (err && err.code !== 'ENOENT') throw err
  }
}

// The secret goes to the helper over its stdin pipe. A temp file or argv
// would expose it to other processes watching the temp dir or /proc.
function pipeSecretToDetachedChild(command, args, options, text, logger) {
  const child = spawn(command, args, {
    ...options,
    detached: true,
    stdio: ['pipe', 'inherit', 'inherit'],
    windowsHide: true
  })

  const warn = (err) =>
    logger.warn(
      'MAIN',
      'Clipboard cleanup helper failed:',
      err && err.message ? err.message : err
    )
  child.on('error', warn)
  child.stdin.on('error', warn)
  child.stdin.end(text, 'utf8')
  child.unref()
}

function spawnDetachedClipboardHelper(text, token, statePath, delayMs, logger) {
  const helperPath = path.join(__dirname, 'clipboardCleanupHelper.cjs')
  if (!fs.existsSync(helperPath)) {
    throw new Error(`Clipboard cleanup helper not found: ${helperPath}`)
  }

  pipeSecretToDetachedChild(
    process.execPath,
    [helperPath, token, statePath, String(delayMs)],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } },
    text,
    logger
  )
}

function spawnDetachedWindowsClipboardHelper(
  text,
  token,
  statePath,
  delayMs,
  logger
) {
  const scriptPath = path.join(__dirname, 'clipboardCleanup.windows.ps1')
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Windows clipboard cleanup script not found: ${scriptPath}`)
  }

  // Spawned directly, not via `cmd /c start`: start gives the child a fresh
  // console and drops the stdin pipe.
  pipeSecretToDetachedChild(
    'powershell.exe',
    [
      '-NoProfile',
      '-WindowStyle',
      'Hidden',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      '-StatePath',
      statePath,
      '-Token',
      token,
      '-DelayMs',
      String(delayMs)
    ],
    {},
    text,
    logger
  )
}

function scheduleClipboardCleanup({
  app,
  clipboard,
  logger,
  isWindows,
  text,
  delayMs
}) {
  const finalDelayMs =
    Number.isFinite(delayMs) && delayMs > 0
      ? delayMs
      : DEFAULT_CLIPBOARD_CLEAR_DELAY_MS
  const textToMatch = typeof text === 'string' ? text : clipboard.readText()

  if (typeof textToMatch !== 'string' || textToMatch.length === 0) {
    return false
  }

  const token = crypto.randomUUID()
  const statePath = getClipboardCleanupStatePath(app)

  try {
    fs.writeFileSync(statePath, token, { encoding: 'utf8', mode: 0o600 })

    if (isWindows) {
      spawnDetachedWindowsClipboardHelper(
        textToMatch,
        token,
        statePath,
        finalDelayMs,
        logger
      )
    } else {
      spawnDetachedClipboardHelper(
        textToMatch,
        token,
        statePath,
        finalDelayMs,
        logger
      )
    }

    return true
  } catch (err) {
    try {
      removeClipboardCleanupTokenIfCurrent(statePath, token)
    } catch (_) {}

    logger.warn(
      'MAIN',
      'Failed to schedule detached clipboard cleanup:',
      err && err.message ? err.message : err
    )
    return false
  }
}

module.exports = {
  scheduleClipboardCleanup
}
