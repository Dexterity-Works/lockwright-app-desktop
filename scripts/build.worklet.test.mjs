import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { workletAppEntry } from './build.worklet.mjs'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const renderer = fs.readFileSync(
  new URL('./bundle-renderer.mjs', import.meta.url),
  'utf8'
)

assert.equal(
  fs.existsSync(workletAppEntry),
  true,
  `worklet entry is not on disk: ${workletAppEntry}`
)
assert.equal(
  renderer.includes('pearpass-lib-ui-kit'),
  false,
  'bundle-renderer still names pearpass-lib-ui-kit'
)
assert.equal(
  fs.existsSync(
    path.join(root, 'node_modules', 'lockwright-lib-ui-react-native-components', 'dist')
  ),
  true
)
assert.equal(
  renderer.includes('lockwright-lib-ui-react-native-components'),
  true
)

console.log('ok')
