import fs from 'fs'
import os from 'os'
import path from 'path'

import { DEBUG_MODE } from '../constants/debugMode.js'

/**
 * Dedicated logger for native messaging bridge
 * Logs to the logs directory within the bridge module directory when in debug mode
 * @param {'INFO'|'ERROR'|'DEBUG'|'WARN'} level - Log level
 * @param {string} message - Log message
 */
export const log = (level, message) => {
  if (!DEBUG_MODE) return

  try {
    const logDir = path.join(os.homedir(), '.lockwright', 'logs')
    const logFile = path.join(logDir, 'native-messaging-bridge.log')

    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }

    const timestamp = new Date().toISOString()
    const logMsg = `${timestamp} [${level}] [IPC-BRIDGE] ${message}\n`
    fs.appendFileSync(logFile, logMsg)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`Failed to write log: ${e.message}`)
  }
}
