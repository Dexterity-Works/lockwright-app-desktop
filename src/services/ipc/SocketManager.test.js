jest.mock('fs', () => ({
  promises: {
    unlink: jest.fn(),
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    rename: jest.fn()
  }
}))
jest.mock('os', () => ({
  platform: jest.fn(),
  homedir: jest.fn().mockReturnValue('/home/testuser')
}))
jest.mock('lockwright-lib-constants', () => ({
  IPC_SOCKET_DIR_NAME: '.lockwright'
}))
// Default: nothing listens on the path (a connect attempt errors out).
jest.mock('net', () => ({
  createConnection: jest.fn(() => {
    const socket = {
      once: (event, cb) => {
        if (event === 'error') setTimeout(() => cb(new Error('ENOENT')), 0)
        return socket
      },
      destroy: jest.fn()
    }
    return socket
  })
}))
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn()
  }
}))

import fs from 'fs'
import net from 'net'

import { SocketManager, getIpcPath } from './SocketManager'

const { logger } = require('../../utils/logger')

describe('SocketManager', () => {
  const socketName = 'testSocket'
  const unixPath = '/home/testuser/.lockwright/testSocket.sock'
  const winPipe = /^\\\\\?\\pipe\\testSocket-[0-9a-f]{32}$/

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getSocketPath', () => {
    it('returns an unguessable, per-call Windows pipe path on win32', () => {
      require('os').platform.mockReturnValue('win32')
      const manager = new SocketManager(socketName)
      const first = manager.getSocketPath(socketName)
      const second = manager.getSocketPath(socketName)
      expect(first).toMatch(winPipe)
      expect(second).toMatch(winPipe)
      expect(first).not.toBe(second)
    })

    it('returns Unix socket path on non-win32', () => {
      require('os').platform.mockReturnValue('linux')
      const manager = new SocketManager(socketName)
      expect(manager.getSocketPath(socketName)).toBe(unixPath)
    })
  })

  describe('publishPath', () => {
    const pointerFile = '/home/testuser/.lockwright/testSocket.pipe'

    it('publishes the pipe and a fresh secret as JSON, 0o600, via temp and rename', async () => {
      require('os').platform.mockReturnValue('win32')
      const manager = new SocketManager(socketName)

      await manager.publishPath()

      const [[tmpFile, contents, options]] = fs.promises.writeFile.mock.calls
      expect(tmpFile).toMatch(
        /^\/home\/testuser\/\.lockwright\/testSocket\.pipe\.tmp-\d+$/
      )
      expect(options).toEqual({ mode: 0o600 })
      expect(fs.promises.rename).toHaveBeenCalledWith(tmpFile, pointerFile)
      expect(JSON.parse(contents)).toEqual({
        pipe: manager.getPath(),
        secret: expect.stringMatching(/^[0-9a-f]{64}$/)
      })
    })

    it('rotates the secret with the pipe on every renewPath', () => {
      require('os').platform.mockReturnValue('win32')
      const manager = new SocketManager(socketName)
      const first = manager.secret.toString('hex')

      manager.renewPath()

      expect(manager.secret.toString('hex')).not.toBe(first)
    })

    it('writes nothing on Unix', async () => {
      require('os').platform.mockReturnValue('linux')
      const manager = new SocketManager(socketName)

      await manager.publishPath()

      expect(fs.promises.writeFile).not.toHaveBeenCalled()
    })
  })

  describe('proveOwnership', () => {
    it('answers a nonce with HMAC-SHA256(secret, nonce) as hex', () => {
      require('os').platform.mockReturnValue('win32')
      const manager = new SocketManager(socketName)
      manager.secret = Buffer.from('0b'.repeat(32), 'hex')

      // HMAC-SHA256 over the 16 nonce bytes, computed with node:crypto
      expect(manager.proveOwnership('48692054686572650000000000000000')).toBe(
        '4455111aefbe4c84b13c5586cf20d0461f194f9462b2349275d200227f4e6fbe'
      )
    })
  })

  describe('getPath', () => {
    it('returns the socket path', () => {
      require('os').platform.mockReturnValue('linux')

      const manager = new SocketManager(socketName)
      expect(manager.getPath()).toBe(unixPath)
    })
  })

  describe('cleanupSocket', () => {
    it('does nothing on win32', async () => {
      require('os').platform.mockReturnValue('win32')
      const manager = new SocketManager(socketName)
      await manager.cleanupSocket()
      expect(fs.promises.unlink).not.toHaveBeenCalled()
    })

    it('calls unlink and logs info on Unix', async () => {
      require('os').platform.mockReturnValue('linux')

      fs.promises.unlink.mockResolvedValue()
      const manager = new SocketManager(socketName)
      await manager.cleanupSocket()
      expect(fs.promises.unlink).toHaveBeenCalledWith(unixPath)
      expect(logger.info).toHaveBeenCalledWith(
        'SOCKET-MANAGER',
        'Cleaned up existing socket file'
      )
    })

    it('logs warn if unlink throws non-ENOENT error', async () => {
      require('os').platform.mockReturnValue('linux')

      const error = new Error('fail')
      error.code = 'EACCES'
      fs.promises.unlink.mockRejectedValue(error)
      const manager = new SocketManager(socketName)
      await manager.cleanupSocket()
      expect(logger.warn).toHaveBeenCalledWith(
        'SOCKET-MANAGER',
        expect.stringContaining('Could not clean up socket file')
      )
    })

    it('does not log warn if unlink throws ENOENT error', async () => {
      require('os').platform.mockReturnValue('linux')

      const error = new Error('not found')
      error.code = 'ENOENT'
      fs.promises.unlink.mockRejectedValue(error)
      const manager = new SocketManager(socketName)
      await manager.cleanupSocket()
      expect(logger.warn).not.toHaveBeenCalled()
    })

    it('refuses to unlink a socket another live instance is listening on', async () => {
      require('os').platform.mockReturnValue('linux')
      const live = {
        once: (event, cb) => {
          if (event === 'connect') setTimeout(cb, 0)
          return live
        },
        destroy: jest.fn()
      }
      net.createConnection.mockReturnValueOnce(live)

      const manager = new SocketManager(socketName)
      await expect(manager.cleanupSocket()).rejects.toThrow(
        'Another instance is listening'
      )
      expect(net.createConnection).toHaveBeenCalledWith(unixPath)
      expect(live.destroy).toHaveBeenCalled()
      expect(fs.promises.unlink).not.toHaveBeenCalled()
    })
  })
})

describe('getIpcPath', () => {
  it('returns socket path for given name', () => {
    require('os').platform.mockReturnValue('linux')
    expect(getIpcPath('foo')).toBe('/home/testuser/.lockwright/foo.sock')
  })
})
