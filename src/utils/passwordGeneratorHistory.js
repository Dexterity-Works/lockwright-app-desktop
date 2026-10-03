import { pearpassVaultClient } from 'lockwright-lib-vault/src/instances'
import { generateUniqueId } from 'lockwright-utils-generate-unique-id'

/**
 * Password generator history — shared vault key for extension / desktop / Android.
 *
 * Keep this contract in sync with
 * pearpass-app-browser-extension/src/shared/utils/passwordGeneratorHistory.js
 *
 * Key per entry: `app/password-generator-history/<id>` → one HistoryEntry.
 * Autopass is last write wins per key, so each write touches only the entries
 * it changes. A device that is behind or writing at the same time can no
 * longer overwrite another device's history.
 * Legacy key: `app/password-generator-history` → `{ entries: HistoryEntry[] }`.
 * loadHistory moves it into per-entry keys and removes it.
 * Tombstone per cleared id: `app/password-generator-history/cleared/<id>` →
 * `{ cleared: id }`. Reads hide that id and remove its entry key, and the
 * legacy move skips it, so a device that is behind cannot bring it back.
 * Ids, not clocks, so clock skew never hides a new password.
 * Writes from one process run one at a time, so a generate and a use of the
 * same password cannot both insert a row.
 *
 * Entry shape (additive optional fields for labeled use):
 * `{ id, value, createdAt, contextLabel?, contextKind?: 'site'|'entry', usedAt?, uses? }`
 * `uses` is every distinct site or entry this value was used for.
 * `contextLabel` stays the latest use so older readers still show one label.
 *
 * Contract:
 * - `appendHistory(value)` — unlabeled generate events (no context).
 * - `markHistoryUsed(value, { contextLabel, contextKind } | { uses, onlyExisting? })`
 *   — stamp on USE (fill/insert) or on save of a record that already contains
 *   this generated value. Not bare Copy from the sidebar Generator page.
 *   Finds the newest entry with the same value (creates one if missing, unless
 *   `onlyExisting`), appends each distinct label, rewrites only that
 *   entry's key, caps entries at 500.
 */
export const PASSWORD_GENERATOR_HISTORY_KEY = 'app/password-generator-history'
export const PASSWORD_GENERATOR_HISTORY_MAX = 500

// Trailing slash keeps the legacy key out of the listing.
const ENTRY_PREFIX = `${PASSWORD_GENERATOR_HISTORY_KEY}/`

const entryKey = (id) => `${ENTRY_PREFIX}${id}`
// Same prefix, so the one entry listing also returns the tombstones.
const clearedKey = (id) => `${ENTRY_PREFIX}cleared/${id}`

const normalizeEntries = (raw) => {
  if (Array.isArray(raw?.entries)) return raw.entries
  if (Array.isArray(raw)) return raw
  return []
}

const isEntry = (entry) =>
  typeof entry?.id === 'string' && !!entry.id && typeof entry.value === 'string'

// Id breaks ties so every device prunes the same keys.
const newestFirst = (a, b) =>
  (b.createdAt ?? 0) - (a.createdAt ?? 0) ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

// After the newest stored entry, so a clock that is behind cannot sort a new
// password last and prune it. `current` is newest first.
const nextCreatedAt = (current) =>
  Math.max(Date.now(), (current[0]?.createdAt ?? 0) + 1)

const isCleared = (value) =>
  typeof value?.cleared === 'string' && !!value.cleared

// Serializes this process's history writes so concurrent callers see each other.
let tail = Promise.resolve()
const serial =
  (fn) =>
  (...args) => {
    const run = tail.then(() => fn(...args))
    tail = run.catch(() => {})
    return run
  }

const listHistory = async () => {
  // ponytail: activeVaultList scans the whole view and loads all history. Upgrade when history load gets slow on large vaults: range scan API.
  const listed = await pearpassVaultClient.activeVaultList(ENTRY_PREFIX)
  const values = Array.isArray(listed) ? listed : []
  return {
    entries: values.filter(isEntry),
    cleared: new Set(values.filter(isCleared).map((value) => value.cleared))
  }
}

const readLegacy = async () =>
  normalizeEntries(
    await pearpassVaultClient.activeVaultGet(PASSWORD_GENERATOR_HISTORY_KEY)
  ).filter(isEntry)

/**
 * Every entry, newest first, uncapped. Moves the legacy array into per-entry
 * keys, then removes it. Ids are stable, so repeat or concurrent runs converge.
 * Drops cleared ids and removes their keys if a device that was behind wrote
 * them back.
 */
