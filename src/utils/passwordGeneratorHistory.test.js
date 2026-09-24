import {
  PASSWORD_GENERATOR_HISTORY_KEY,
  PASSWORD_GENERATOR_HISTORY_MAX,
  appendHistory,
  clearHistory,
  historyEntryLabels,
  historyUseLabels,
  historyUses,
  loadHistory,
  markHistoryUsed
} from './passwordGeneratorHistory'

// One Map stands in for the vault. `mockStale` hides it from reads, like a
// device whose view has not caught up with the others yet.
const mockStore = new Map()
let mockStale = false
let mockIdCounter = 0
const mockView = () => (mockStale ? new Map() : mockStore)
const mockVault = {
  activeVaultGet: jest.fn(async (key) => mockView().get(key)),
  activeVaultList: jest.fn(async (prefix) =>
    [...mockView()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, value]) => value)
  ),
  activeVaultAdd: jest.fn(async (key, data) => {
    mockStore.set(key, data)
  }),
  activeVaultRemove: jest.fn(async (key) => {
    mockStore.delete(key)
  })
}

jest.mock('lockwright-lib-vault/src/instances', () => ({
  get pearpassVaultClient() {
    return mockVault
  }
}))

jest.mock('lockwright-utils-generate-unique-id', () => ({
  generateUniqueId: () => `id-${++mockIdCounter}`
}))
const ENTRY_PREFIX = `${PASSWORD_GENERATOR_HISTORY_KEY}/`
const entryKey = (id) => `${ENTRY_PREFIX}${id}`
const seed = (...entries) => {
  for (const entry of entries) mockStore.set(entryKey(entry.id), entry)
}
const historyKeys = () =>
  [...mockStore.keys()]
    .filter((key) => key.startsWith(PASSWORD_GENERATOR_HISTORY_KEY))
    .sort()
// Newest first: e-0 is the newest, the last one is the oldest.
const filled = () =>
  Array.from({ length: PASSWORD_GENERATOR_HISTORY_MAX }, (_, i) => ({
    id: `e-${i}`,
    value: `v-${i}`,
    createdAt: PASSWORD_GENERATOR_HISTORY_MAX - i
  }))

