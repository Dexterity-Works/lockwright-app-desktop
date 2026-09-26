/* eslint-env jest */

jest.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: jest.fn((name, api) => {
      globalThis.window[name] = api
    })
  },
  ipcRenderer: {
    sendSync: jest.fn(),
    invoke: jest.fn(),
    send: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn()
  }
}))

// Helper to load the preload script fresh for each test
const loadPreload = () => {
  // Ensure we start from a clean module state
  jest.resetModules()

  return require('./preload.cjs')
}

describe('preload.cjs', () => {
  beforeEach(() => {
    // Provide a minimal window shim so the mocked contextBridge has a main world
    globalThis.window = globalThis.window || {}
    delete window.electronAPI
    delete window.Pear

    jest.clearAllMocks()

    loadPreload()
  })

  it('exposes electronAPI through contextBridge only', () => {
    const { contextBridge, ipcRenderer } = require('electron')

    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledTimes(1)
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'electronAPI',
      expect.any(Object)
    )
    // Nothing synchronous at load, and no Node globals leak into the page
    expect(ipcRenderer.sendSync).not.toHaveBeenCalled()
    expect(window.Pear).toBeUndefined()
    expect(Object.values(window.electronAPI)).not.toContain(ipcRenderer)
  })

  it('exposes electronAPI on window with expected methods', () => {
    expect(window.electronAPI).toBeDefined()
    expect(window.electronAPI.getAppVersion).toBeUndefined()
    expect(window.electronAPI.productName).toBeUndefined()
    expect(typeof window.electronAPI.getConfig).toBe('function')
    expect(typeof window.electronAPI.onRuntimeUpdating).toBe('function')
    expect(typeof window.electronAPI.onRuntimeUpdated).toBe('function')
    expect(typeof window.electronAPI.applyUpdate).toBe('function')
    expect(typeof window.electronAPI.restart).toBe('function')
    expect(typeof window.electronAPI.checkUpdated).toBe('function')
    expect(typeof window.electronAPI.setNativeMessagingPrefs).toBe('function')
    expect(typeof window.electronAPI.onNativeMessagingEvent).toBe('function')
    expect(Object.keys(window.electronAPI.nativeMessaging).sort()).toEqual([
      'cleanup',
      'clearSessions',
      'closeSessionsForClient',
      'identity',
      'importClientKeys',
      'isRunning',
      'markPairingApproved',
      'pairedClients',
      'removeClient',
      'setup',
      'start',
      'stop'
    ])
    expect(typeof window.electronAPI.logError).toBe('function')
    expect(typeof window.electronAPI.clearClipboardAfter).toBe('function')
    expect(typeof window.electronAPI.vaultInvoke).toBe('function')
    expect(typeof window.electronAPI.vaultOnUpdate).toBe('function')
    expect(typeof window.electronAPI.vaultOnMasterUpdate).toBe('function')
    expect(typeof window.electronAPI.vaultOnPersonalSwarmEnvelope).toBe(
      'function'
    )
    expect(typeof window.electronAPI.clearStaleVaultsDir).toBe('function')
    expect(typeof window.electronAPI.openExternal).toBe('function')
    expect(typeof window.electronAPI.openLogsFolder).toBe('function')
    expect(typeof window.electronAPI.isLoggingEnabled).toBe('function')
    expect(typeof window.electronAPI.setLogging).toBe('function')
  })

  it('routes clearStaleVaultsDir through ipcRenderer.invoke', async () => {
    const { ipcRenderer } = require('electron')

    await window.electronAPI.clearStaleVaultsDir()

    expect(ipcRenderer.invoke).toHaveBeenCalledWith('vault:clearStaleVaultsDir')
  })

  it('routes simple invoke-based APIs through ipcRenderer.invoke', async () => {
    const { ipcRenderer } = require('electron')

    await window.electronAPI.getConfig()
    await window.electronAPI.applyUpdate()
    await window.electronAPI.restart()
    await window.electronAPI.checkUpdated()
    await window.electronAPI.clearClipboardAfter('secret', 30000)
    await window.electronAPI.setLogging(1)

    expect(ipcRenderer.invoke).toHaveBeenCalledWith('runtime:getConfig')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('runtime:applyUpdate')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('runtime:restart')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('runtime:checkUpdated')
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('clipboard:clearAfter', {
      text: 'secret',
      delayMs: 30000
    })
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('vault:setLogging', {
      enabled: true
    })
  })

  it('routes vaultInvoke through ipcRenderer.invoke with payload', async () => {
    const { ipcRenderer } = require('electron')

    await window.electronAPI.vaultInvoke('doSomething', { foo: 'bar' })

    expect(ipcRenderer.invoke).toHaveBeenCalledWith('vault:invoke', {
      method: 'doSomething',
      args: { foo: 'bar' }
    })
  })

  it('sends logError as a fire-and-forget message', () => {
    const { ipcRenderer } = require('electron')

    window.electronAPI.logError('Comp', ['boom'])

    expect(ipcRenderer.send).toHaveBeenCalledWith('renderer:logError', {
      component: 'Comp',
      args: ['boom']
    })
  })

  it.each([
    ['onRuntimeUpdating', 'runtime:updating'],
    ['onRuntimeUpdated', 'runtime:updated'],
    ['vaultOnUpdate', 'vault:update'],
    ['vaultOnMasterUpdate', 'vault:master-update']
  ])('%s subscribes to %s and returns an unsubscribe', (api, channel) => {
    const { ipcRenderer } = require('electron')
    const cb = jest.fn()

    const unsubscribe = window.electronAPI[api](cb)

    expect(ipcRenderer.on).toHaveBeenCalledTimes(1)
    const [subscribed, handler] = ipcRenderer.on.mock.calls[0]
    expect(subscribed).toBe(channel)
    // The page callback never sees the IpcRendererEvent
    handler({ sender: 'ipc' })
    expect(cb).toHaveBeenCalledWith()

    unsubscribe()
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith(channel, handler)
  })

  it.each([
    ['vaultOnPersonalSwarmEnvelope', 'vault:personal-swarm-envelope'],
    ['onNativeMessagingEvent', 'nm:event']
  ])('%s hands the page the payload of %s', (api, channel) => {
    const { ipcRenderer } = require('electron')
    const cb = jest.fn()

    const unsubscribe = window.electronAPI[api](cb)

    const [subscribed, handler] = ipcRenderer.on.mock.calls[0]
    expect(subscribed).toBe(channel)
    handler({ sender: 'ipc' }, { type: 'x' })
    expect(cb).toHaveBeenCalledWith({ type: 'x' })

    unsubscribe()
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith(channel, handler)
  })
})
