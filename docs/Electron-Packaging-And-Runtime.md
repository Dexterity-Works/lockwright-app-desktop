# Electron packaging and runtime

This document describes how the Lockwright desktop app is built, packaged, and how the main process, worklet (vault), and renderer communicate.

---

## 1. Architecture overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Renderer (React)                                               │
│  - Uses window.electronAPI (from preload) for vault & runtime   │
└────────────────────────────┬────────────────────────────────────┘
                             │ IPC (vault:invoke, runtime:*, nm:*)      
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Main process (electron/main.cjs)                               │
│  - Creates window, preload, BrowserWindow                       │
│  - Starts worklet via pear-runtime or bare-sidecar              │
│  - Registers IPC handlers; forwards vault calls to vaultClient  │
└────────────────────────────┬────────────────────────────────────┘
                             │ stdio / IPC pipe
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Worklet (Bare sidecar)                                         │
│  - Runs vault logic (pearpass-lib-vault-core worklet)           │
│  - Dev: app.js (ESM). Packaged: app.cjs (CJS bundle)            │
└─────────────────────────────────────────────────────────────────┘
```

- **Renderer** never talks to the worklet directly. It calls `window.electronAPI.vaultInvoke(method, args)` (and runtime helpers). The **main process** receives those and forwards them to **PearpassVaultClient**, which speaks to the worklet over a pipe.
- The **worklet** runs in a separate process (Bare runtime). It uses `bare-*` modules and native addons; the main process only spawns it and connects IPC.

---

## 2. Main process (electron/main.cjs)

- **Entry:** `main` in package.json points to `electron/main.cjs`.
- **On ready:** Sets log path, registers IPC, then starts the runtime via `startRuntime()` and finally creates the main window.
- **Runtime start:**
  - If `runtime-config.cjs.upgrade` is set: uses **pear-runtime** (P2P OTA), configures storage based on `pear-runtime-legacy-storage`, and calls `PearRuntime.run(workletPath)` to launch the vault worklet as a sidecar.
  - If no upgrade link is set: uses **bare-sidecar** only (`startWorkletOnly()`), spawns the worklet with `new Sidecar(workletPath)` and runs without P2P updates.
- **Storage layout:** Tries to reuse existing Pear platform storage via `pear-runtime-legacy-storage`. If none is found, it falls back to `app.getPath('userData')/app-storage/by-dkey/<upgrade-key>`.
- **Flatpak compatibility:** `electron/flatpak-paths.cjs` wraps both `app.getPath('userData')` and any legacy Pear storage path with `getSandboxSafePath()`. Inside Flatpak, host-mapped XDG paths under `~/.var/app/...` are remapped into `~/.config/...` compatibility paths so the vault worklet accepts them.
- **Packaged app:** With `asar: false` all code and `node_modules` live under `Contents/Resources/app/` on macOS, so the worklet and renderer resolve modules from the real filesystem (no `app.asar` indirection).
- **IPC:** Handles `runtime:getConfig`, `runtime:applyUpdate`, `runtime:restart`, `runtime:checkUpdated`, and `vault:invoke`. Vault methods are forwarded to `vaultClient`; Buffers are serialized as `{ __base64 }`. It also listens for `pearRuntime.updater` events and forwards `runtime:updating` / `runtime:updated` to the renderer to drive the OTA UI.

---

## 3. Worklet: dev vs packaged

The vault worklet lives in `lockwright-lib-vault-core` (Git dependency) under `src/worklet/`. It is loaded in two different ways so it works in both dev and packaged app.

### 3.1 Dev

- **Path:** `getWorkletPath()` returns  
  `app.getAppPath()/node_modules/lockwright-lib-vault-core/src/worklet/app.js`.
- **Format:** ESM (`app.js`). The Bare loader in dev can run ESM and resolve Node built-ins to its own shims.
- **No bundle:** Dependencies are required from the real `node_modules` tree.

### 3.2 Packaged

- **Path:** `getWorkletPath()` returns  
  `process.resourcesPath/app/node_modules/lockwright-lib-vault-core/src/worklet/app.cjs`.
- **Format:** CommonJS bundle (`app.cjs`). The Bare runtime used in the packaged app loads the entry as CJS; giving it ESM `app.js` would throw “Cannot use import statement outside a module”.
- **Bundle:** Produced by `scripts/build.worklet.mjs` (see below). Only the worklet **source** (relative imports) is bundled; all `node_modules` are external so Bare resolves them at runtime and native addons work.

---

## 4. Worklet build (scripts/build.worklet.mjs)

- **Runs as part of `npm run build`** (before `tsc` and the renderer bundle).
- **Input:** `node_modules/lockwright-lib-vault-core/src/worklet/app.js` (ESM).
- **Output:** `node_modules/lockwright-lib-vault-core/src/worklet/app.cjs` (single CJS file).
- **Behaviour (current esbuild config):**
  - `entryPoints`: the ESM worklet entry; `bundle: true`, `platform: 'node'`, `format: 'cjs'`, `target: 'node18'`.
  - **Externalize Node built-ins and native-heavy modules:** `fs`, `path`, `os`, `net`, `crypto`, `child_process`, `fs/promises`, `require-addon`, `fs-native-extensions`, `sodium-native` are marked as `external` so they resolve at runtime from `node_modules`.
- **Result:** A CJS bundle that contains only the worklet code; at runtime Bare loads its dependencies from `node_modules` in the packaged app.

---

## 5. Packaging (no asar; electron-builder on every platform)

- **asar:** Disabled (`"asar": false` in `build`). All app code and `node_modules` are real files on disk (no `app.asar`), so the worklet and renderer always resolve modules from the filesystem.
- **Why no asar:** Electron patches the Node `fs` module so any access to `*.asar` is routed through its ASAR reader. During OTA on macOS, `pear-runtime-updater` mirrors a partially written `app.asar` into the `next` directory; Electron’s patched `fs` then tries to treat that in‑progress file as a valid ASAR and throws `Error: Invalid package ...app.asar`. Turning asar off avoids this class of error and lets the updater see only plain files.

### 5.1 macOS (electron-builder)

- **Tooling:** `electron-builder@23.6.0`.
- **Build commands:** `npm run dist:mac` (local) and `npm run dist:mac:ci` (CI).
- **Pipeline:**
  - `npm run build` → worklet bundle + `tsc` + renderer bundle (`dist/renderer.bundle.js`).
  - `npx electron-builder --mac` → `dist/mac-arm64/Lockwright.app` + DMG.
  - CI uses `scripts/notarize.cjs` as an `afterSign` hook (`@electron/notarize` + `notarytool`) to sign and notarize the app.

### 5.2 Windows (electron-builder, NSIS)

- **Tooling:** electron-builder with `electron-builder.win.json` (`nsis` target).
- **Build commands:** `pnpm run dist:win:nsis:x64` and `pnpm run dist:win:nsis:arm64` → `out/Lockwright-Setup-<version>-<arch>.exe`.
- **Pear layout:** `PearRuntime` in `electron/main.cjs` names the Windows artifact `<productName>.exe` (`.msix` only when `process.windowsStore`).
- `build-assets/win/AppxManifest.xml` has no packager. It stays because the App version sync and `scripts/apply-flavor.mjs` still write it.

---

## 6. Preload (electron/preload.cjs)

- **Attached to the renderer** via `webPreferences.preload`. The page is context-isolated and sandboxed (`nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`), so the preload is the only bridge: it exposes `window.electronAPI` through `contextBridge.exposeInMainWorld` and never hands out `ipcRenderer` itself.
- **Renderer API** (`window.electronAPI`):
  - Runtime: `getConfig`, `applyUpdate`, `restart`, `checkUpdated`, `onRuntimeUpdating`, `onRuntimeUpdated`
  - Vault: `vaultInvoke(method, args)`, `vaultOnUpdate(cb)`, `vaultOnMasterUpdate(cb)`, `vaultOnPersonalSwarmEnvelope(cb)`, `clearStaleVaultsDir`
  - Shell and logs: `openExternal`, `openLogsFolder`, `isLoggingEnabled`, `setLogging`, `logError`, `clearClipboardAfter`
  - Native messaging: `nativeMessaging.*`, `onNativeMessagingEvent(cb)`, `setNativeMessagingPrefs(prefs)`
- Every `on*` subscription returns an unsubscribe function and passes page callbacks only the payload, never the `IpcRendererEvent`.
- The `Pear` global that `usePearUpdate` reads is built in `app.electron.tsx` from `electronAPI`, not by the preload.

---

## 7. Renderer → main → worklet flow

1. Renderer calls e.g. `window.electronAPI.vaultInvoke('someMethod', [arg1, arg2])`.
2. Preload forwards to `ipcRenderer.invoke('vault:invoke', { method, args })`.
3. Main process `ipcMain.handle('vault:invoke', …)` receives it, gets `vaultClient[method]`, deserializes args (e.g. `__base64` → Buffer), calls the method on `vaultClient`.
4. `PearpassVaultClient` sends the call over the pipe to the worklet; worklet runs the vault logic and replies.
5. Main process serializes the result (e.g. Buffer → `__base64`) and returns to the renderer.

---

## 8. Key files reference

| Role                           | File                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------- |
| Main process                   | `electron/main.cjs`                                                              |
| Preload                        | `electron/preload.cjs`                                                           |
| Flatpak path helper            | `electron/flatpak-paths.cjs`                                                     |
| Worklet entry (ESM)            | `node_modules/lockwright-lib-vault-core/src/worklet/app.js`              |
| Worklet bundle (CJS, packaged) | `node_modules/lockwright-lib-vault-core/src/worklet/app.cjs` (generated) |
| Worklet build script           | `scripts/build.worklet.mjs`                                                      |
| Renderer bundle                | `scripts/bundle-renderer.mjs` → `dist/renderer.bundle.js`                        |
| Build pipeline                 | `package.json` scripts: `build`, `dist:*`                                        |

---

## 9. Troubleshooting

- **“Cannot use import statement outside a module” in packaged app**  
  Packaged app must run the CJS worklet (`app.cjs`). Ensure `npm run build` runs the worklet build and `getWorkletPath()` returns `.../app.cjs` when `app.isPackaged` is true.

- **“MODULE_NOT_FOUND” for a package when running from DMG /Applications**  
  With `asar: false` this usually means the package was not included in `build.files` or was only a devDependency. Ensure it is a runtime dependency and matched by `build.files`.

- **“ADDON_NOT_FOUND” for a native addon**  
  The worklet bundle must not inline that package. Ensure the module is in the `external` list in `scripts/build.worklet.mjs` (so it is loaded from `node_modules` at runtime) and that the native binary is present in the packaged app.

- **Flatpak build starts but vault/worklet storage init fails**  
  Ensure `electron/main.cjs` still routes both `app.getPath('userData')` and `pear-runtime-legacy-storage` results through `getSandboxSafePath()` from `electron/flatpak-paths.cjs`. Flatpak commonly exposes XDG directories under `~/.var/app/...`, which the worklet rejects unless they are remapped to the approved `~/.config/...` compatibility location.

- **OTA update appears stuck on Windows**  
  Confirm that the Pear drive for `by-arch/win32-x64/app/...` contains a valid `.exe` and that the filename matches the `name` passed to `PearRuntime` in `electron/main.cjs`.
