/**
 * @jest-environment node
 */
/* eslint-env jest */
/**
 * The renderer runs sandboxed with nodeIntegration off: no require, no
 * process, no Node Buffer. Build the bundle and prove it asks for none of
 * them, and that kdbxweb (which requires "crypto" in its UMD header) still
 * opens a database on WebCrypto alone.
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const { builtinModules } = require('module')
const os = require('os')
const path = require('path')

const root = path.join(__dirname, '..')
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lw-renderer-bundle-'))
const outfile = path.join(outDir, 'renderer.bundle.js')

afterAll(() => fs.rmSync(outDir, { recursive: true, force: true }))

describe('renderer bundle', () => {
  let source

  beforeAll(() => {
    execFileSync(
      process.execPath,
      [path.join(root, 'scripts', 'bundle-renderer.mjs'), '--outfile', outfile],
      { cwd: root, stdio: 'pipe' }
    )
    source = fs.readFileSync(outfile, 'utf8')
  }, 120000)

  it('leaves no Node builtin to resolve at runtime', () => {
    const builtins = new Set(
      builtinModules.flatMap((name) => [name, `node:${name}`])
    )
    const unresolved = [...source.matchAll(/__require\("([^"]+)"\)/g)]
      .map((match) => match[1])
      .filter((name) => builtins.has(name))
    expect(unresolved).toEqual([])
  })

  it('reads nothing off process or the module scope', () => {
    const nodeOnly = source.match(
      /\b(process\.(platform|cwd|argv|pid|exit|versions|execPath)|__dirname|__filename)\b/g
    )
    expect(nodeOnly).toBeNull()
  })

  it('carries its own Buffer', () => {
    expect(source).toMatch(/Buffer\d*\.TYPED_ARRAY_SUPPORT/)
  })
})

describe('kdbxweb without Node crypto', () => {
  it('opens a KeePass database on WebCrypto alone', async () => {
    const kdbxweb = require('kdbxweb')
    const credentials = new kdbxweb.Credentials(
      kdbxweb.ProtectedValue.fromString('hunter2')
    )
    const db = kdbxweb.Kdbx.create(credentials, 'fixture')
    db.setVersion(3)
    const entry = db.createEntry(db.getDefaultGroup())
    entry.fields.set('Title', 'Example')
    entry.fields.set('UserName', 'alice')
    const bytes = Buffer.from(await db.save())

    const esbuild = require('esbuild')
    const { rendererShims } = require('./renderer-shims.cjs')
    const built = await esbuild.build({
      stdin: {
        contents: `import { decryptKeePassKdbx, parseKeePassData } from 'lockwright-lib-data-import'
          globalThis.openKdbx = async (bytes, password) =>
            parseKeePassData(await decryptKeePassKdbx(bytes, password), 'kdbx')`,
        resolveDir: root,
        loader: 'js'
      },
      bundle: true,
      write: false,
      platform: 'browser',
      format: 'iife',
      absWorkingDir: root,
      ...rendererShims
    })

    // Same realm as WebCrypto (globalThis.crypto), with every Node global
    // the page lacks shadowed away
    const nodeGlobals = [
      'require',
      'process',
      'Buffer',
      'global',
      '__dirname',
      '__filename'
    ]
    new Function(...nodeGlobals, built.outputFiles[0].text)()
    try {
      const records = await globalThis.openKdbx(
        new Uint8Array(bytes),
        'hunter2'
      )
      expect(records).toEqual([
        expect.objectContaining({
          type: 'login',
          data: expect.objectContaining({ title: 'Example', username: 'alice' })
        })
      ])
    } finally {
      delete globalThis.openKdbx
    }
  }, 60000)
})
