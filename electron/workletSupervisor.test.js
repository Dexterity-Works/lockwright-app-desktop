/* eslint-env jest */
/* eslint-disable no-underscore-dangle */

const EventEmitter = require('events')

const { createWorkletSupervisor } = require('./workletSupervisor.cjs')

const silentLogger = { log: jest.fn(), error: jest.fn() }

/** A bare-sidecar stand-in: `close(signal, code)` ends it like a crash. */
function fakeSidecar() {
  const sidecar = new EventEmitter()
  sidecar._process = new EventEmitter()
  sidecar.stderr = new EventEmitter()
  sidecar.destroy = jest.fn()
  sidecar.close = (signal = 'SIGSEGV', code = null) =>
    sidecar._process.emit('close', code, signal)
  return sidecar
}

const deferred = () => {
  let resolve
  const promise = new Promise((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('createWorkletSupervisor', () => {
  let sidecars
  let spawn
  let connect
  let quitting
  let nativeMessaging
  let window
  let markers
  let wait
  let endGrace
  let worklet

  beforeEach(() => {
    sidecars = []
    spawn = jest.fn(() => {
      const sidecar = fakeSidecar()
      sidecars.push(sidecar)
      return sidecar
    })
    connect = jest.fn(async (sidecar) => {
      const client = new EventEmitter()
      client.sidecar = sidecar
      return client
    })
    quitting = false
    nativeMessaging = { stop: jest.fn().mockResolvedValue(undefined) }
    window = { send: jest.fn(), reload: jest.fn() }
    markers = []
    wait = jest.fn(
      () =>
        new Promise((resolve) => {
          endGrace = resolve
        })
    )
    worklet = createWorkletSupervisor({
      connect: (sidecar) => connect(sidecar),
      isQuitting: () => quitting,
      nativeMessaging,
      window,
      emitMarker: (name, detail) => markers.push(`${name} ${detail}`),
      logger: silentLogger,
      wait: (ms) => wait(ms)
    })
  })

  it('stops native messaging, respawns, and reloads after an exit', async () => {
    await worklet.start(spawn)
    expect(markers.some((m) => m.startsWith('WORKLET_RESPAWNED'))).toBe(false)
    const first = worklet.client()

    sidecars[0].close()
    expect(worklet.exitError()).toMatchObject({ code: 'WORKLET_EXITED' })
    await flush()

    expect(nativeMessaging.stop).toHaveBeenCalledTimes(1)
    expect(spawn).toHaveBeenCalledTimes(2)
    expect(worklet.client()).not.toBe(first)
    expect(worklet.client().sidecar).toBe(sidecars[1])
    expect(worklet.exitError()).toBeNull()
    expect(window.reload).toHaveBeenCalledTimes(1)
    expect(markers).toContain('WORKLET_RESPAWNED attempt=1')

    worklet.destroy()
    expect(sidecars[1].destroy).toHaveBeenCalled()
    expect(sidecars[0].destroy).not.toHaveBeenCalled()
  })

  it('writes the stderr that arrives between exit and close', async () => {
    await worklet.start(spawn)
    sidecars[0].stderr.emit('data', Buffer.from('booting\n'))
    sidecars[0]._process.emit('exit', null, 'SIGABRT')
    sidecars[0].stderr.emit('data', Buffer.from('Uncaught Error: boom\n'))
    sidecars[0].close('SIGABRT')

    expect(markers).toEqual(
      expect.arrayContaining([
        'WORKLET_EXIT code=null signal=SIGABRT',
        'WORKLET_STDERR booting',
        'WORKLET_STDERR Uncaught Error: boom'
      ])
    )
    expect(markers.filter((m) => m.startsWith('WORKLET_EXIT'))).toHaveLength(1)
  })

  it('writes the last 20 stderr lines', async () => {
    await worklet.start(spawn)
    for (let i = 1; i <= 25; i++) {
      sidecars[0].stderr.emit('data', Buffer.from(`line ${i}\n`))
    }
    sidecars[0].close()

    const tail = markers.filter((m) => m.startsWith('WORKLET_STDERR'))
    expect(tail).toHaveLength(20)
    expect(tail[0]).toBe('WORKLET_STDERR line 6')
  })

  it('forwards each client’s events to the window once', async () => {
    await worklet.start(spawn)
    sidecars[0].close()
    await flush()

    worklet.client().emit('update')
    worklet.client().emit('master-update')
    worklet.client().emit('personal-swarm-envelope', { id: 1 })
    expect(window.send.mock.calls).toEqual([
      ['vault:update'],
      ['vault:master-update'],
      ['vault:personal-swarm-envelope', { id: 1 }]
    ])
  })

  it('does not respawn on an exit while quitting', async () => {
    await worklet.start(spawn)
    quitting = true
    sidecars[0].close('SIGBUS')
    await flush()

    expect(nativeMessaging.stop).not.toHaveBeenCalled()
    expect(spawn).toHaveBeenCalledTimes(1)
    expect(window.reload).not.toHaveBeenCalled()
    expect(markers).toContain('WORKLET_EXIT code=null signal=SIGBUS')
  })

  it.each(['SIGINT', 'SIGTERM', 'SIGHUP'])(
    'respawns a worklet stopped by %s once a grace period passes with no quit',
    async (signal) => {
      await worklet.start(spawn)
      sidecars[0].close(signal)
      await flush()
      expect(wait).toHaveBeenCalledWith(1500)
      expect(spawn).toHaveBeenCalledTimes(1)

      endGrace()
      await flush()
      expect(nativeMessaging.stop).toHaveBeenCalledTimes(1)
      expect(spawn).toHaveBeenCalledTimes(2)
      expect(window.reload).toHaveBeenCalledTimes(1)
    }
  )

  it('leaves a worklet stopped by SIGTERM down when the quit follows', async () => {
    await worklet.start(spawn)
    sidecars[0].close('SIGTERM')
    await flush()
    quitting = true
    endGrace()
    await flush()

    expect(nativeMessaging.stop).not.toHaveBeenCalled()
    expect(spawn).toHaveBeenCalledTimes(1)
    expect(window.reload).not.toHaveBeenCalled()
    expect(markers).toContain('WORKLET_EXIT code=null signal=SIGTERM')
  })

  it.each(['SIGKILL', 'SIGSEGV'])(
    'respawns a worklet killed by %s at once',
    async (signal) => {
      await worklet.start(spawn)
      sidecars[0].close(signal)
      await flush()

      expect(wait).not.toHaveBeenCalled()
      expect(spawn).toHaveBeenCalledTimes(2)
    }
  )

  it('does not spawn when the quit lands while native messaging stops', async () => {
    await worklet.start(spawn)
    const stopping = deferred()
    nativeMessaging.stop.mockReturnValueOnce(stopping.promise)

    sidecars[0].close()
    quitting = true
    stopping.resolve()
    await flush()

    expect(spawn).toHaveBeenCalledTimes(1)
  })

  it('destroys a respawned worklet when the quit lands while it connects', async () => {
    await worklet.start(spawn)
    const connecting = deferred()
    connect.mockImplementationOnce(() => connecting.promise)

    sidecars[0].close()
    await flush()
    expect(spawn).toHaveBeenCalledTimes(2)
    quitting = true
    connecting.resolve(new EventEmitter())
    await flush()

    expect(sidecars[1].destroy).toHaveBeenCalled()
    expect(window.reload).not.toHaveBeenCalled()
    expect(markers).not.toContain('WORKLET_RESPAWNED attempt=1')
  })

  it('gives up after three respawns', async () => {
    await worklet.start(spawn)
    for (let i = 0; i < 4; i++) {
      sidecars[i].close()
      await flush()
    }

    expect(spawn).toHaveBeenCalledTimes(4)
    expect(markers).toContain('WORKLET_RESPAWN_SKIPPED attempts=3')
    expect(worklet.exitError()).toMatchObject({ code: 'WORKLET_EXITED' })
  })

  it('ignores the close of a worklet it already replaced', async () => {
    await worklet.start(spawn)
    sidecars[0].close()
    await flush()

    sidecars[0].close()
    await flush()

    expect(spawn).toHaveBeenCalledTimes(2)
    expect(worklet.exitError()).toBeNull()
  })

  it('respawns a worklet that exits before it connects at startup', async () => {
    const connecting = deferred()
    connect.mockImplementationOnce(() => connecting.promise)

    const started = worklet.start(spawn)
    await flush()
    sidecars[0].close()
    connecting.resolve(new EventEmitter())
    await started

    expect(spawn).toHaveBeenCalledTimes(2)
    expect(worklet.client().sidecar).toBe(sidecars[1])
    expect(worklet.exitError()).toBeNull()
  })

  it('leaves a startup worklet stopped by SIGTERM down when the quit follows', async () => {
    const connecting = deferred()
    connect.mockImplementationOnce(() => connecting.promise)

    const started = worklet.start(spawn)
    await flush()
    sidecars[0].close('SIGTERM')
    connecting.resolve(new EventEmitter())
    await flush()
    expect(wait).toHaveBeenCalledWith(1500)
    quitting = true
    endGrace()

    await expect(started).resolves.toBeUndefined()
    expect(spawn).toHaveBeenCalledTimes(1)
    expect(markers.some((m) => m.startsWith('WORKLET_RESPAWN'))).toBe(false)
  })

  it('respawns a startup worklet stopped by SIGTERM when no quit follows', async () => {
    const connecting = deferred()
    connect.mockImplementationOnce(() => connecting.promise)

    const started = worklet.start(spawn)
    await flush()
    sidecars[0].close('SIGTERM')
    connecting.resolve(new EventEmitter())
    await flush()
    endGrace()
    await started

    expect(spawn).toHaveBeenCalledTimes(2)
    expect(markers).toContain('WORKLET_RESPAWNED attempt=1')
    expect(worklet.exitError()).toBeNull()
  })

  it('resolves start when a quit lands while the first worklet connects', async () => {
    const connecting = deferred()
    connect.mockImplementationOnce(() => connecting.promise)

    const started = worklet.start(spawn)
    await flush()
    quitting = true
    connecting.resolve(new EventEmitter())

    await expect(started).resolves.toBeUndefined()
    expect(sidecars[0].destroy).toHaveBeenCalled()
    expect(spawn).toHaveBeenCalledTimes(1)
  })

  it('gives up at startup after three respawns', async () => {
    connect.mockImplementation(
      (sidecar) =>
        new Promise((resolve) =>
          sidecar._process.once('close', () => resolve(new EventEmitter()))
        )
    )

    const started = worklet.start(spawn)
    for (let i = 0; i < 4; i++) {
      await flush()
      sidecars[i].close()
    }

    await expect(started).rejects.toMatchObject({ code: 'WORKLET_EXITED' })
    expect(spawn).toHaveBeenCalledTimes(4)
    expect(markers).toContain('WORKLET_RESPAWN_SKIPPED attempts=3')
  })

  it('respawns after a spawn error', async () => {
    const connecting = deferred()
    connect.mockImplementationOnce(() => connecting.promise)

    const started = worklet.start(spawn)
    await flush()
    const enoent = Object.assign(new Error('spawn bare ENOENT'), {
      code: 'ENOENT'
    })
    sidecars[0]._process.emit('error', enoent)
    sidecars[0].close(null, -2)
    connecting.resolve(new EventEmitter())
    await started

    expect(spawn).toHaveBeenCalledTimes(2)
    expect(markers).toContain('WORKLET_EXIT code=-2 signal=null')
    expect(worklet.exitError()).toBeNull()
  })
})
