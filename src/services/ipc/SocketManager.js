import { createHmac, randomBytes } from 'crypto'
import fs from 'fs'
import { homedir, platform } from 'os'
import { join } from 'path'

import { IPC_SOCKET_DIR_NAME } from 'lockwright-lib-constants'

import { logger } from '../../utils/logger'

const { rename, unlink, writeFile } = fs.promises

const getSocketDir = () => join(homedir(), IPC_SOCKET_DIR_NAME)

/**
 * Manages IPC socket creation and cleanup
 */
export class SocketManager {
  constructor(socketName) {
    this.socketName = socketName
    this.renewPath()
  }

  /**
   * Get platform-specific socket path.
   * Windows pipe names are machine-global, so any local user could squat
   * a well-known one and receive the extension's pairing token. Use an
   * unguessable name instead and hand it to the bridge via publishPath().
   */
  getSocketPath(socketName) {
    if (platform() === 'win32') {
      return `\\\\?\\pipe\\${socketName}-${randomBytes(16).toString('hex')}`
    }

    return join(getSocketDir(), `${socketName}.sock`)
  }

  /**
   * Pick the path for the next listen. Fresh pipe name and secret on
   * every start, so a pointer left by a crashed run proves nothing.
   */
  renewPath() {
    this.socketPath = this.getSocketPath(this.socketName)
    /** @type {Buffer} shared with the bridge through the pointer file */
    this.secret = randomBytes(32)
    return this.socketPath
  }

  /**
   * File in the user's profile naming the live pipe (Windows only).
   * The bridge reads it; see its getIpcPath().
   */
  getPipeFilePath() {
    return join(getSocketDir(), `${this.socketName}.pipe`)
  }

  /**
   * Tell the bridge which pipe to use (Windows only). Call once listening.
   * Writes `{ pipe, secret }`; the bridge challenges the pipe owner with
   * nmProveServer so a squatter on a stale name cannot pass as us.
   * Atomic so the bridge never reads a half-written file.
   */
  async publishPath() {
    if (platform() !== 'win32') return
    const pipeFile = this.getPipeFilePath()
    const tmpFile = `${pipeFile}.tmp-${process.pid}`
    const pointer = JSON.stringify({
      pipe: this.socketPath,
      secret: this.secret.toString('hex')
    })
    await writeFile(tmpFile, pointer, { mode: 0o600 })
    await rename(tmpFile, pipeFile)
  }

  /**
   * Answer the bridge's challenge: HMAC-SHA256(secret, nonce).
   * @param {string} nonceHex
   * @returns {string} proof as hex
   */
  proveOwnership(nonceHex) {
    return createHmac('sha256', this.secret)
      .update(Buffer.from(nonceHex, 'hex'))
      .digest('hex')
  }

  /**
   * Withdraw the published pipe (Windows only), so the bridge never
   * follows it to a name that is no longer ours.
   */
  async unpublishPath() {
    if (platform() !== 'win32') return

    try {
      await unlink(this.getPipeFilePath())
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.warn(
          'SOCKET-MANAGER',
          `Could not remove pipe file: ${err.message}`
        )
      }
    }
  }

  /**
   * Clean up existing socket file (Unix only)
   */
  async cleanupSocket() {
    if (platform() === 'win32') return

    try {
      await unlink(this.socketPath)
      logger.info('SOCKET-MANAGER', 'Cleaned up existing socket file')
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.warn(
          'SOCKET-MANAGER',
          `Could not clean up socket file: ${err.message}`
        )
      }
    }
  }

  /**
   * Ensure the socket directory exists
   */
  async ensureSocketDir() {
    await fs.promises.mkdir(getSocketDir(), { recursive: true })
  }

  /**
   * Get the socket path
   */
  getPath() {
    return this.socketPath
  }
}

/**
 * Helper function for backward compatibility.
 * Windows has no fixed pipe path: only a running server knows its pipe.
 * @returns {string|null}
 */
export const getIpcPath = (socketName) => {
  if (platform() === 'win32') return null
  const manager = new SocketManager(socketName)
  return manager.getPath()
}
