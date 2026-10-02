/* eslint-env jest */

// The Forgejo superproject dispatches this workflow and finds the run by
// request_id, then downloads the lockwright-mac artifact. Plain-text checks:
// no YAML parser is a direct dependency.
const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '..', '.github/workflows/mac-build.yml')

const indentOf = (line) => line.match(/^ */)[0].length
const isContent = (line) => line.trim() !== '' && !line.trim().startsWith('#')

// Lines nested under the key on line i (deeper indent than that key).
function childLines(lines, i) {
  const base = indentOf(lines[i])
  const out = []
  for (let j = i + 1; j < lines.length; j++) {
    if (isContent(lines[j]) && indentOf(lines[j]) <= base) break
    out.push(lines[j])
  }
  return out
}

// Keys exactly one level below the key on line i.
function childKeys(lines, i) {
  const kids = childLines(lines, i).filter(isContent)
  const depth = Math.min(...kids.map(indentOf))
  return kids
    .filter((l) => indentOf(l) === depth)
    .map((l) => l.trim().replace(/:.*$/, ''))
}

describe('mac-build workflow', () => {
  const text = fs.readFileSync(file, 'utf8')
  const lines = text.split('\n')
  const at = (re) => lines.findIndex((l) => re.test(l))

  it('runs only on workflow_dispatch with the five string inputs', () => {
    const on = at(/^on:\s*$/)
    expect(on).toBeGreaterThanOrEqual(0)
    expect(childKeys(lines, on)).toEqual(['workflow_dispatch'])

    const inputs = at(/^ {4}inputs:\s*$/)
    expect(childKeys(lines, inputs)).toEqual([
      'request_id',
      'display',
      'desktop_sha',
      'vault_sha',
      'vault_core_sha'
    ])
    for (const name of childKeys(lines, inputs)) {
      const body = childLines(lines, at(new RegExp(`^ {6}${name}:`))).join('\n')
      expect(body).toMatch(/required: true/)
      expect(body).toMatch(/type: string/)
    }
  })

  it('names the run after display and request_id', () => {
    expect(text).toMatch(
      /^run-name: mac \$\{\{ inputs\.display \}\} \$\{\{ inputs\.request_id \}\}$/m
    )
  })

  it('reads only repository contents', () => {
    const perms = at(/^permissions:\s*$/)
    expect(childLines(lines, perms).filter(isContent)).toEqual([
      '  contents: read'
    ])
  })

  it('uploads a lockwright-mac artifact of the two DMGs', () => {
    expect(text).toMatch(/^ +name: lockwright-mac$/m)
    expect(text).toMatch(
      /Lockwright-\$\{DISPLAY_VERSION\}-mac-\$\{arch\}\$\{SUFFIX\}\.dmg/
    )
    expect(text).toMatch(/retention-days: 7/)
    expect(text).toMatch(/if-no-files-found: error/)
  })

  it('never interpolates inputs into a run script', () => {
    const runs = lines
      .map((l, i) => (/^\s*(- )?run:/.test(l) ? i : -1))
      .filter((i) => i >= 0)
    expect(runs.length).toBeGreaterThan(0)
    for (const i of runs) {
      const script = [lines[i], ...childLines(lines, i)].join('\n')
      expect(script).not.toMatch(/\$\{\{\s*inputs\./)
      expect(script).not.toMatch(/\$\{\{\s*secrets\./)
    }
  })

  it('pins every action to a full commit SHA', () => {
    const uses = lines.filter((l) => /^\s*(- )?uses:/.test(l))
    expect(uses.length).toBeGreaterThan(0)
    for (const l of uses) {
      expect(l).toMatch(/uses: [\w.-]+\/[\w.-]+@[0-9a-f]{40}\b/)
    }
  })
})
