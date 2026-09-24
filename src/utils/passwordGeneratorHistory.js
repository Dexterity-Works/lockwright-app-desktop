import { pearpassVaultClient } from 'lockwright-lib-vault/src/instances'
import { generateUniqueId } from 'lockwright-utils-generate-unique-id'

/**
 * Password generator history — shared vault key for extension / desktop / Android.
 *
 * Keep this contract in sync with
 * pearpass-app-browser-extension/src/shared/utils/passwordGeneratorHistory.js
 *
 * Key: `app/password-generator-history`
 * Document: `{ entries: HistoryEntry[] }` (newest first)
 *
 * Entry shape (additive optional fields for labeled use):
 * `{ id, value, createdAt, contextLabel?, contextKind?: 'site'|'entry', usedAt?, uses? }`
 * `uses` is every distinct site or entry this value was used for.
 * `contextLabel` stays the latest use so older readers still show one label.
 *
 * Contract:
 * - `appendHistory(value)` — unlabeled generate events (no context). * - `markHistoryUsed(value, { contextLabel, contextKind } | { uses, onlyExisting? })`
 *   — stamp on USE (fill/insert) or on save of a record that already contains
 *   this generated value. Not bare Copy from the sidebar Generator page.
 *   Finds the newest entry with the same value (creates one if missing, unless
 *   `onlyExisting`), appends each distinct label, persists via activeVaultAdd,
 *   caps entries at 500.
 */
export const PASSWORD_GENERATOR_HISTORY_KEY = 'app/password-generator-history'
export const PASSWORD_GENERATOR_HISTORY_MAX = 500

const emptyDoc = () => ({ entries: [] })

const normalizeEntries = (raw) => {
  if (Array.isArray(raw?.entries)) return raw.entries
  if (Array.isArray(raw)) return raw
  return []
}

/**
 * @returns {Promise<Array<{ id: string, value: string, createdAt: number, contextLabel?: string, contextKind?: 'site'|'entry', usedAt?: number }>>}
 */
export const loadHistory = async () => {
  try {
    const raw = await pearpassVaultClient.activeVaultGet(
      PASSWORD_GENERATOR_HISTORY_KEY
    )
    return normalizeEntries(raw)
  } catch {
    return []
  }
}

/**
 * Prepend a generated password. Skips when newest entry has the same value.
 * Caps at PASSWORD_GENERATOR_HISTORY_MAX.
 *
 * @param {string} value
 * @returns {Promise<Array>}
 */
export const appendHistory = async (value) => {
  if (typeof value !== 'string' || !value) {
    return loadHistory()
  }

  const current = await loadHistory()
  if (current[0]?.value === value) {
    return current
  }

  const next = [
    { id: generateUniqueId(), value, createdAt: Date.now() },
    ...current
  ].slice(0, PASSWORD_GENERATOR_HISTORY_MAX)

  await pearpassVaultClient.activeVaultAdd(PASSWORD_GENERATOR_HISTORY_KEY, {
    entries: next
  })
  return next
}

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
export const markHistoryUsed = async (value, context = {}) => {
  if (typeof value !== 'string' || !value) {
    return loadHistory()
  }

  const uses = incomingUses(context)
  if (!uses.length) {
    return loadHistory()
  }

  const current = await loadHistory()
  const usedAt = Date.now()
  const matchIndex = current.findIndex((entry) => entry.value === value)

  let next
  if (matchIndex === -1) {
    if (context.onlyExisting) {
      return current
    }
    next = [
      stampEntry(
        {
          id: generateUniqueId(),
          value,
          createdAt: usedAt
        },
        mergeUses([], uses, usedAt),
        usedAt
      ),
      ...current
    ].slice(0, PASSWORD_GENERATOR_HISTORY_MAX)
  } else {
    next = current.map((entry, index) =>
      index === matchIndex
        ? stampEntry(entry, mergeUses(priorUses(entry), uses, usedAt), usedAt)
        : entry
    )
  }

  await pearpassVaultClient.activeVaultAdd(PASSWORD_GENERATOR_HISTORY_KEY, {
    entries: next
  })
  return next
}

/**
 * @returns {Promise<Array>}
 */
export const clearHistory = async () => {
  await pearpassVaultClient.activeVaultAdd(
    PASSWORD_GENERATOR_HISTORY_KEY,
    emptyDoc()
  )
  return []
}
