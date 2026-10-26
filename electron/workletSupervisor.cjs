/* eslint-disable no-underscore-dangle */
/**
 * Keeps one vault worklet connected. When it exits on its own, the exit and
 * its last stderr lines go to stderr (the main logger writes nowhere with
 * logging off), native messaging stops, a new worklet is spawned the same
 * way, and the window reloads: the unlocked vault died with the old worklet,
 * and a fresh renderer boots to the lock screen against the new one. Vault
 * calls in between fail with WORKLET_EXITED. An exit while the app quits,
 * or by a shutdown signal, changes nothing. Respawns stop after a few per
 * launch, so a worklet that keeps crashing does not loop.
 */

const MAX_RESPAWNS = 3
const STDERR_TAIL_LINES = 20
const STDERR_TAIL_CHARS = 8192
// What Ctrl-C under `pnpm dev` or a session shutdown sends the whole process
// group. The worklet can see it before Electron's before-quit.
const SHUTDOWN_SIGNALS = new Set(['SIGINT', 'SIGTERM', 'SIGHUP'])

/**
 * @param {object} deps
 * @param {(sidecar: object) => Promise<object>} deps.connect wait for the
 *   worklet and build its vault client
 * @param {() => boolean} deps.isQuitting
 * @param {{ stop: () => Promise<void> }} deps.nativeMessaging
 * @param {{ send: (channel: string, data?: unknown) => void, reload: () => void }} deps.window
 *   no-ops without a window
 * @param {(name: string, detail?: string) => void} deps.emitMarker to stderr
 * @param {{ log: Function, error: Function }} deps.logger
 */
function createWorkletSupervisor({
  connect,
  isQuitting,
  nativeMessaging,
  window,
  emitMarker,
  logger
}) {
  /** @type {(() => object) | null} */
  let spawn = null
  /** @type {object | null} the newest worklet, the one cleanup must kill */
  let sidecar = null
  /** @type {object | null} */
  let client = null
  /** `code=… signal=…` of the worklet that exited, until a new one connects */
  let exitStatus = null
  let respawns = 0

  /**
   * Spawn one worklet and connect to it.
   * @returns {Promise<'connected' | 'exited' | 'stopped'>} `exited` when it
   *   crashed before it connected, `stopped` when a quit or a shutdown
   *   signal ended it
   */
  async function connectOnce() {
    const current = spawn()
    sidecar = current
    let connected = false
    let closed = false
    let stoppedBySignal = false
    let stderrTail = ''

    current.on('error', (err) => {
      logger.error('MAIN', '[worklet IPC error]', err.code || err.message, err)
    })
    current._process?.stdio?.[3]?.on('error', (err) => {
      logger.error(
        'MAIN',
        '[worklet IPC pipe error]',
        err.code || err.message,
        err
      )
    })
    current.stderr?.on('data', (d) => {
      const text = d?.toString?.() || d
      logger.error('MAIN', '[worklet stderr]', text)
      stderrTail = (stderrTail + text).slice(-STDERR_TAIL_CHARS)
    })
    current.stdout?.on('data', (d) =>
      logger.log('MAIN', '[worklet stdout]', d?.toString?.() || d)
    )
    current._process?.on?.('error', (err) => {
      logger.error('MAIN', '[worklet process error]', err)
    })
    // `close`, not `exit`: it fires once stdio has drained, so the tail
    // holds the crash reason.
    current._process?.on?.('close', (code, sig) => {
      closed = true
      stoppedBySignal = SHUTDOWN_SIGNALS.has(sig)
      const status = `code=${code} signal=${sig}`
      logger.error('MAIN', '[worklet exit]', status)
      emitMarker('WORKLET_EXIT', status)
      const lines = stderrTail.split('\n').filter(Boolean)
      for (const line of lines.slice(-STDERR_TAIL_LINES)) {
        emitMarker('WORKLET_STDERR', line)
      }
      if (current !== sidecar) return
      exitStatus = status
      if (connected && !isQuitting() && !stoppedBySignal) void recover()
    })

    const next = await connect(current)
    if (isQuitting()) {
      current.destroy()
      return 'stopped'
    }
    if (closed) return stoppedBySignal ? 'stopped' : 'exited'

    next.on('update', () => window.send('vault:update'))
    next.on('master-update', () => window.send('vault:master-update'))
    next.on('personal-swarm-envelope', (msg) =>
      window.send('vault:personal-swarm-envelope', msg)
    )
    client = next
    exitStatus = null
    connected = true
    return 'connected'
  }

  /**
   * Connect, spawning again within the respawn cap while worklets exit
   * before they connect.
   * @param {boolean} respawn whether the first spawn already counts as one
   * @returns {Promise<boolean>} whether a worklet is connected
   */
  async function connectWithRespawns(respawn) {
    for (let again = respawn; ; again = true) {
      if (again) {
        if (respawns >= MAX_RESPAWNS) {
          emitMarker('WORKLET_RESPAWN_SKIPPED', `attempts=${respawns}`)
          return false
        }
        respawns += 1
      }
      if (isQuitting()) return false
      const result = await connectOnce()
      if (result === 'stopped') return false
      if (result === 'connected') {
        if (again) emitMarker('WORKLET_RESPAWNED', `attempt=${respawns}`)
        return true
      }
    }
  }

  async function recover() {
    // The server holds the dead client. The reloaded window's first
    // nm:prefs push starts it again on the new one.
    try {
      await nativeMessaging.stop()
    } catch (err) {
      logger.error('MAIN', 'Failed to stop native messaging:', err)
    }
    try {
      await connectWithRespawns(true)
    } catch (err) {
      emitMarker(
        'WORKLET_RESPAWN_ERROR',
        (err && (err.stack || err.message)) || String(err)
      )
    }
    if (!isQuitting()) window.reload()
  }

  const api = {
    /** @param {() => object} spawnWorklet */
    async start(spawnWorklet) {
      spawn = spawnWorklet
      if (!(await connectWithRespawns(false)) && !isQuitting()) {
        throw api.exitError()
      }
    },
    client: () => client,
    /** Why vault calls fail while no worklet runs, or null. */
    exitError() {
      if (!exitStatus) return null
      const err = new Error(`Vault worklet exited (${exitStatus})`)
      err.code = 'WORKLET_EXITED'
      return err
    },
    destroy() {
      sidecar?.destroy()
    }
  }
  return api
}

module.exports = { createWorkletSupervisor }
