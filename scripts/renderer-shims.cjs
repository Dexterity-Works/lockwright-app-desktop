/**
 * What the renderer bundle gets in place of Node. The page runs sandboxed
 * with nodeIntegration off, so there is no require, process, or Buffer at
 * runtime; these esbuild options fill the two gaps the dependencies have.
 */
const path = require('path')

// kdbxweb's UMD header requires "crypto" unconditionally but only touches it
// when WebCrypto is missing, so it gets undefined instead of a runtime throw.
const nodeCryptoStub = {
  name: 'node-crypto-stub',
  setup(build) {
    build.onResolve({ filter: /^crypto$/ }, () => ({
      path: 'crypto',
      namespace: 'node-crypto-stub'
    }))
    build.onLoad({ filter: /.*/, namespace: 'node-crypto-stub' }, () => ({
      contents: 'module.exports = undefined',
      loader: 'js'
    }))
  }
}

const rendererShims = {
  plugins: [nodeCryptoStub],
  // lockwright-lib-vault and friends use the Buffer global
  inject: [path.join(__dirname, 'renderer-buffer-shim.js')]
}

module.exports = { rendererShims }
