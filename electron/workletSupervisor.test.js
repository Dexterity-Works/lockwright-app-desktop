/* eslint-env jest */
/* eslint-disable no-underscore-dangle */

const EventEmitter = require('events')

const { createWorkletSupervisor } = require('./workletSupervisor.cjs')

const silentLogger = { log: jest.fn(), error: jest.fn() }

/** A bare-sidecar stand-in: `close(signal)` ends it the way a crash does. */
function fakeSidecar() {
  const sidecar = new EventEmitter()
  sidecar._process = new EventEmitter()
  sidecar.stderr = new EventEmitter()
  sidecar.destroy = jest.fn()
  sidecar.close = (signal = 'SIGSEGV') =>
    sidecar._process.emit('close', null, signal)
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
    worklet = createWorkletSupervisor({
      connect: (sidecar) => connect(sidecar),
      isQuitting: () => quitting,
      nativeMessaging,
      window,
      emitMarker: (name, detail) => markers.push(`${name} ${detail}`),
      logger: silentLogger
    })
  })

  it('stops native messaging, respawns, and reloads after an exit', async () => {
    await worklet.start(spawn)
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

  it('forwards each client’s events to the window once', async () => {
    await worklet.start(spawn)
    sidecars[0].close()
    await flush()

    worklet.client().emit('update')
    worklet.client().emit('personal-swarm-envelope', { id: 1 })
    expect(window.send.mock.calls).toEqual([
      ['vault:update'],
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
})
