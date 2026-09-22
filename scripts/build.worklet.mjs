#!/usr/bin/env node
/* eslint-disable no-underscore-dangle */
/**
 * Bundle the vault worklet (ESM) to CommonJS for the packaged app so Bare can run it.
 *
 * JS dependencies are bundled so dual majors (e.g. compact-encoding@2 vs @3) are
 * wired correctly by esbuild. Bare's packaged module resolution is cwd-rooted and
 * cannot see nested node_modules the way Node/pnpm do — leaving compact-encoding
 * external made hypercore load @2 from the app root and hang/decode-fail.
 *
 * Packages with native addons must stay external. If inlined into app.cjs,
 * `require.addon()` resolves relative to app.cjs and fails with ADDON_NOT_FOUND.
 */
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

import * as esbuild from 'esbuild'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const root = path.join(__dirname, '..')
export const workletAppEntry = path.join(
  root,
  'node_modules',
  'lockwright-lib-vault-core',
  'src',
  'worklet',
  'app.js'
)
const workletDir = path.dirname(workletAppEntry)

const NODE_TO_BARE = {
  fs: 'bare-fs',
  path: 'bare-path',
  buffer: 'bare-buffer',
  crypto: 'bare-crypto',
  os: 'bare-os'
}

function packageNameFromSpecifier(specifier) {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/')
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier
  }
  return specifier.split('/')[0]
}

function packageHasNativeAddon(packageName, resolveDir) {
  try {
    const pkgJsonPath = require.resolve(`${packageName}/package.json`, {
      paths: [resolveDir, root]
    })
    const pkgDir = path.dirname(pkgJsonPath)
    if (fs.existsSync(path.join(pkgDir, 'prebuilds'))) return true
    if (fs.existsSync(path.join(pkgDir, 'binding.js'))) return true
    if (fs.existsSync(path.join(pkgDir, 'binding.cjs'))) return true
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
    if (pkg.addon === true || pkg.binary) return true
    return false
  } catch {
    return false
  }
}

function shouldExternalize(name, resolveDir) {
  if (
    name.startsWith('bare-') ||
    name.endsWith('-native') ||
    name === 'sodium-native' ||
    name === 'rocksdb-native' ||
    name === 'udx-native' ||
    name === 'fs-native-extensions'
  ) {
    return true
  }
  return packageHasNativeAddon(name, resolveDir)
}

const externalizeNatives = {
  name: 'externalize-natives',
  setup(build) {
    // Map Node builtins to bare-* packages WITHOUT resolving them to absolute
    // paths (esbuild `alias` would inline those packages and break require.addon).
    build.onResolve({ filter: /^(fs|path|buffer|crypto|os)$/ }, (args) => ({
      path: NODE_TO_BARE[args.path],
      external: true
    }))

    build.onResolve({ filter: /^node:/ }, (args) => {
      const bare = args.path.slice('node:'.length)
      if (NODE_TO_BARE[bare]) {
        return { path: NODE_TO_BARE[bare], external: true }
      }
      return null
    })

    build.onResolve({ filter: /^[^./]/ }, (args) => {
      // Skip Windows absolute paths (e.g. C:\, F:\)
      if (/^[A-Za-z]:[/\\]/.test(args.path)) return null
      const name = packageNameFromSpecifier(args.path)
      if (shouldExternalize(name, args.resolveDir || root)) {
        return { path: args.path, external: true }
      }
      return null
    })
  }
}

async function buildWorklet() {
  await esbuild.build({
    entryPoints: [workletAppEntry],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    outfile: path.join(workletDir, 'app.cjs'),
    plugins: [externalizeNatives],
    logLevel: 'info'
  })

  const outPath = path.join(workletDir, 'app.cjs')
  const out = fs.readFileSync(outPath, 'utf8')
  if (out.includes('require.addon(') || out.includes('require.addon()')) {
    throw new Error(
      'worklet bundle still contains require.addon() — a native package was inlined'
    )
  }
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  buildWorklet()
}
