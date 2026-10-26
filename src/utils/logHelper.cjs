/* eslint-disable no-console */
/**
 * Main-process logging utilities.
 *
 * Exports:
 * - getLogPaths(storageDir) — single source of truth for the log file layout
 *   under <storageDir>/logs/.
 * - removeLogFiles(storageDir) — delete main.log and core.log.
 * - createWorkletLogConfigurer(deps) — factory returning a function that
 *   turns on the vault worklet's file logger via setLogOptions.
 * - createMainProcessLogger(options) — factory for the main-process logger
 *   that writes to <userData>/logs/main.log and console.
 *
 * File output for the main-process logger is opt-in: callers call setLogPath()
 * to enable and clearLogPath() to disable mid-session. The caller
 * (electron/main.cjs) gates writes on the build flavor, the --enable-logging
 * flag, and the persisted user toggle.
 * Console output is gated on debugMode so packaged builds stay quiet by default.
 */
const fs = require('fs')
const path = require('path')
const { inspect } = require('util')

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const MAX_LOG_FILE_SIZE = 100 * 1024 * 1024
const TRUNCATION_KEEP_RATIO = 0.5
const TRUNCATION_CHECK_INTERVAL = 100

function getLogPaths(storageDir) {
  const logsDir = path.join(storageDir, 'logs')
  return {
    logsDir,
    corePath: path.join(logsDir, 'core.log'),
    mainPath: path.join(logsDir, 'main.log')
  }
}

function removeLogFiles(storageDir) {
  const { corePath, mainPath } = getLogPaths(storageDir)
  for (const p of [corePath, mainPath]) {
    try {
      fs.unlinkSync(p)
    } catch {
      // ignore — file likely doesn't exist
    }
  }
}

function createWorkletLogConfigurer({
  getStorageDir,
  getVaultClient,
  isPackaged,
  workletLogLevel,
  logger
}) {
  // A worklet that is still connecting hands its client in directly.
  return async function enableWorkletFileLogging(
    vaultClient = getVaultClient()
  ) {
    if (!vaultClient) return
    const { logsDir, corePath } = getLogPaths(getStorageDir())
    try {
      fs.mkdirSync(logsDir, { recursive: true })
      await vaultClient.setLogOptions({
        logFile: corePath,
        logLevel: workletLogLevel,
        dev: !isPackaged
      })
    } catch (err) {
      logger.warn(
        'MAIN',
        'setLogOptions failed; worklet logs will use defaults',
        err
      )
    }
  }
}

function createMainProcessLogger(options = {}) {
  const { app, debugMode = false, logLevel = 'info' } = options

  const isPackaged = !!(app && app.isPackaged)
  const levelThreshold = LEVELS[logLevel] ?? LEVELS.info
  const isConsoleLogEnabled = debugMode || !isPackaged

  let logFilePath = null
  let writeCount = 0

  function serialize(args) {
    return args
      .map((arg) => {
        if (arg instanceof Error) {
          return `${arg.message}${arg.stack ? '\n' + arg.stack : ''}`
        }
        if (typeof arg === 'object' && arg !== null) {
          return inspect(arg, { depth: 4, breakLength: 120 })
        }
        return String(arg)
      })
      .join(' ')
  }

  function rotateIfNeeded() {
    if (!logFilePath) return
    try {
      const { size } = fs.statSync(logFilePath)
      if (size < MAX_LOG_FILE_SIZE) return
      const text = fs.readFileSync(logFilePath, 'utf8')
      const cutPoint = Math.floor(text.length * (1 - TRUNCATION_KEEP_RATIO))
      const newlineIndex = text.indexOf('\n', cutPoint)
      if (newlineIndex === -1) return
      const tmpPath = logFilePath + '.tmp'
      fs.writeFileSync(tmpPath, text.slice(newlineIndex + 1))
      fs.renameSync(tmpPath, logFilePath)
    } catch {
      // best-effort rotation — never crash main process on log issues
    }
  }

  function writeToFile(level, ...args) {
    if (!logFilePath) return
    try {
      const line = `${new Date().toISOString()} [${level}] ${serialize(args)}\n`
      fs.appendFileSync(logFilePath, line)
      writeCount++
      if (writeCount >= TRUNCATION_CHECK_INTERVAL) {
        writeCount = 0
        rotateIfNeeded()
      }
    } catch (err) {
      console.error('[MAIN] Failed to write to log file:', err)
    }
  }

  return {
    setLogPath(userDataDir) {
      const dir = path.join(userDataDir, 'logs')
      try {
        fs.mkdirSync(dir, { recursive: true })
        logFilePath = path.join(dir, 'main.log')
      } catch (err) {
        if (isConsoleLogEnabled)
          console.error('[MAIN] Failed to create logs dir:', err)
        return
      }
      writeToFile('INFO', 'Main process log file:', logFilePath)
      if (isConsoleLogEnabled) console.info('[MAIN] Log file:', logFilePath)
    },

    clearLogPath() {
      logFilePath = null
    },

    getLogFilePath() {
      return logFilePath
    },

    log(...args) {
      if (LEVELS.info < levelThreshold) return
      if (isConsoleLogEnabled) console.info('[MAIN]', ...args)
      writeToFile('LOG', ...args)
    },
    info(...args) {
      if (LEVELS.info < levelThreshold) return
      if (isConsoleLogEnabled) console.info('[MAIN][INFO]', ...args)
      writeToFile('INFO', ...args)
    },
    debug(...args) {
      if (LEVELS.debug < levelThreshold) return
      if (isConsoleLogEnabled) console.info('[MAIN][DEBUG]', ...args)
      writeToFile('DEBUG', ...args)
    },
    warn(...args) {
      if (LEVELS.warn < levelThreshold) return
      if (isConsoleLogEnabled) console.warn('[MAIN][WARN]', ...args)
      writeToFile('WARN', ...args)
    },
    error(...args) {
      if (LEVELS.error < levelThreshold) return
      if (isConsoleLogEnabled) console.error('[MAIN][ERROR]', ...args)
      writeToFile('ERROR', ...args)
    }
  }
}

/**
 * Bootstrap helper: collects nightly/--enable-logging detection, picks the
 * worklet log level, builds the main-process logger, and wires the worklet
 * log configurer. main.cjs holds onto the returned values instead of
 * recreating this constellation by hand.
 *
 * Mutable runtime state (`loggingActive`) stays with the caller — only the
 * stable boot wiring lives here.
 */
function setupLogging({ app, pkg, debugMode, getStorageDir, getVaultClient }) {
  const isNightlyBuild = pkg.productName === 'Lockwright-nightly'
  const loggingForced =
    process.argv.includes('--enable-logging') || isNightlyBuild
  const workletLogLevel = 'debug'
  const logger = createMainProcessLogger({
    app,
    debugMode,
    logLevel: workletLogLevel
  })
  const enableWorkletFileLogging = createWorkletLogConfigurer({
    getStorageDir,
    getVaultClient,
    isPackaged: app.isPackaged,
    workletLogLevel,
    logger
  })
  return { logger, loggingForced, enableWorkletFileLogging }
}

module.exports = {
  getLogPaths,
  removeLogFiles,
  createWorkletLogConfigurer,
  createMainProcessLogger,
  setupLogging
}
