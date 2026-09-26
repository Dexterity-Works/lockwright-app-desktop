import { logger } from './logger'

globalThis.Pear = {
  config: { tier: 'dev' }
}

describe('Logger.log', () => {
  let originalDebugMode
  let consoleLogSpy

  beforeEach(() => {
    // Save and set debugMode to true for testing
    originalDebugMode = logger.debugMode
    logger.debugMode = true
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    logger.debugMode = originalDebugMode
    consoleLogSpy.mockRestore()
  })

  it('should call console.log with correct format and message', () => {
    const component = 'TestComponent'
    const message = 'Hello World'
    logger.log(component, message)
    expect(consoleLogSpy).toHaveBeenCalledTimes(1)
    const [formatted, msg] = consoleLogSpy.mock.calls[0]
    expect(formatted).toMatch(/\d{4}-\d{2}-\d{2}T.* \[LOG\] \[TestComponent\]/)
    expect(msg).toBe(message)
  })

  it('should not log if debugMode is false', () => {
    logger.debugMode = false
    logger.log('TestComponent', 'Should not log')
    expect(consoleLogSpy).not.toHaveBeenCalled()
  })

  it('prints every argument, not just the first', () => {
    logger.log('MultiArg', 'one', 'two', 'three')
    const [, ...rest] = consoleLogSpy.mock.calls[0]
    expect(rest).toEqual(['one', 'two', 'three'])
  })
})

describe('Logger.error', () => {
  afterEach(() => {
    delete window.electronAPI
  })

  it('forwards component and args to main, with errors flattened to text', () => {
    const logError = jest.fn()
    window.electronAPI = { logError }

    logger.error('Comp', 'boom', new Error('kaput'))

    expect(logError).toHaveBeenCalledTimes(1)
    const [component, args] = logError.mock.calls[0]
    expect(component).toBe('Comp')
    expect(args[0]).toBe('boom')
    expect(args[1]).toMatch(/Error: kaput/)
  })

  it('never throws into the caller when the bridge rejects the payload', () => {
    window.electronAPI = {
      logError: () => {
        throw new Error('not cloneable')
      }
    }
    expect(() => logger.error('Comp', () => {})).not.toThrow()
  })

  it('is a no-op outside Electron', () => {
    expect(() => logger.error('Comp', 'x')).not.toThrow()
  })
})

describe('Logger.setTarget', () => {
  afterEach(() => logger.setTarget(null))

  it('routes every level to the bound target regardless of debugMode', () => {
    const target = {
      log: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }
    logger.debugMode = false
    logger.setTarget(target)

    logger.info('IPC', 'started', 1)
    logger.error('IPC', 'boom')

    expect(target.info).toHaveBeenCalledWith('[IPC]', 'started', 1)
    expect(target.error).toHaveBeenCalledWith('[IPC]', 'boom')
  })
})