const readEntries = async () => {
  const { entries, cleared } = await listHistory()
  const byId = new Map()
  const revived = []
  for (const entry of entries) {
    if (cleared.has(entry.id)) revived.push(entry.id)
    else byId.set(entry.id, entry)
  }
  await Promise.all(
    revived.map((id) => pearpassVaultClient.activeVaultRemove(entryKey(id)))
  )

  const legacy = await readLegacy()
  if (legacy.length) {
    const missing = legacy.filter(
      (entry) => !byId.has(entry.id) && !cleared.has(entry.id)
    )
    await Promise.all(
      missing.map((entry) =>
        pearpassVaultClient.activeVaultAdd(entryKey(entry.id), entry)
      )
    )
    for (const entry of missing) byId.set(entry.id, entry)
    await pearpassVaultClient.activeVaultRemove(PASSWORD_GENERATOR_HISTORY_KEY)
  }

  return [...byId.values()].sort(newestFirst)
}

const readEntriesOrEmpty = async () => {
  try {
    return await readEntries()
  } catch {
    return []
  }
}

/**
 * Writes one new entry key, then removes only the keys past the cap.
 *
 * @returns {Promise<Array>} newest first, capped
 */
const addEntry = async (entry, current) => {
  await pearpassVaultClient.activeVaultAdd(entryKey(entry.id), entry)
  const next = [entry, ...current].sort(newestFirst)
  await Promise.all(
    next
      .slice(PASSWORD_GENERATOR_HISTORY_MAX)
      .map((old) => pearpassVaultClient.activeVaultRemove(entryKey(old.id)))
  )
  return next.slice(0, PASSWORD_GENERATOR_HISTORY_MAX)
}

/**
 * @returns {Promise<Array<{ id: string, value: string, createdAt: number, contextLabel?: string, contextKind?: 'site'|'entry', usedAt?: number }>>}
 */
const load = async () =>
  (await readEntriesOrEmpty()).slice(0, PASSWORD_GENERATOR_HISTORY_MAX)

export const loadHistory = serial(load)

/**
 * Add a generated password. Skips when newest entry has the same value.
 * Caps at PASSWORD_GENERATOR_HISTORY_MAX.
 *
 * @param {string} value
 * @returns {Promise<Array>}
 */
export const appendHistory = serial(async (value) => {
  if (typeof value !== 'string' || !value) {
    return load()
  }

  const current = await readEntriesOrEmpty()
  if (current[0]?.value === value) {
    return current.slice(0, PASSWORD_GENERATOR_HISTORY_MAX)
  }

  return addEntry(
    { id: generateUniqueId(), value, createdAt: nextCreatedAt(current) },
    current
  )
})

const asUse = (use) => {
  const contextLabel =
    typeof use?.contextLabel === 'string' ? use.contextLabel.trim() : ''
  const contextKind = use?.contextKind
  if (!contextLabel || (contextKind !== 'site' && contextKind !== 'entry')) {
    return null
  }
  return { contextLabel, contextKind }
}

const incomingUses = (context) => {
  if (Array.isArray(context?.uses)) {
    return context.uses.map(asUse).filter(Boolean)
  }
  const one = asUse(context)
  return one ? [one] : []
}

const priorUses = (entry) => {
  if (Array.isArray(entry?.uses) && entry.uses.length) {
    return entry.uses.map(asUse).filter(Boolean)
  }
  const legacy = asUse(entry)
  return legacy ? [legacy] : []
}

const hostnameFromUrl = (url) => {
  if (typeof url !== 'string' || !url.trim()) return ''
  const trimmed = url.trim()
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  try {
    return new URL(withScheme).hostname || ''
  } catch {
    return ''
  }
}

/**
 * Site hostname and entry title, when each is present.
 *
 * @param {{ title?: unknown, websiteUrl?: unknown }} [input]
 * @returns {Array<{ contextLabel: string, contextKind: 'site'|'entry' }>}
 */
export const historyUses = ({ title, websiteUrl } = {}) => {
  const uses = []
  const hostname = hostnameFromUrl(websiteUrl)
  if (hostname) {
    uses.push({ contextLabel: hostname, contextKind: 'site' })
  }
  const label = typeof title === 'string' ? title.trim() : ''
  if (label && label !== hostname) {
    uses.push({ contextLabel: label, contextKind: 'entry' })
  }
  return uses
}

/**
 * Labels to show on a history row. Falls back to the legacy single label.
 *
 * @param {{ uses?: Array<{ contextLabel?: string }>, contextLabel?: string }} [entry]
 * @returns {string[]}
 */
