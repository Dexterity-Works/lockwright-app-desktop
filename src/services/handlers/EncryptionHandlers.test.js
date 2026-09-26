import { EncryptionHandlers } from './EncryptionHandlers'

describe('EncryptionHandlers', () => {
  let clientMock
  let handlers
  let emit

  beforeEach(() => {
    clientMock = {
      encryptionGetStatus: jest.fn(),
      getMasterPasswordStatus: jest.fn()
    }
    emit = jest.fn()
    handlers = new EncryptionHandlers(clientMock, { emit })
  })

  it('emits extension-lock only when the master password is locked out', async () => {
    clientMock.getMasterPasswordStatus.mockResolvedValueOnce({
      isLocked: false
    })
    await handlers.getMasterPasswordStatus()
    expect(emit).not.toHaveBeenCalled()

    clientMock.getMasterPasswordStatus.mockResolvedValueOnce({
      isLocked: true
    })
    await expect(handlers.getMasterPasswordStatus()).resolves.toEqual({
      isLocked: true
    })
    expect(emit).toHaveBeenCalledWith('extension-lock')
  })

  it('should call client.encryptionGetStatus and return its result', async () => {
    const status = { enabled: true }
    clientMock.encryptionGetStatus.mockResolvedValue(status)

    const result = await handlers.encryptionGetStatus()

    expect(clientMock.encryptionGetStatus).toHaveBeenCalledTimes(1)
    expect(result).toBe(status)
  })

  it('should propagate errors from client.encryptionGetStatus', async () => {
    const error = new Error('Failed to get status')
    clientMock.encryptionGetStatus.mockRejectedValue(error)

    await expect(handlers.encryptionGetStatus()).rejects.toThrow(
      'Failed to get status'
    )
  })
})
