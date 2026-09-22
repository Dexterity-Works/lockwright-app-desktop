import React from 'react'

import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import {
  normalizeImport,
  normalizeProtonAuthenticator
} from 'lockwright-lib-data-import'
import { decryptProtonExport } from 'lockwright-lib-vault'

import { decodeQrFromImage } from '../../../../features/qr-decoder/decodeQrFromImage'
import { readFileContent } from '../../../../pages/SettingsView/utils/readFileContent'
import { ImportCodesContent } from './index'
;(globalThis as { React?: typeof React }).React = React

jest.mock('../../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (str: string) => str
  })
}))

jest.mock('../../../../features/qr-decoder/decodeQrFromImage', () => ({
  decodeQrFromImage: jest.fn()
}))

jest.mock('../../../../pages/SettingsView/utils/readFileContent', () => ({
  readFileContent: jest.fn()
}))

jest.mock('lockwright-lib-data-import', () => ({
  normalizeImport: jest.fn(),
  normalizeProtonAuthenticator: jest.fn()
}))

jest.mock('lockwright-lib-vault', () => ({
  decryptProtonExport: jest.fn()
}))

jest.mock('./ScanResultsView', () => ({
  ScanResultsView: ({
    onImportComplete
  }: {
    importedCodes: unknown[]
    onImportComplete: () => void
  }) => (
    <div data-testid="mock-scan-results-view">
      <button
        type="button"
        data-testid="mock-import-complete"
        onClick={onImportComplete}
      >
        Complete Import
      </button>
    </div>
  )
}))

jest.mock('./styles', () => ({
  createStyles: () => ({
    container: {},
    listWrapper: {},
    listItems: {},
    listItemBorder: {},
    backButton: {},
    header: {},
    uploadArea: {},
    passwordSection: {},
    footer: {}
  })
}))

const mockTheme = {
  theme: {
    colors: {
      colorTextSecondary: '#888',
      colorTextPrimary: '#fff'
    }
  }
}