describe('passwordGeneratorHistory', () => {
  beforeEach(() => {
    mockIdCounter = 0
    mockStore.clear()
    mockStale = false
    jest.clearAllMocks()
  })

  describe('loadHistory', () => {
    it('returns per-entry keys newest first', async () => {
      seed(
        { id: 'a', value: 'old', createdAt: 1 },
        { id: 'b', value: 'new', createdAt: 2 }
      )

      await expect(loadHistory()).resolves.toEqual([
        { id: 'b', value: 'new', createdAt: 2 },
        { id: 'a', value: 'old', createdAt: 1 }
      ])
      expect(mockVault.activeVaultList).toHaveBeenCalledWith(ENTRY_PREFIX)
    })

    it('returns empty array when the vault read fails', async () => {
      mockVault.activeVaultList.mockRejectedValueOnce(new Error('vault closed'))
      await expect(loadHistory()).resolves.toEqual([])
    })

    it('returns empty array when nothing is stored', async () => {
      await expect(loadHistory()).resolves.toEqual([])
    })

    it('moves the legacy array into per-entry keys, idempotently', async () => {
      mockStore.set(PASSWORD_GENERATOR_HISTORY_KEY, {
        entries: [
          { id: 'a', value: 'pw', createdAt: 2 },
          { id: 'b', value: 'other', createdAt: 1 }
        ]
      })
      seed({ id: 'a', value: 'pw', createdAt: 2, usedAt: 5 })

      const first = await loadHistory()

      expect(first).toEqual([
        { id: 'a', value: 'pw', createdAt: 2, usedAt: 5 },
        { id: 'b', value: 'other', createdAt: 1 }
      ])
      expect(historyKeys()).toEqual([entryKey('a'), entryKey('b')])
      await expect(loadHistory()).resolves.toEqual(first)
      expect(historyKeys()).toEqual([entryKey('a'), entryKey('b')])
    })

    it('accepts a bare array legacy document', async () => {
      mockStore.set(PASSWORD_GENERATOR_HISTORY_KEY, [
        { id: 'a', value: 'pw', createdAt: 1 }
      ])
      await expect(loadHistory()).resolves.toEqual([
        { id: 'a', value: 'pw', createdAt: 1 }
      ])
      expect(historyKeys()).toEqual([entryKey('a')])
    })

    it('keeps the legacy array when migration fails', async () => {
      mockStore.set(PASSWORD_GENERATOR_HISTORY_KEY, {
        entries: [{ id: 'a', value: 'pw', createdAt: 1 }]
      })
      mockVault.activeVaultAdd.mockRejectedValueOnce(new Error('write failed'))

      await expect(loadHistory()).resolves.toEqual([])
      expect(mockStore.has(PASSWORD_GENERATOR_HISTORY_KEY)).toBe(true)
    })
  })

  describe('appendHistory', () => {
    it('writes only the new entry key', async () => {
      seed({ id: 'old', value: 'a', createdAt: 1 })

      const next = await appendHistory('b')

      expect(next[0]).toMatchObject({ id: 'id-1', value: 'b' })
      expect(next[0].contextLabel).toBeUndefined()
      expect(next[1]).toEqual({ id: 'old', value: 'a', createdAt: 1 })
      expect(mockVault.activeVaultAdd).toHaveBeenCalledTimes(1)
      expect(mockVault.activeVaultAdd).toHaveBeenCalledWith(
        entryKey('id-1'),
        next[0]
      )
    })

    it("keeps another device's entry when this view has not synced it", async () => {
      await appendHistory('from-a')
      mockStale = true
      await appendHistory('from-b')
      mockStale = false

      const values = (await loadHistory()).map((entry) => entry.value)
      expect(values.sort()).toEqual(['from-a', 'from-b'])
      expect(historyKeys()).toEqual([entryKey('id-1'), entryKey('id-2')])
    })

    it('skips when newest value is identical (dedupe)', async () => {
      const existing = { id: 'a', value: 'same', createdAt: 1 }
      seed(existing)

      const next = await appendHistory('same')

      expect(next).toEqual([existing])
      expect(mockVault.activeVaultAdd).not.toHaveBeenCalled()
    })

    it('prunes only the keys past the cap', async () => {
      seed(...filled())

      const next = await appendHistory('brand-new')

      expect(next).toHaveLength(PASSWORD_GENERATOR_HISTORY_MAX)
      expect(next[0].value).toBe('brand-new')
      expect(next[next.length - 1].value).toBe(
        `v-${PASSWORD_GENERATOR_HISTORY_MAX - 2}`
      )
      expect(mockVault.activeVaultRemove).toHaveBeenCalledTimes(1)
      expect(mockVault.activeVaultRemove).toHaveBeenCalledWith(
        entryKey(`e-${PASSWORD_GENERATOR_HISTORY_MAX - 1}`)
      )
      expect(historyKeys()).toHaveLength(PASSWORD_GENERATOR_HISTORY_MAX)
    })

    it('does not persist empty values', async () => {
      await appendHistory('')
      expect(mockVault.activeVaultAdd).not.toHaveBeenCalled()
    })
  })

  describe('markHistoryUsed', () => {
    it('updates the newest matching value, rewriting only its key', async () => {
      seed(
        { id: 'newer', value: 'same', createdAt: 2 },
        { id: 'older', value: 'same', createdAt: 1 }
      )

      const next = await markHistoryUsed('same', {
        contextLabel: 'example.com',
        contextKind: 'site'
      })

      expect(next[0]).toMatchObject({
        id: 'newer',
        value: 'same',
        contextLabel: 'example.com',
        contextKind: 'site'
      })
      expect(next[0].usedAt).toEqual(expect.any(Number))
      expect(next[1]).toEqual({ id: 'older', value: 'same', createdAt: 1 })
      expect(mockVault.activeVaultAdd).toHaveBeenCalledTimes(1)
      expect(mockVault.activeVaultAdd).toHaveBeenCalledWith(
        entryKey('newer'),
        next[0]
      )
    })

    it('creates an entry when value is absent', async () => {
      seed({ id: 'a', value: 'other', createdAt: 1 })

      const next = await markHistoryUsed('brand-new', {
        contextLabel: 'My Login',
        contextKind: 'entry'
      })

      expect(next[0]).toMatchObject({
        id: 'id-1',
        value: 'brand-new',
        contextLabel: 'My Login',
        contextKind: 'entry'
      })
      expect(next[0].createdAt).toEqual(expect.any(Number))
      expect(next[0].usedAt).toEqual(expect.any(Number))
      expect(next[1]).toEqual({ id: 'a', value: 'other', createdAt: 1 })
      expect(mockVault.activeVaultAdd).toHaveBeenCalledWith(
        entryKey('id-1'),
        next[0]
      )
    })

    it('caps history at MAX when creating a missing value', async () => {
      seed(...filled())

      const next = await markHistoryUsed('brand-new', {
        contextLabel: 'site.example',
        contextKind: 'site'
      })

      expect(next).toHaveLength(PASSWORD_GENERATOR_HISTORY_MAX)
      expect(next[0].value).toBe('brand-new')
      expect(next[next.length - 1].value).toBe(
        `v-${PASSWORD_GENERATOR_HISTORY_MAX - 2}`
      )
      expect(historyKeys()).toHaveLength(PASSWORD_GENERATOR_HISTORY_MAX)
    })

    it('keeps the site and the entry on the same generated password', async () => {
      expect(
        historyUses({
          title: 'Work bank',
          websiteUrl: 'https://example.com/login'
        })
      ).toEqual([
        { contextLabel: 'example.com', contextKind: 'site' },
        { contextLabel: 'Work bank', contextKind: 'entry' }
      ])

      seed({
        id: 'pw',
        value: 'same',
        createdAt: 1,
        contextLabel: 'example.com',
        contextKind: 'site',
        usedAt: 10
      })

      const next = await markHistoryUsed('same', {
        contextLabel: 'Work bank',
        contextKind: 'entry'
      })

      expect(historyUseLabels(next[0])).toEqual(['example.com', 'Work bank'])
      expect(next[0].uses).toEqual([
        expect.objectContaining({
          contextLabel: 'example.com',
          contextKind: 'site'
        }),
        expect.objectContaining({
          contextLabel: 'Work bank',
          contextKind: 'entry'
        })
      ])

      mockStore.clear()
      mockVault.activeVaultAdd.mockClear()
      const skipped = await markHistoryUsed('typed-not-generated', {
        contextLabel: 'Work bank',
        contextKind: 'entry',
        onlyExisting: true
      })
      expect(skipped).toEqual([])
      expect(mockVault.activeVaultAdd).not.toHaveBeenCalled()
    })

    it('does not persist when label or kind is invalid', async () => {
      await markHistoryUsed('pw', {
        contextLabel: '   ',
        contextKind: 'site'
      })
      await markHistoryUsed('pw', {
        contextLabel: 'ok',
        contextKind: 'other'
      })
      await markHistoryUsed('', {
        contextLabel: 'ok',
        contextKind: 'site'
      })

      expect(mockVault.activeVaultAdd).not.toHaveBeenCalled()
    })
  })

  describe('historyEntryLabels', () => {
    const records = [
      {
        id: 'r1',
        data: {
          title: 'Mail',
          password: 'shared-pw',
          websites: ['https://mail.example.org/login']
        }
      },
      { id: 'r2', data: { title: 'Work bank', password: 'shared-pw' } },
      { id: 'r3', data: { title: 'Other', password: 'different' } }
    ]

    it('adds the title and site of every record using the password, deduped with stamped uses', () => {
      expect(
        historyEntryLabels(
          {
            value: 'shared-pw',
            uses: [{ contextLabel: 'Work bank', contextKind: 'entry' }]
          },
          records
        )
      ).toEqual(['Work bank', 'mail.example.org', 'Mail'])
    })

    it('keeps stamped labels when no record uses the password', () => {
      expect(
        historyEntryLabels(
          { value: 'unused', contextLabel: 'example.com' },
          records
        )
      ).toEqual(['example.com'])
      expect(historyEntryLabels({ value: 'unused' }, records)).toEqual([])
    })
  })

  describe('clearHistory', () => {
    it('removes every entry key and the legacy key', async () => {
      seed(
        { id: 'a', value: 'x', createdAt: 1 },
        { id: 'b', value: 'y', createdAt: 2 }
      )
      mockStore.set(PASSWORD_GENERATOR_HISTORY_KEY, {
        entries: [{ id: 'c', value: 'z', createdAt: 3 }]
      })
      mockStore.set('app/other', { keep: true })

      await expect(clearHistory()).resolves.toEqual([])
      expect([...mockStore.keys()]).toEqual(['app/other'])
    })
  })
})
