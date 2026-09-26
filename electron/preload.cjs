/**
 * Preload: the only bridge between the page and the main process. It runs
 * context-isolated, so the page sees nothing but the `electronAPI` object
 * exposed here; ipcRenderer itself never crosses the bridge. Subscriptions
 * return an unsubscribe function and strip the IpcRendererEvent so page
 * callbacks only ever get the payload.
 */
const { contextBridge, ipcRenderer } = require('electron')

const subscribe = (channel, cb) => {
  const sub = (_event, msg) => cb(msg)
  ipcRenderer.on(channel, sub)
  return () => ipcRenderer.removeListener(channel, sub)
}

const subscribeSignal = (channel, cb) => subscribe(channel, () => cb())

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('runtime:getConfig'),
  onRuntimeUpdating: (cb) => subscribeSignal('runtime:updating', cb),
  onRuntimeUpdated: (cb) => subscribeSignal('runtime:updated', cb),
  applyUpdate: () => ipcRenderer.invoke('runtime:applyUpdate'),
  restart: () => ipcRenderer.invoke('runtime:restart'),
  checkUpdated: () => ipcRenderer.invoke('runtime:checkUpdated'),
  clearClipboardAfter: (text, delayMs) =>
    ipcRenderer.invoke('clipboard:clearAfter', { text, delayMs }),
  vaultInvoke: (method, args) =>
    ipcRenderer.invoke('vault:invoke', { method, args }),
  vaultOnUpdate: (cb) => subscribeSignal('vault:update', cb),
  vaultOnMasterUpdate: (cb) => subscribeSignal('vault:master-update', cb),
  vaultOnPersonalSwarmEnvelope: (cb) =>
    subscribe('vault:personal-swarm-envelope', cb),
  clearStaleVaultsDir: () => ipcRenderer.invoke('vault:clearStaleVaultsDir'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  openLogsFolder: () => ipcRenderer.invoke('vault:openLogsFolder'),
  isLoggingEnabled: () => ipcRenderer.invoke('vault:isLoggingEnabled'),
  setLogging: (enabled) =>
    ipcRenderer.invoke('vault:setLogging', { enabled: !!enabled }),
  logError: (component, args) =>
    ipcRenderer.send('renderer:logError', { component, args }),
  setNativeMessagingPrefs: (prefs) => ipcRenderer.invoke('nm:prefs', prefs),
  onNativeMessagingEvent: (cb) => subscribe('nm:event', cb),
  nativeMessaging: {
    setup: () => ipcRenderer.invoke('nm:setup'),
    start: () => ipcRenderer.invoke('nm:start'),
    stop: () => ipcRenderer.invoke('nm:stop'),
    isRunning: () => ipcRenderer.invoke('nm:isRunning'),
    cleanup: () => ipcRenderer.invoke('nm:cleanup'),
    identity: (reset) => ipcRenderer.invoke('nm:identity', { reset: !!reset }),
    pairedClients: () => ipcRenderer.invoke('nm:pairedClients'),
    removeClient: (publicKey) =>
      ipcRenderer.invoke('nm:removeClient', { publicKey }),
    closeSessionsForClient: (publicKey) =>
      ipcRenderer.invoke('nm:closeSessionsForClient', { publicKey }),
    clearSessions: () => ipcRenderer.invoke('nm:clearSessions'),
    markPairingApproved: () => ipcRenderer.invoke('nm:markPairingApproved'),
    importClientKeys: (keys) =>
      ipcRenderer.invoke('nm:importClientKeys', { keys })
  }
})
