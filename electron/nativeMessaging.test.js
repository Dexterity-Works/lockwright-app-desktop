/* eslint-env jest */

const { createNativeMessaging } = require('./nativeMessaging.cjs')

function fakeIpcMain() {
  const handlers = new Map()
  return {
    handle: (channel, fn) => handlers.set(channel, fn),
    invoke: (channel, payload) => handlers.get(channel)({}, payload)
  }
}

describe('nm:prefs', () => {
  it('mirrors a well-typed renderer snapshot and ignores the rest', async () => {
    const nm = createNativeMessaging()
    const ipcMain = fakeIpcMain()
    nm.register(ipcMain)

    await ipcMain.invoke('nm:prefs', {
      nativeMessagingEnabled: true,
      autoLockEnabled: false,
      autoLockTimeoutMs: 60000
    })
    expect(nm.getPreferences()).toEqual({
      nativeMessagingEnabled: true,
      autoLockEnabled: false,
      autoLockTimeoutMs: 60000
    })

    await ipcMain.invoke('nm:prefs', {
      nativeMessagingEnabled: 'yes',
      autoLockEnabled: 1,
      autoLockTimeoutMs: -5
    })
    expect(nm.getPreferences()).toEqual({
      nativeMessagingEnabled: true,
      autoLockEnabled: false,
      autoLockTimeoutMs: 60000
    })

    await ipcMain.invoke('nm:prefs', { autoLockTimeoutMs: null })
    expect(nm.getPreferences().autoLockTimeoutMs).toBeNull()
  })
})
