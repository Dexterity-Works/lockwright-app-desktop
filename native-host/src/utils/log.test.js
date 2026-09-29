/**
 * @jest-environment node
 */
import fs from 'fs'
import os from 'os'
import path from 'path'

jest.mock('fs')
jest.mock('os')
jest.mock('path')

// We need to control DEBUG_MODE per test
let mockDebugMode = false
jest.mock('../constants/debugMode', () => ({
  get DEBUG_MODE() {
    return mockDebugMode
  }
}))

// Import log after mocking is set up
import { log } from './log'

describe('log', () => {
  const HOME_DIR = '/home/testuser'
  const expectedLogDir = `${HOME_DIR}/.lockwright/logs`
  const expectedLogFile = `${expectedLogDir}/native-messaging-bridge.log`

  beforeEach(() => {
    jest.clearAllMocks()
    mockDebugMode = false
    os.homedir.mockReturnValue(HOME_DIR)
    path.join.mockImplementation((...args) => args.join('/'))
  })

  it('does nothing when DEBUG_MODE is false', () => {
    log('INFO', 'Test message')
    expect(fs.existsSync).not.toHaveBeenCalled()
    expect(fs.mkdirSync).not.toHaveBeenCalled()
    expect(fs.appendFileSync).not.toHaveBeenCalled()
  })

  it('writes log when DEBUG_MODE is true', () => {
    mockDebugMode = true
    fs.existsSync.mockReturnValue(false)

    log('DEBUG', 'Debug message test')

    expect(fs.existsSync).toHaveBeenCalledWith(expectedLogDir)
    expect(fs.mkdirSync).toHaveBeenCalledWith(expectedLogDir, {
      recursive: true
    })
    expect(fs.appendFileSync).toHaveBeenCalled()
    const logArgs = fs.appendFileSync.mock.calls[0]
    expect(logArgs[0]).toBe(expectedLogFile)
    expect(logArgs[1]).toMatch(
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z \[DEBUG\] \[IPC-BRIDGE\] Debug message test\n/
    )
  })

  it('handles errors gracefully', () => {
    mockDebugMode = true
    jest.spyOn(console, 'error').mockImplementation(() => {})
    fs.existsSync.mockImplementation(() => {
      throw new Error('fs error')
    })

    log('WARN', 'Error test')

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to write log: fs error')
    )
    console.error.mockRestore()
  })
})
