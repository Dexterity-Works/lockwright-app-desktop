/**
 * @jest-environment node
 */
jest.mock('pear-ipc', () => ({ Client: jest.fn() }))
jest.mock('./nativeMessagingHandler.js', () => {
  const { EventEmitter } = require('events')
  const instances = []
  class NativeMessagingHandler extends EventEmitter {
    constructor() {
      super()
      this.start = jest.fn()
      this.send = jest.fn()
      this.stop = jest.fn()
      instances.push(this)
    }
  }
  return { NativeMessagingHandler, instances }
})
jest.mock('./utils/getIpcPath.js', () => ({ getIpcPath: jest.fn() }))
jest.mock('./utils/log.js', () => ({ log: jest.fn() }))

const { createHmac } = require('crypto')

const IPC = require('pear-ipc')

const { instances } = require('./nativeMessagingHandler.js')
const { getIpcPath } = require('./utils/getIpcPath.js')

const flush = () => new Promise((resolve) => setImmediate(resolve))

const secret = 'cd'.repeat(32)
const prove = (nonceHex) =>
  createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(Buffer.from(nonceHex, 'hex'))
    .digest('hex')
// What the pipe owner answers nmProveServer with; tests swap it
let answerProof = prove

describe('native messaging host IPC path', () => {
  let handler

  beforeAll(async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate'] })
    IPC.Client.mockImplementation(function (opts) {
      this.socketPath = opts.socketPath
      this.ready = jest.fn().mockResolvedValue()
      this.on = jest.fn()
      this.close = jest.fn()
      this.nmProveServer = jest.fn(async ({ nonceHex }) => ({
        proofHex: await answerProof(nonceHex)
      }))
      this.nmGetAppIdentity = jest.fn().mockResolvedValue({ ok: true })
    })
    getIpcPath.mockReturnValue('pipe-from-first-desktop-start')
    require('./bridge.js')
    await flush()
    handler = instances[0]
  })

  const checkAvailability = async (id) => {
    handler.emit('message', { id, command: 'checkAvailability' })
    await flush()
    return handler.send.mock.calls.find(([msg]) => msg.id === id)[0].result
  }

  const dropConnection = () => {
    const client = IPC.Client.mock.instances.at(-1)
    const [, onClose] = client.on.mock.calls.find(([e]) => e === 'close')
    onClose()
  }

  it('asks for the socket the Lockwright desktop listens on', () => {
    expect(getIpcPath).toHaveBeenCalledWith('lockwright-native-messaging')
  })

  it('re-resolves the path on reconnect so a restarted desktop is found', async () => {
    expect(IPC.Client.mock.instances.at(-1).socketPath).toBe(
      'pipe-from-first-desktop-start'
    )

    dropConnection()
    getIpcPath.mockReturnValue('pipe-from-second-desktop-start')

    expect(await checkAvailability('1')).toMatchObject({ available: true })
    expect(IPC.Client.mock.instances.at(-1).socketPath).toBe(
      'pipe-from-second-desktop-start'
    )
  })

  it('reports not-running and opens no connection when no path is published', async () => {
    dropConnection()
    getIpcPath.mockReturnValue(null)
    const clientsBefore = IPC.Client.mock.calls.length

    expect(await checkAvailability('2')).toMatchObject({
      available: false,
      status: 'not-running'
    })
    expect(IPC.Client.mock.calls.length).toBe(clientsBefore)
  })

  const forwardGetAppIdentity = async (id) => {
    handler.emit('message', {
      id,
      command: 'nmGetAppIdentity',
      params: { pairingToken: 'secret-token' }
    })
    await flush()
    return handler.send.mock.calls.find(([msg]) => msg.id === id)[0]
  }

  it('never talks to a pipe owner that cannot prove it holds the secret', async () => {
    getIpcPath.mockReturnValue({ pipe: 'published-pipe', secret })
    answerProof = () => '00'.repeat(32)

    expect(await checkAvailability('3')).toMatchObject({
      available: false,
      status: 'not-running'
    })
    const squatter = IPC.Client.mock.instances.at(-1)
    expect(squatter.socketPath).toBe('published-pipe')
    expect(squatter.nmProveServer).toHaveBeenCalledWith({
      nonceHex: expect.stringMatching(/^[0-9a-f]{32}$/)
    })
    expect(squatter.close).toHaveBeenCalled()

    expect(await forwardGetAppIdentity('4')).toMatchObject({ success: false })
    expect(squatter.nmGetAppIdentity).not.toHaveBeenCalled()
  })

  it('never talks to a pipe owner that does not answer the proof', async () => {
    getIpcPath.mockReturnValue({ pipe: 'published-pipe', secret })
    answerProof = () => new Promise(() => {})

    handler.emit('message', { id: '5', command: 'checkAvailability' })
    await flush()
    expect(
      handler.send.mock.calls.find(([msg]) => msg.id === '5')
    ).toBeUndefined()
    jest.runOnlyPendingTimers()
    await flush()

    const [response] = handler.send.mock.calls.find(([msg]) => msg.id === '5')
    expect(response.result).toMatchObject({
      available: false,
      status: 'not-running'
    })
    expect(IPC.Client.mock.instances.at(-1).close).toHaveBeenCalled()
  })

  it('forwards once the pipe owner proves it holds the secret', async () => {
    getIpcPath.mockReturnValue({ pipe: 'published-pipe', secret })
    answerProof = prove

    expect(await checkAvailability('6')).toMatchObject({ available: true })
    const desktop = IPC.Client.mock.instances.at(-1)
    expect(desktop.nmProveServer).toHaveBeenCalledTimes(1)
    expect(desktop.nmProveServer.mock.invocationCallOrder[0]).toBeGreaterThan(
      desktop.ready.mock.invocationCallOrder[0]
    )

    expect(await forwardGetAppIdentity('7')).toMatchObject({ success: true })
    expect(desktop.nmGetAppIdentity).toHaveBeenCalledWith({
      pairingToken: 'secret-token'
    })
  })

  it('drops desktop pushes until the pipe owner has proved itself', async () => {
    dropConnection()
    getIpcPath.mockReturnValue({ pipe: 'published-pipe', secret })
    let releaseProof = () => {}
    answerProof = (nonceHex) =>
      new Promise((resolve) => {
        releaseProof = () => resolve(prove(nonceHex))
      })

    handler.emit('message', { id: '8', command: 'checkAvailability' })
    await flush()
    const { api } = IPC.Client.mock.calls.at(-1)[0]
    const method = {}
    api.onEpochStatus(method)
    const pushes = () =>
      handler.send.mock.calls.filter(([msg]) => msg.event === 'epoch-status')

    method._onrequest({ vaultId: 'v-1', revoked: true })
    expect(pushes()).toHaveLength(0)

    releaseProof()
    await flush()
    method._onrequest({ vaultId: 'v-1', revoked: true })
    expect(pushes()).toEqual([
      [{ event: 'epoch-status', data: { vaultId: 'v-1', revoked: true } }]
    ])
  })

  it('forwards pushes on the live client after a stale client closes late', async () => {
    getIpcPath.mockReturnValue({ pipe: 'published-pipe', secret })
    answerProof = prove
    const stale = IPC.Client.mock.instances.at(-1)
    const [, staleClose] = stale.on.mock.calls.find(([e]) => e === 'close')
    staleClose()

    expect(await checkAvailability('9')).toMatchObject({ available: true })
    const { api } = IPC.Client.mock.calls.at(-1)[0]
    const method = {}
    api.onVaultAccessRevoked(method)

    // The stale client's close event arrives again after the live one is up.
    staleClose()
    method._onrequest({ vaultId: 'v-2', actor: 'd-1' })

    expect(handler.send).toHaveBeenLastCalledWith({
      event: 'vault-access-revoked',
      data: { vaultId: 'v-2', actor: 'd-1' }
    })
  })

  it('closes a timed-out client and carries pushes on the reconnected one', async () => {
    getIpcPath.mockReturnValue({ pipe: 'published-pipe', secret })
    answerProof = prove
    expect(await checkAvailability('10')).toMatchObject({ available: true })
    const timedOut = IPC.Client.mock.instances.at(-1)
    timedOut.nmGetAppIdentity.mockReturnValueOnce(new Promise(() => {}))
    const clientsBefore = IPC.Client.mock.instances.length

    handler.emit('message', { id: '11', command: 'nmGetAppIdentity', params: {} })
    await flush()
    jest.runOnlyPendingTimers()
    for (let i = 0; i < 5; i++) await flush()

    expect(timedOut.close).toHaveBeenCalled()
    expect(IPC.Client.mock.instances.length).toBe(clientsBefore + 1)
    const { api } = IPC.Client.mock.calls.at(-1)[0]
    const method = {}
    api.onEpochStatus(method)
    method._onrequest({ vaultId: 'v-3', revoked: true })
    expect(handler.send).toHaveBeenLastCalledWith({
      event: 'epoch-status',
      data: { vaultId: 'v-3', revoked: true }
    })
  })
})

