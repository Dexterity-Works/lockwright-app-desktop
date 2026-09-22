import { act, renderHook, waitFor } from '@testing-library/react'

import { useVaultSchemaBoot } from './useVaultSchemaBoot'

const mockAddDevice = jest.fn()
const mockGetVaultMigrationStatus = jest.fn()
const mockActiveVaultGet = jest.fn()
const mockActiveVaultList = jest.fn()
const mockActiveVaultGetWriterKey = jest.fn()
const mockEmitSchemaMigrationWarning = jest.fn()

jest.mock('lockwright-lib-vault', () => ({
  SCHEMA_V2: 2,
  VAULT_EXT_KEY: 'vault-ext',
  emitSchemaMigrationWarning: (...args) =>
    mockEmitSchemaMigrationWarning(...args),
  useVault: () => ({
    data: mockVaultData,
    addDevice: mockAddDevice
  })
}))

jest.mock('lockwright-lib-vault/src/instances', () => ({
  pearpassVaultClient: {
    getVaultMigrationStatus: (...args) => mockGetVaultMigrationStatus(...args),
    activeVaultGet: (...args) => mockActiveVaultGet(...args),
    activeVaultList: (...args) => mockActiveVaultList(...args),
    activeVaultGetWriterKey: (...args) => mockActiveVaultGetWriterKey(...args)
  }
}))

jest.mock('../utils/logger', () => ({
  logger: { error: jest.fn(), log: jest.fn() }
}))

let mockVaultData = { id: 'vault-1', devices: [] }

describe('useVaultSchemaBoot', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockVaultData = { id: 'vault-1', devices: [] }
    mockAddDevice.mockResolvedValue(undefined)
    mockGetVaultMigrationStatus.mockResolvedValue({
      ready: true,
      inProgress: false,
      migratedToSchema: 2,
      error: null
    })
    mockActiveVaultGet.mockResolvedValue({})
    mockActiveVaultList.mockResolvedValue([
      { id: 'self', writerKey: 'wk-self', recordSchema: 2 }
    ])
    mockActiveVaultGetWriterKey.mockResolvedValue('wk-self')
    mockEmitSchemaMigrationWarning.mockResolvedValue(undefined)
  })

  it('waits for migration, advertises schema, emits warning when no other v1', async () => {
    const { result } = renderHook(() => useVaultSchemaBoot())

    expect(result.current.isMigrationReady).toBe(false)

    await waitFor(() => {
      expect(result.current.isMigrationReady).toBe(true)
    })

    expect(mockGetVaultMigrationStatus).toHaveBeenCalled()
    expect(mockAddDevice).toHaveBeenCalled()
    expect(mockEmitSchemaMigrationWarning).toHaveBeenCalledWith({
      vaultId: 'vault-1'
    })
  })

  it('skips warning when vault-ext.blockV1DeleteMirror already set', async () => {
    mockActiveVaultGet.mockResolvedValue({ blockV1DeleteMirror: true })

    const { result } = renderHook(() => useVaultSchemaBoot())

    await waitFor(() => {
      expect(result.current.isMigrationReady).toBe(true)
    })

    expect(mockEmitSchemaMigrationWarning).not.toHaveBeenCalled()
  })

  it('skips warning when another device still reports schema 1', async () => {
    mockActiveVaultList.mockResolvedValue([
      { id: 'self', writerKey: 'wk-self', recordSchema: 2 },
      { id: 'peer', writerKey: 'wk-peer', recordSchema: 1 }
    ])

    const { result } = renderHook(() => useVaultSchemaBoot())

    await waitFor(() => {
      expect(result.current.isMigrationReady).toBe(true)
    })

    expect(mockEmitSchemaMigrationWarning).not.toHaveBeenCalled()
  })

  it('is ready immediately when no active vault', async () => {
    mockVaultData = null

    const { result } = renderHook(() => useVaultSchemaBoot())

    await act(async () => {})

    expect(result.current.isMigrationReady).toBe(true)
    expect(mockGetVaultMigrationStatus).not.toHaveBeenCalled()
  })

  it('does not stay blocked when addDevice hangs after migration', async () => {
    mockAddDevice.mockImplementation(() => new Promise(() => {}))

    const { result } = renderHook(() => useVaultSchemaBoot())

    await waitFor(() => {
      expect(result.current.isMigrationReady).toBe(true)
    })
  })

  it('exposes live migrate progress while waiting', async () => {
    mockGetVaultMigrationStatus
      .mockResolvedValueOnce({
        ready: false,
        inProgress: true,
        migratedToSchema: null,
        error: null,
        progress: { done: 12, total: 400 }
      })
      .mockResolvedValue({
        ready: true,
        inProgress: false,
        migratedToSchema: 2,
        error: null,
        progress: { done: 400, total: 400 }
      })

    const { result } = renderHook(() => useVaultSchemaBoot())

    await waitFor(() => {
      expect(result.current.migrationProgress).toEqual({
        done: 12,
        total: 400
      })
    })

    await waitFor(() => {
      expect(result.current.isMigrationReady).toBe(true)
    })
  })

  it('fail-opens when migration status RPC hangs past timeout', async () => {
    jest.useFakeTimers()
    mockGetVaultMigrationStatus.mockImplementation(() => new Promise(() => {}))

    const { result } = renderHook(() => useVaultSchemaBoot())
    expect(result.current.isMigrationReady).toBe(false)

    await act(async () => {
      jest.advanceTimersByTime(60_000)
    })

    expect(result.current.isMigrationReady).toBe(true)
    jest.useRealTimers()
  })
})
