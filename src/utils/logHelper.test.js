/* eslint-env jest */

import fs from 'fs'
import os from 'os'
import path from 'path'

const {
  createMainProcessLogger,
  createWorkletLogConfigurer
} = require('./logHelper.cjs')

describe('createMainProcessLogger', () => {
  let tmpDir
  let originalConsole
  let infoMock
  let warnMock
  let errorMock

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-test-'))
    originalConsole = global.console
    infoMock = jest.fn()
    warnMock = jest.fn()
    errorMock = jest.fn()
    global.console = {
      ...originalConsole,
      info: infoMock,
      warn: warnMock,
      error: errorMock
    }
  })

  afterEach(() => {
    global.console = originalConsole
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('packaged builds', () => {
    it('writes to file even when debugMode=false (always-on file)', () => {
      const logger = createMainProcessLogger({
        app: { isPackaged: true },
        debugMode: false
      })
      logger.setLogPath(tmpDir)
      logger.error('boom')

      const main = fs.readFileSync(
        path.join(tmpDir, 'logs', 'main.log'),
        'utf8'
      )
      expect(main).toContain('boom')
      expect(main).toContain('[ERROR]')
    })

    it('keeps console silent when debugMode=false', () => {
      const logger = createMainProcessLogger({
        app: { isPackaged: true },
        debugMode: false
      })
      logger.setLogPath(tmpDir)
      logger.info('hidden-from-console')
      logger.warn('also-hidden')

      expect(infoMock).not.toHaveBeenCalled()
      expect(warnMock).not.toHaveBeenCalled()
    })

    it('writes to file AND console when debugMode=true', () => {
      const logger = createMainProcessLogger({
        app: { isPackaged: true },
        debugMode: true
      })
      logger.setLogPath(tmpDir)
      logger.info('hello world')

      const main = fs.readFileSync(
        path.join(tmpDir, 'logs', 'main.log'),
        'utf8'
      )
      expect(main).toContain('hello world')
      expect(infoMock).toHaveBeenCalledWith('[MAIN][INFO]', 'hello world')
    })
  })

  describe('development (not packaged)', () => {
    it('writes to file AND console once setLogPath is called', () => {
      const logger = createMainProcessLogger({
        app: { isPackaged: false },
        debugMode: true
      })
      logger.setLogPath(tmpDir)
      logger.info('dev-info')
      logger.error('dev-err')

      const main = fs.readFileSync(
        path.join(tmpDir, 'logs', 'main.log'),
        'utf8'
      )
      expect(main).toMatch(/\[INFO\] dev-info/)
      expect(main).toMatch(/\[ERROR\] dev-err/)
      expect(infoMock).toHaveBeenCalledWith('[MAIN][INFO]', 'dev-info')
      expect(errorMock).toHaveBeenCalledWith('[MAIN][ERROR]', 'dev-err')
    })
  })

  describe('level filter', () => {
    it('blocks levels below threshold from both file and console', () => {
      const logger = createMainProcessLogger({
        app: { isPackaged: true },
        debugMode: true,
        logLevel: 'warn'
      })
      logger.setLogPath(tmpDir)
      logger.info('hidden')
      logger.warn('shown')

      const main = fs.readFileSync(
        path.join(tmpDir, 'logs', 'main.log'),
        'utf8'
      )
      expect(main).not.toContain('hidden')
      expect(main).toContain('shown')
      expect(infoMock).not.toHaveBeenCalledWith('[MAIN][INFO]', 'hidden')
      expect(warnMock).toHaveBeenCalledWith('[MAIN][WARN]', 'shown')
    })
  })

  describe('clearLogPath / getLogFilePath', () => {
    it('clearLogPath stops file writes; getLogFilePath returns the active path', () => {
      const logger = createMainProcessLogger({
        app: { isPackaged: true },
        debugMode: false
      })
      logger.setLogPath(tmpDir)
      const filePath = logger.getLogFilePath()
      expect(filePath).toBe(path.join(tmpDir, 'logs', 'main.log'))

      logger.error('before')
      logger.clearLogPath()
      expect(logger.getLogFilePath()).toBeNull()

      logger.error('after')
      const main = fs.readFileSync(filePath, 'utf8')
      expect(main).toContain('before')
      expect(main).not.toContain('after')
    })
  })

  describe('serialize', () => {
    it('formats Error with message and stack', () => {
      const logger = createMainProcessLogger({
        app: { isPackaged: true },
        debugMode: false
      })
      logger.setLogPath(tmpDir)
      const err = new Error('kaboom')
      logger.error(err)

      const main = fs.readFileSync(
        path.join(tmpDir, 'logs', 'main.log'),
        'utf8'
      )
      expect(main).toContain('kaboom')
      expect(main).toMatch(/at .*logHelper/)
    })
  })
})

describe('createWorkletLogConfigurer', () => {
  it('configures the client it is handed before main points at it', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worklet-log-'))
    const client = { setLogOptions: jest.fn().mockResolvedValue(undefined) }
    const enable = createWorkletLogConfigurer({
      getStorageDir: () => tmpDir,
      getVaultClient: () => null,
      isPackaged: true,
      workletLogLevel: 'debug',
      logger: { warn: jest.fn() }
    })

    await enable(client)

    expect(client.setLogOptions).toHaveBeenCalledWith(
      expect.objectContaining({ logLevel: 'debug', dev: false })
    )
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})