describe('NativeMessagingHost connect', () => {
  const host = () => {
    const { NativeMessagingHost } = require('./bridge.js')
    return new NativeMessagingHost()
  }

  beforeEach(() => {
    getIpcPath.mockReturnValue({ pipe: 'published-pipe', secret })
    answerProof = prove
  })

  it('shares one connect between concurrent callers', async () => {
    const bridge = host()
    const before = IPC.Client.mock.instances.length

    await Promise.all([bridge.connectToIPC(), bridge.connectToIPC()])

    expect(IPC.Client.mock.instances.length).toBe(before + 1)
    expect(bridge.ipcClient).toBe(IPC.Client.mock.instances.at(-1))
    expect(bridge.desktopAppStatus).toBe('connected')
  })

  it('closes a client replaced mid-proof and never marks it connected', async () => {
    let releaseProof = () => {}
    answerProof = (nonceHex) =>
      new Promise((resolve) => {
        releaseProof = () => resolve(prove(nonceHex))
      })
    const bridge = host()

    const connecting = bridge.connectToIPC()
    await flush()
    const replaced = IPC.Client.mock.instances.at(-1)
    expect(replaced.nmProveServer).toHaveBeenCalled()
    const successor = { closed: false, on: jest.fn(), close: jest.fn() }
    bridge.ipcClient = successor
    bridge.desktopAppStatus = 'connecting'

    releaseProof()
    await connecting

    expect(replaced.close).toHaveBeenCalled()
    expect(successor.close).not.toHaveBeenCalled()
    expect(bridge.ipcClient).toBe(successor)
    expect(bridge.desktopAppStatus).toBe('connecting')
  })
})
