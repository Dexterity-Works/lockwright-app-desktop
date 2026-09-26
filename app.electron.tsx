/**
 * Electron-only entry for the renderer bundle. The page is context-isolated:
 * everything from the main process arrives through window.electronAPI, and
 * the `Pear` global usePearUpdate reads is built here from it.
 */
import { i18n } from '@lingui/core'
import { compileMessage } from '@lingui/message-utils/compileMessage'
import { I18nProvider } from '@lingui/react'
import {
  setPearpassVaultClient,
  VaultProvider
} from 'lockwright-lib-vault'
import { createRoot } from 'react-dom/client'
import { ThemeProvider as UIKitProvider } from 'lockwright-lib-ui-react-native-components'

import './src/strict.css'
import { App } from './src/app/App'
import { LoadingProvider } from './src/context/LoadingContext'
import { ModalProvider } from './src/context/ModalContext'
import { RouterProvider } from './src/context/RouterContext'
import { AppHeaderContextProvider } from './src/context/AppHeaderContext'
import { ToastProvider } from './src/context/ToastContext'
import { messages } from './src/locales/en/messages.mjs'
import { getElectronConfig, getElectronVaultClient } from './src/electron'
import { installNativeMessagingEvents } from './src/services/nativeMessagingEvents'
import {
  migrateLegacyClientKeyCache,
  pushNativeMessagingPrefs
} from './src/services/nativeMessagingPreferences'
import { setFontsAndResetCSS } from './styles'
import { AutoLockProvider } from './src/hooks/useAutoLockPreferences'

setFontsAndResetCSS()
i18n.setMessagesCompiler(compileMessage)
i18n.load('en', messages)
i18n.activate('en')

function renderApp() {
  const container = document.querySelector('#root')
  if (!container) throw new Error('Failed to find the root element')
  const root = createRoot(container)
  root.render(
    <UIKitProvider>
      <LoadingProvider>
        <VaultProvider>
          <I18nProvider i18n={i18n}>
            <ToastProvider>
              <RouterProvider>
                <AppHeaderContextProvider>
                  <AutoLockProvider>
                    <ModalProvider>
                      <App />
                    </ModalProvider>
                  </AutoLockProvider>
                </AppHeaderContextProvider>
              </RouterProvider>
            </ToastProvider>
          </I18nProvider>
        </VaultProvider>
      </LoadingProvider>
    </UIKitProvider>
  )
}

async function init() {
  const config = await getElectronConfig()
  const client = await getElectronVaultClient()
  if (!config || !client)
    throw new Error('Electron config or vault client missing')

  const api = window.electronAPI!
  ;(window as unknown as { Pear: object }).Pear = {
    config: {
      storage: config.storage,
      key: config.key,
      applink: config.applink || ''
    },
    updated: () => api.checkUpdated(),
    updates: (cb: (update?: unknown) => void) => {
      const unsub1 = api.onRuntimeUpdating(() => cb({}))
      const unsub2 = api.onRuntimeUpdated(() => cb({}))
      return () => {
        unsub1()
        unsub2()
      }
    },
    reload: () => window.location.reload(),
    restart: () => api.restart(),
    teardown: () => {}
  }

  setPearpassVaultClient(client, { currentDeviceName: config.deviceName })

  // The native messaging server runs in main. Hand it the UI's preferences
  // (which starts it when the extension setting is on) and any pairing keys
  // cached before it moved there, and listen for what it wants the UI to see.
  installNativeMessagingEvents()
  await migrateLegacyClientKeyCache()
  await pushNativeMessagingPrefs()

  renderApp()
}

init()