jest.mock('lockwright-lib-ui-react-native-components', () => ({
  useTheme: () => mockTheme,
  PageHeader: ({ title }: { title: React.ReactNode }) => <h1>{title}</h1>,
  Text: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
  Title: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  Link: (props: { children?: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={props.onClick}>
      {props.children}
    </button>
  ),
  ListItem: (props: {
    testID?: string
    title?: React.ReactNode
    onClick?: () => void
  }) => (
    <button type="button" data-testid={props.testID} onClick={props.onClick}>
      {props.title}
    </button>
  ),
  AlertMessage: (props: { testID?: string; description?: string }) => (
    <div data-testid={props.testID}>{props.description}</div>
  ),
  PasswordField: (props: {
    testID?: string
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    error?: string
  }) => (
    <>
      <input
        data-testid={props.testID}
        value={props.value ?? ''}
        onChange={props.onChange}
      />
      {props.error && (
        <span data-testid={`${props.testID}-error`}>{props.error}</span>
      )}
    </>
  ),
  UploadField: (props: {
    testID?: string
    files?: unknown[]
    onFilesChange?: (files: { file: File }[]) => void
  }) => (
    <div data-testid={props.testID}>
      <button
        type="button"
        data-testid="mock-upload-add"
        onClick={() =>
          props.onFilesChange?.([
            { file: new File(['qr-data'], 'qr.png', { type: 'image/png' }) }
          ])
        }
      >
        Add file
      </button>
      <button
        type="button"
        data-testid="mock-upload-remove"
        onClick={() => props.onFilesChange?.([])}
      >
        Remove file
      </button>
    </div>
  ),
  Button: (props: {
    children?: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    isLoading?: boolean
    'aria-label'?: string
    'data-testid'?: string
  }) => (
    <button
      type="button"
      aria-label={props['aria-label']}
      data-testid={props['data-testid']}
      disabled={props.disabled || props.isLoading}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}))

jest.mock('lockwright-lib-ui-react-native-components/icons', () => ({
  ArrowBackOutined: () => null,
  KeyboardArrowRightFilled: () => null
}))

const mockDecodeQrFromImage = jest.mocked(decodeQrFromImage)
const mockNormalizeImport = jest.mocked(normalizeImport)
const mockNormalizeProtonAuthenticator = jest.mocked(
  normalizeProtonAuthenticator
)
const mockReadFileContent = jest.mocked(readFileContent)
const mockDecryptProtonExport = jest.mocked(decryptProtonExport)

const MOCK_OTP_RECORD = {
  label: 'alice@example.com',
  secret: 'JBSWY3DPEHPK3PXP',
  type: 'TOTP' as const,
  algorithm: 'SHA1' as const,
  digits: 6,
  period: 30,
  issuer: 'GitHub'
}

function renderAndSelectSource() {
  render(<ImportCodesContent />)
  fireEvent.click(
    screen.getByTestId('settings-import-codes-google-authenticator')
  )
}

function renderAndSelectProton() {
  render(<ImportCodesContent />)
  fireEvent.click(screen.getByTestId('settings-import-codes-proton-2fa'))
}

describe('ImportCodesContent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('default view — source selection', () => {
    it('renders the Import heading and source list', () => {
      render(<ImportCodesContent />)

      expect(
        screen.getByRole('heading', { name: 'Import' })
      ).toBeInTheDocument()
      expect(
        screen.getByTestId('settings-import-codes-google-authenticator')
      ).toBeInTheDocument()
    })
  })

  describe('upload step', () => {
    it('shows upload step with upload field when a source is selected', () => {
      renderAndSelectSource()

      expect(
        screen.getByTestId('import-codes-upload-field')
      ).toBeInTheDocument()
    })

    it('shows the selected source title in the heading', () => {
      renderAndSelectSource()

      expect(
        screen.getByRole('heading', { name: /Google Authenticator/ })
      ).toBeInTheDocument()
    })

    it('Scan File button is disabled when no files are uploaded', () => {
      renderAndSelectSource()

      expect(screen.getByTestId('import-codes-scan-file-button')).toBeDisabled()
    })

    it('Scan File button is enabled after uploading a file', () => {
      renderAndSelectSource()

      fireEvent.click(screen.getByTestId('mock-upload-add'))

      expect(
        screen.getByTestId('import-codes-scan-file-button')
      ).not.toBeDisabled()
    })

    it('navigates back to source list when back button is clicked', () => {
      renderAndSelectSource()

      fireEvent.click(screen.getByRole('button', { name: 'back' }))

      expect(
        screen.getByTestId('settings-import-codes-google-authenticator')
      ).toBeInTheDocument()
      expect(
        screen.queryByTestId('import-codes-upload-field')
      ).not.toBeInTheDocument()
    })
  })

  describe('scanning', () => {
    it('shows ScanResultsView after a successful scan', async () => {
      mockDecodeQrFromImage.mockResolvedValue('otpauth://totp/alice?secret=ABC')
      mockNormalizeImport.mockReturnValue({
        status: 'complete',
        records: [MOCK_OTP_RECORD]
      } as any)

      renderAndSelectSource()
      fireEvent.click(screen.getByTestId('mock-upload-add'))
      fireEvent.click(screen.getByTestId('import-codes-scan-file-button'))

      await waitFor(() => {
        expect(screen.getByTestId('mock-scan-results-view')).toBeInTheDocument()
      })
    })

    it('calls decodeQrFromImage and normalizeImport with decoded URIs', async () => {
      mockDecodeQrFromImage.mockResolvedValue('otpauth://totp/alice?secret=ABC')
      mockNormalizeImport.mockReturnValue({
        status: 'complete',
        records: [MOCK_OTP_RECORD]
      } as any)

      renderAndSelectSource()
      fireEvent.click(screen.getByTestId('mock-upload-add'))
      fireEvent.click(screen.getByTestId('import-codes-scan-file-button'))

      await waitFor(() => {
        expect(mockDecodeQrFromImage).toHaveBeenCalledTimes(1)
      })
      expect(mockNormalizeImport).toHaveBeenCalledWith([
        'otpauth://totp/alice?secret=ABC'
      ])
    })

    it('shows an error alert when the batch is incomplete', async () => {
      mockDecodeQrFromImage.mockResolvedValue('otpauth-migration://...')
      mockNormalizeImport.mockReturnValue({
        status: 'incomplete-batch',
        expected: 3,
        received: 1,
        batchId: 'batch1'
      } as any)

      renderAndSelectSource()
      fireEvent.click(screen.getByTestId('mock-upload-add'))
      fireEvent.click(screen.getByTestId('import-codes-scan-file-button'))

      await waitFor(() => {
        expect(
          screen.getByTestId('import-codes-scan-error')
        ).toBeInTheDocument()
      })
      expect(
        screen.queryByTestId('mock-scan-results-view')
      ).not.toBeInTheDocument()
    })

    it('shows an error alert when QR decoding throws', async () => {
      mockDecodeQrFromImage.mockRejectedValue(new Error('No QR code found'))

      renderAndSelectSource()
      fireEvent.click(screen.getByTestId('mock-upload-add'))
      fireEvent.click(screen.getByTestId('import-codes-scan-file-button'))

      await waitFor(() => {
        expect(
          screen.getByTestId('import-codes-scan-error')
        ).toBeInTheDocument()
      })
      expect(
        screen.queryByTestId('mock-scan-results-view')
      ).not.toBeInTheDocument()
    })

    it('displays the thrown error message in the error alert', async () => {
      mockDecodeQrFromImage.mockRejectedValue(
        new Error('Barcode detector unsupported')
      )

      renderAndSelectSource()
      fireEvent.click(screen.getByTestId('mock-upload-add'))
      fireEvent.click(screen.getByTestId('import-codes-scan-file-button'))

      await waitFor(() => {
        expect(
          screen.getByTestId('import-codes-scan-error').textContent
        ).toContain('Barcode detector unsupported')
      })
    })
  })

  describe('file removal after scan', () => {
    async function renderAndScan() {
      mockDecodeQrFromImage.mockResolvedValue('otpauth://totp/alice?secret=ABC')
      mockNormalizeImport.mockReturnValue({
        status: 'complete',
        records: [MOCK_OTP_RECORD]
      } as any)

      renderAndSelectSource()
      fireEvent.click(screen.getByTestId('mock-upload-add'))
      fireEvent.click(screen.getByTestId('import-codes-scan-file-button'))

      await waitFor(() => {
        expect(screen.getByTestId('mock-scan-results-view')).toBeInTheDocument()
      })
    }

    it('hides ScanResultsView when a file is removed after a successful scan', async () => {
      await renderAndScan()

      act(() => {
        fireEvent.click(screen.getByTestId('mock-upload-remove'))
      })

      expect(
        screen.queryByTestId('mock-scan-results-view')
      ).not.toBeInTheDocument()
    })

    it('re-enables the Scan File button after the file is removed', async () => {
      await renderAndScan()

      act(() => {
        fireEvent.click(screen.getByTestId('mock-upload-remove'))
      })
      fireEvent.click(screen.getByTestId('mock-upload-add'))

      expect(
        screen.getByTestId('import-codes-scan-file-button')
      ).not.toBeDisabled()
    })
  })

  describe('completing import', () => {
    it('resets to the source list when onImportComplete fires', async () => {
      mockDecodeQrFromImage.mockResolvedValue('otpauth://totp/alice?secret=ABC')
      mockNormalizeImport.mockReturnValue({
        status: 'complete',
        records: [MOCK_OTP_RECORD]
      } as any)

      renderAndSelectSource()
      fireEvent.click(screen.getByTestId('mock-upload-add'))
      fireEvent.click(screen.getByTestId('import-codes-scan-file-button'))

      await waitFor(() => {
        expect(screen.getByTestId('mock-scan-results-view')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('mock-import-complete'))

      expect(
        screen.getByTestId('settings-import-codes-google-authenticator')
      ).toBeInTheDocument()
      expect(
        screen.queryByTestId('mock-scan-results-view')
      ).not.toBeInTheDocument()
    })
  })

  describe('Proton 2FA import', () => {
    it('shows Proton 2FA in the source list', () => {
      render(<ImportCodesContent />)
      expect(
        screen.getByTestId('settings-import-codes-proton-2fa')
      ).toBeInTheDocument()
    })

    it('shows upload step when Proton 2FA is selected', () => {
      renderAndSelectProton()
      expect(
        screen.getByTestId('import-codes-upload-field')
      ).toBeInTheDocument()
    })

    it('shows the Proton 2FA title in the heading', () => {
      renderAndSelectProton()
      expect(
        screen.getByRole('heading', { name: /Proton 2FA/ })
      ).toBeInTheDocument()
    })

    it('shows ScanResultsView after a successful Proton 2FA import', async () => {
      mockReadFileContent.mockResolvedValue('{"entries":[]}')
      mockNormalizeProtonAuthenticator.mockReturnValue([MOCK_OTP_RECORD])

      renderAndSelectProton()
      fireEvent.click(screen.getByTestId('mock-upload-add'))
      await waitFor(() =>
        expect(
          screen.getByTestId('import-codes-scan-file-button')
        ).not.toBeDisabled()
      )
      fireEvent.click(screen.getByTestId('import-codes-scan-file-button'))

      await waitFor(() => {
        expect(screen.getByTestId('mock-scan-results-view')).toBeInTheDocument()
      })
    })

    it('calls readFileContent and normalizeProtonAuthenticator with file content', async () => {
      const jsonContent =
        '{"entries":[{"content":{"uri":"otpauth://totp/test?secret=ABC"}}]}'
      mockReadFileContent.mockResolvedValue(jsonContent)
      mockNormalizeProtonAuthenticator.mockReturnValue([MOCK_OTP_RECORD])

      renderAndSelectProton()
      fireEvent.click(screen.getByTestId('mock-upload-add'))
      await waitFor(() =>
        expect(
          screen.getByTestId('import-codes-scan-file-button')
        ).not.toBeDisabled()
      )
      fireEvent.click(screen.getByTestId('import-codes-scan-file-button'))

      await waitFor(() => {
        expect(mockReadFileContent).toHaveBeenCalledTimes(1)
      })
      expect(mockNormalizeProtonAuthenticator).toHaveBeenCalledWith(jsonContent)
    })

    it('does NOT call decodeQrFromImage for Proton 2FA', async () => {
      mockReadFileContent.mockResolvedValue('{"entries":[]}')
      mockNormalizeProtonAuthenticator.mockReturnValue([])

      renderAndSelectProton()
      fireEvent.click(screen.getByTestId('mock-upload-add'))
      await waitFor(() =>
        expect(
          screen.getByTestId('import-codes-scan-file-button')
        ).not.toBeDisabled()
      )
      fireEvent.click(screen.getByTestId('import-codes-scan-file-button'))

      await waitFor(() => {
        expect(mockNormalizeProtonAuthenticator).toHaveBeenCalledTimes(1)
      })
      expect(mockDecodeQrFromImage).not.toHaveBeenCalled()
    })

    it('shows an error alert when normalizeProtonAuthenticator throws', async () => {
      mockReadFileContent.mockResolvedValue('not valid json')
      mockNormalizeProtonAuthenticator.mockImplementation(() => {
        throw new Error('normalizeProtonAuthenticator: invalid JSON')
      })

      renderAndSelectProton()
      fireEvent.click(screen.getByTestId('mock-upload-add'))
      await waitFor(() =>
        expect(
          screen.getByTestId('import-codes-scan-file-button')
        ).not.toBeDisabled()
      )
      fireEvent.click(screen.getByTestId('import-codes-scan-file-button'))

      await waitFor(() => {
        expect(
          screen.getByTestId('import-codes-scan-error')
        ).toBeInTheDocument()
      })
      expect(
        screen.getByTestId('import-codes-scan-error').textContent
      ).toContain('normalizeProtonAuthenticator: invalid JSON')
      expect(
        screen.queryByTestId('mock-scan-results-view')
      ).not.toBeInTheDocument()
    })
  })

  describe('Proton 2FA encrypted import', () => {
    const ENCRYPTED_CONTENT = JSON.stringify({
      version: 1,
      salt: 'test-salt',
      content: 'encrypted-content'
    })

    async function renderToPasswordScreen() {
      mockReadFileContent.mockResolvedValue(ENCRYPTED_CONTENT)
      renderAndSelectProton()
      fireEvent.click(screen.getByTestId('mock-upload-add'))
      await waitFor(() =>
        expect(
          screen.getByTestId('import-codes-scan-file-button')
        ).not.toBeDisabled()
      )
      fireEvent.click(screen.getByTestId('import-codes-scan-file-button'))
      return screen.findByTestId('import-codes-password-field')
    }

    it('shows the password field when an encrypted file is uploaded', async () => {
      const passwordField = await renderToPasswordScreen()
      expect(passwordField).toBeInTheDocument()
    })

    it('hides the upload field and shows the password field', async () => {
      await renderToPasswordScreen()
      expect(
        screen.queryByTestId('import-codes-upload-field')
      ).not.toBeInTheDocument()
      expect(
        screen.getByTestId('import-codes-password-field')
      ).toBeInTheDocument()
    })

    it('decrypts and shows ScanResultsView with the correct password', async () => {
      const decryptedContent = '{"entries":[]}'
      mockDecryptProtonExport.mockResolvedValue(decryptedContent)
      mockNormalizeProtonAuthenticator.mockReturnValue([MOCK_OTP_RECORD])

      const passwordField = await renderToPasswordScreen()
      fireEvent.change(passwordField, { target: { value: 'correct-password' } })

      const importButton = screen.getByTestId('import-codes-import-button')
      fireEvent.click(importButton)

      await waitFor(() => {
        expect(mockDecryptProtonExport).toHaveBeenCalledWith({
          version: 1,
          salt: 'test-salt',
          content: 'encrypted-content',
          password: 'correct-password'
        })
      })
      expect(mockNormalizeProtonAuthenticator).toHaveBeenCalledWith(
        decryptedContent
      )
      expect(screen.getByTestId('mock-scan-results-view')).toBeInTheDocument()
    })

    it('shows a password field error on wrong password', async () => {
      mockDecryptProtonExport.mockRejectedValue(new Error('Incorrect password'))

      const passwordField = await renderToPasswordScreen()
      fireEvent.change(passwordField, { target: { value: 'wrong-password' } })

      fireEvent.click(screen.getByTestId('import-codes-import-button'))

      await waitFor(() => {
        expect(
          screen.getByTestId('import-codes-password-field-error')
        ).toBeInTheDocument()
      })
      expect(
        screen.getByTestId('import-codes-password-field-error').textContent
      ).toContain('Failed to decrypt file')
      expect(
        screen.queryByTestId('mock-scan-results-view')
      ).not.toBeInTheDocument()
    })

    it('shows a general error alert for non-password decrypt errors', async () => {
      mockDecryptProtonExport.mockRejectedValue(new Error('Corrupt file data'))

      const passwordField = await renderToPasswordScreen()
      fireEvent.change(passwordField, { target: { value: 'some-password' } })

      fireEvent.click(screen.getByTestId('import-codes-import-button'))

      await waitFor(() => {
        expect(
          screen.getByTestId('import-codes-scan-error')
        ).toBeInTheDocument()
      })
      expect(
        screen.getByTestId('import-codes-scan-error').textContent
      ).toContain('Corrupt file data')
    })

    it('navigates back to the upload screen from the password screen', async () => {
      await renderToPasswordScreen()

      fireEvent.click(screen.getByRole('button', { name: 'back' }))

      await waitFor(() => {
        expect(
          screen.getByTestId('import-codes-upload-field')
        ).toBeInTheDocument()
      })
      expect(
        screen.queryByTestId('import-codes-password-field')
      ).not.toBeInTheDocument()
    })
  })
})
