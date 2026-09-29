import fs from 'fs'
import os from 'os'
import path from 'path'

import { IPC_SOCKET_DIR_NAME } from 'lockwright-lib-constants'

/**
 * Returns cross-platform IPC path.
 * Uses os.homedir() so both the desktop app (Electron/Node) and the
 * bridge (Pear/bare-os) resolve to the same path without depending
 * on Pear.config.pearDir, and stays short enough for the 104-byte
 * macOS Unix-socket limit.
 *
 * Windows pipe names are machine-global: any local user can squat a
 * well-known one and receive the pairing token. The desktop listens on
 * `<socketName>-<32 hex>` instead, fresh per start, and publishes it in
 * `<home>/<IPC_SOCKET_DIR_NAME>/<socketName>.pipe` as JSON
 * `{ pipe, secret }`. A pointer left by a crash still names a pipe anyone
 * can bind, so the host challenges the pipe owner with the secret
 * (nmProveServer) before it sends anything. Never guess a name: no valid
 * pointer means the desktop is not running. The pre-proof plain-string
 * pointer is invalid for the same reason.
 * @param {string} socketName
 * @returns {string|{ pipe: string, secret: string }|null} the socket path,
 *   or on win32 the published pipe and secret, or null when none is valid
 */
export const getIpcPath = (socketName) => {
  // Home dir, not a Pear/sandbox dir: sandboxed runs resolved different paths (upstream 95d4206, ac2d4c7)
  if (os.platform() === 'win32') {
    let pointer
    try {
      pointer = JSON.parse(
        fs.readFileSync(
          path.join(os.homedir(), IPC_SOCKET_DIR_NAME, `${socketName}.pipe`),
          'utf8'
        )
      )
    } catch {
      return null
    }
    const { pipe, secret } = pointer ?? {}
    const prefix = `\\\\?\\pipe\\${socketName}-`
    const validPipe =
      typeof pipe === 'string' &&
      pipe.startsWith(prefix) &&
      /^[0-9a-f]{32}$/.test(pipe.slice(prefix.length))
    const validSecret =
      typeof secret === 'string' && /^[0-9a-f]{64}$/.test(secret)
    return validPipe && validSecret ? { pipe, secret } : null
  }

  return path.join(os.homedir(), IPC_SOCKET_DIR_NAME, `${socketName}.sock`)
}
