import { VaultHandlers } from './VaultHandlers.js'

describe('VaultHandlers file commands', () => {
  it('returns base64 file bytes from activeVaultGetFile', async () => {
    const client = {
      activeVaultGetFile: jest.fn().mockResolvedValue(Buffer.from('hi'))
    }
    const handlers = new VaultHandlers(client, { emit: jest.fn() })

    await expect(
      handlers.activeVaultGetFile({ key: 'record-v2/r/file/f' })
    ).resolves.toEqual({
      encoding: 'base64',
      data: Buffer.from('hi').toString('base64')
    })
    expect(client.activeVaultGetFile).toHaveBeenCalledWith('record-v2/r/file/f')
  })

  it('decodes base64 and calls activeVaultAddFile', async () => {
    const client = {
      activeVaultAddFile: jest.fn().mockResolvedValue(undefined)
    }
    const handlers = new VaultHandlers(client, { emit: jest.fn() })

    await expect(
      handlers.activeVaultAddFile({
        key: 'record-v2/r/file/f',
        data: {
          encoding: 'base64',
          data: Buffer.from('hi').toString('base64')
        },
        name: 'note.txt'
      })
    ).resolves.toEqual({ success: true })

    expect(client.activeVaultAddFile).toHaveBeenCalledWith(
      'record-v2/r/file/f',
      Buffer.from('hi'),
      'note.txt'
    )
  })
})

describe('VaultHandlers list commands', () => {
  it('activeVaultList does not probe status before listing', async () => {
    const client = {
      encryptionGetStatus: jest.fn(),
      vaultsGetStatus: jest.fn(),
      activeVaultGetStatus: jest.fn(),
      activeVaultList: jest.fn().mockResolvedValue([{ id: 'r1' }])
    }
    const handlers = new VaultHandlers(client, { emit: jest.fn() })

    await expect(
      handlers.activeVaultList({ filterKey: 'record-v2/' })
    ).resolves.toEqual([{ id: 'r1' }])

    expect(client.activeVaultList).toHaveBeenCalledWith('record-v2/')
    expect(client.encryptionGetStatus).not.toHaveBeenCalled()
    expect(client.vaultsGetStatus).not.toHaveBeenCalled()
    expect(client.activeVaultGetStatus).not.toHaveBeenCalled()
  })

  it('vaultsList does not probe status around listing', async () => {
    const client = {
      vaultsGetStatus: jest.fn(),
      encryptionGetStatus: jest.fn(),
      vaultsList: jest.fn().mockResolvedValue([{ id: 'v1' }])
    }
    const handlers = new VaultHandlers(client, { emit: jest.fn() })

    await expect(handlers.vaultsList({ filterKey: 'vault/' })).resolves.toEqual(
      [{ id: 'v1' }]
    )

    expect(client.vaultsList).toHaveBeenCalledWith('vault/')
    expect(client.vaultsGetStatus).not.toHaveBeenCalled()
    expect(client.encryptionGetStatus).not.toHaveBeenCalled()
  })
})

describe('VaultHandlers closeAllInstances', () => {
  it('emits extension-exit only when the desktop was authenticated', async () => {
    const emit = jest.fn()
    const client = {
      vaultsGetStatus: jest.fn().mockResolvedValueOnce({ status: false }),
      closeAllInstances: jest.fn().mockResolvedValue(undefined)
    }
    const handlers = new VaultHandlers(client, { emit })

    await handlers.closeAllInstances()
    expect(emit).not.toHaveBeenCalled()

    client.vaultsGetStatus.mockResolvedValueOnce({ status: true })
    await expect(handlers.closeAllInstances()).resolves.toEqual({
      success: true
    })
    expect(emit).toHaveBeenCalledWith('extension-exit')
  })
})