export const historyUseLabels = (entry) => {
  if (Array.isArray(entry?.uses) && entry.uses.length) {
    return entry.uses
      .map((use) =>
        typeof use?.contextLabel === 'string' ? use.contextLabel : ''
      )
      .filter(Boolean)
  }
  return typeof entry?.contextLabel === 'string' && entry.contextLabel
    ? [entry.contextLabel]
    : []
}

/**
 * Stamped labels plus the site and title of every vault record whose password
 * is this value. Covers passwords saved before stamping existed. Display only,
 * never written back.
 *
 * @param {{ value?: string, uses?: Array<{ contextLabel?: string }>, contextLabel?: string }} [entry]
 * @param {Array<{ data?: { title?: unknown, password?: unknown, websites?: unknown[] } }>} [records]
 * @returns {string[]}
 */
export const historyEntryLabels = (entry, records) => {
  const labels = historyUseLabels(entry)
  if (entry?.value && Array.isArray(records)) {
    for (const record of records) {
      if (record?.data?.password !== entry.value) continue
      const websites = record.data.websites
      for (const use of historyUses({
        title: record.data.title,
        websiteUrl: Array.isArray(websites) ? websites[0] : undefined
      })) {
        labels.push(use.contextLabel)
      }
    }
  }
  return [...new Set(labels)]
}

// ponytail: distinct labels only, cap 20. Drop oldest when a reused password is tagged past that.
const USES_MAX = 20

const mergeUses = (prior, incoming, usedAt) => {
  let next = prior.map((use) => ({ ...use }))
  for (const use of incoming) {
    const index = next.findIndex(
      (item) =>
        item.contextKind === use.contextKind &&
        item.contextLabel === use.contextLabel
    )
    const stamped = { ...use, usedAt }
    if (index === -1) {
      next = [...next, stamped].slice(-USES_MAX)
    } else {
      next = next.map((item, i) => (i === index ? stamped : item))
    }
  }
  return next
}

const stampEntry = (entry, uses, usedAt) => {
  const latest = uses[uses.length - 1]
  return {
    ...entry,
    contextLabel: latest.contextLabel,
    contextKind: latest.contextKind,
    usedAt,
    uses
  }
}

/**
 * Stamp context on USE or save. Keeps every distinct site and entry.
 *
 * @param {string} value
 * @param {{ contextLabel?: string, contextKind?: 'site'|'entry', uses?: Array<{ contextLabel: string, contextKind: 'site'|'entry' }>, onlyExisting?: boolean }} [context]
 * @returns {Promise<Array>}
 */
export const markHistoryUsed = serial(async (value, context = {}) => {
  if (typeof value !== 'string' || !value) {
    return load()
  }

  const uses = incomingUses(context)
  if (!uses.length) {
    return load()
  }

  const current = await readEntriesOrEmpty()
  const usedAt = Date.now()
  const match = current.find((entry) => entry.value === value)

  if (!match) {
    if (context.onlyExisting) {
      return current.slice(0, PASSWORD_GENERATOR_HISTORY_MAX)
    }
    return addEntry(
      stampEntry(
        {
          id: generateUniqueId(),
          value,
          createdAt: nextCreatedAt(current)
        },
        mergeUses([], uses, usedAt),
        usedAt
      ),
      current
    )
  }

  const stamped = stampEntry(
    match,
    mergeUses(priorUses(match), uses, usedAt),
    usedAt
  )
  await pearpassVaultClient.activeVaultAdd(entryKey(stamped.id), stamped)
  return current
    .map((entry) => (entry === match ? stamped : entry))
    .slice(0, PASSWORD_GENERATOR_HISTORY_MAX)
})

/**
 * Tombstones every listed and legacy id, then removes their entry keys and
 * the legacy key.
 *
 * @returns {Promise<Array>}
 */
export const clearHistory = serial(async () => {
  const { entries } = await listHistory()
  const ids = new Set(
    [...entries, ...(await readLegacy())].map((entry) => entry.id)
  )
  // ponytail: tombstones are never pruned. Prune them once the legacy key is retired (every device on per-entry keys).
  await Promise.all(
    [...ids].map((id) =>
      pearpassVaultClient.activeVaultAdd(clearedKey(id), { cleared: id })
    )
  )
  await Promise.all(
    [...ids].map((id) => pearpassVaultClient.activeVaultRemove(entryKey(id)))
  )
  await pearpassVaultClient.activeVaultRemove(PASSWORD_GENERATOR_HISTORY_KEY)
  return []
})
