/**
 * Renderer logger. Console output stays off (debugMode is false in every
 * build); error() also forwards to the main process so renderer errors land
 * in the Diagnostics log when the user has logging on.
 *
 * In the main-process bundle a target logger is bound instead (setTarget),
 * and every level goes straight to it.
 */
class Logger {
  constructor({ debugMode = false } = {}) {
    this.debugMode = debugMode
    /** @type {{ log: Function, info: Function, debug: Function, warn: Function, error: Function } | null} */
    this.target = null
  }

  /**
   * @param {{ log: Function, info: Function, debug: Function, warn: Function, error: Function } | null} target
   */
  setTarget(target) {
    this.target = target
  }

  /**
   * @param {'LOG'|'INFO'|'ERROR'|'DEBUG'|'WARN'} level
   * @param {string} component
   * @param {...any} args
   */
  _print(level, component, ...args) {
    if (this.target) {
      this.target[level.toLowerCase()](`[${component}]`, ...args)
      return
    }
    if (!this.debugMode) return

    const timestamp = new Date().toISOString()
    const formatted = `${timestamp} [${level}] [${component}]`

    if (level === 'ERROR') {
      // eslint-disable-next-line no-console
      console.error(formatted, ...args)
      return
    }

    // eslint-disable-next-line no-console
    console.log(formatted, ...args)
  }

  log(component, ...args) {
    this._print('LOG', component, ...args)
  }

  debug(component, ...args) {
    this._print('DEBUG', component, ...args)
  }

  info(component, ...args) {
    this._print('INFO', component, ...args)
  }

  warn(component, ...args) {
    this._print('WARN', component, ...args)
  }

  error(component, ...args) {
    this._print('ERROR', component, ...args)
    forwardErrorToMain(component, args)
  }
}

function forwardErrorToMain(component, args) {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined
  if (!api || typeof api.logError !== 'function') return
  try {
    api.logError(
      component,
      args.map((arg) => (arg instanceof Error ? arg.stack || String(arg) : arg))
    )
  } catch {
    // Logging must never throw into the caller.
  }
}

export const logger = new Logger({ debugMode: false })
