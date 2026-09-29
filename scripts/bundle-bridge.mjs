#!/usr/bin/env node
/**
 * Bundle the two Node-side native messaging entry points into single CJS files:
 * - the bridge (native host, run by the browser under ELECTRON_RUN_AS_NODE)
 * - the server the Electron main process hosts (src/services/nativeMessagingMain.js)
 * Node built-ins, pear-ipc and sodium-native are external: they resolve at runtime.
 */
import * as esbuild from 'esbuild'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const watch = process.argv.includes('--watch')
const outfile = path.join(root, 'dist', 'native-messaging-bridge.bundle.cjs')
const mainOutfile = path.join(root, 'dist', 'native-messaging-main.bundle.cjs')

const ctx = await esbuild.context({
  entryPoints: [path.join(root, 'native-host', 'index.js')],
  bundle: true,
  outfile,
  platform: 'node',
  target: ['node18'],
  format: 'cjs',
  external: [
    'fs',
    'fs/promises',
    'path',
    'os',
    'net',
    'events',
    'crypto',
    'child_process',
    'pear-ipc'
  ],
  logLevel: 'info'
})

const mainCtx = await esbuild.context({
  entryPoints: [path.join(root, 'src', 'services', 'nativeMessagingMain.js')],
  bundle: true,
  outfile: mainOutfile,
  platform: 'node',
  target: ['node20'],
  format: 'cjs',
  external: [
    'fs',
    'fs/promises',
    'path',
    'os',
    'net',
    'events',
    'crypto',
    'child_process',
    'pear-ipc',
    'sodium-native'
  ],
  logLevel: 'info'
})

if (watch) {
  await ctx.watch()
  await mainCtx.watch()
  console.log('Watching for changes...')
} else {
  await ctx.rebuild()
  await mainCtx.rebuild()
  ctx.dispose()
  mainCtx.dispose()
}
