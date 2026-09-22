import { useMemo, useState } from 'react'

import type {
  OTPRecord,
  NormalizeResult
} from 'lockwright-lib-data-import'
import {
  normalizeImport,
  normalizeProtonAuthenticator
} from 'lockwright-lib-data-import'
import { useForm } from 'lockwright-lib-ui-react-hooks'
import { Validator } from 'lockwright-utils-validator'
import { decryptProtonExport } from 'lockwright-lib-vault'
import type { UploadedFile } from 'lockwright-lib-ui-react-native-components'
import {
  AlertMessage,
  Button,
  Link,
  ListItem,
  PageHeader,
  PasswordField,
  Text,
  Title,
  UploadField,
  useTheme
} from 'lockwright-lib-ui-react-native-components'
import {
  ArrowBackOutined,
  KeyboardArrowRightFilled
} from 'lockwright-lib-ui-react-native-components/icons'

import { decodeQrFromImage } from '../../../../features/qr-decoder/decodeQrFromImage'
import { useTranslation } from '../../../../hooks/useTranslation'
import { readFileContent } from '../../../SettingsView/utils/readFileContent'
import { ScanResultsView } from './ScanResultsView'
import { createStyles } from './styles'
import { parseCodeJsonContent, detectIsCodeFileEncrypted } from './utils'
import type { CodeFileInfo, ImportCodesOption, ImportCodesState } from './types'
import { ImportCodesOptionType } from './types'

export const ImportCodesContent = () => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const styles = createStyles(theme.colors)

  const [state, setState] = useState<ImportCodesState>('default')
  const [selectedOption, setSelectedOption] =
    useState<ImportCodesOption | null>(null)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [codeFileInfo, setCodeFileInfo] = useState<CodeFileInfo | null>(null)
  const [isScanned, setIsScanned] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [importedCodes, setImportedCodes] = useState<OTPRecord[]>([])
  const [importError, setImportError] = useState<string | null>(null)

  const schema = useMemo(
    () =>
      Validator.object({
        password: Validator.string().required(t('Password is required'))
      }),
    [t]
  )

  const { register, handleSubmit, setErrors, setValues, values } = useForm({
    initialValues: { password: '' },
    validate: (vals: { password: string }) => schema.validate(vals)
  })

  const { onChange: onChangePassword, ...passwordProps } = register('password')

  const importCodesOptions: ImportCodesOption[] = useMemo(
    () => [
      {
        type: ImportCodesOptionType.GoogleAuthenticator,
        title: t('Google Authenticator'),
        description: t(
          'To import your codes, open Google Authenticator, tap the menu, go to Transfer accounts, and select Export accounts. Once the export is complete, one or more QR codes will be generated that you can upload here.'
        ),
        learnMoreUrl: 'https://support.google.com/accounts/answer/1066447',
        accepts: ['.png', '.jpg', '.jpeg'],
        multiFile: true,
        testID: 'settings-import-codes-google-authenticator'
      },
      {
        type: ImportCodesOptionType.Proton2FA,
        title: t('Proton 2FA'),
        description: t(
          'To import your codes, open Proton 2FA, go to Settings, and select Export. Once the export is complete, a file will be generated that you can upload here.'
        ),
        learnMoreUrl: 'https://proton.me/support/proton-authenticator',
        accepts: ['.txt'],
        multiFile: false,
        testID: 'settings-import-codes-proton-2fa'
      }
    ],
    [t]
  )

  const resetToDefault = () => {
    setState('default')
    setSelectedOption(null)
    setFiles([])
    setCodeFileInfo(null)
    setIsScanned(false)
    setIsScanning(false)
    setImportedCodes([])
    setImportError(null)
    setValues({ password: '' })
  }

  const handleBack = () => {
    if (state === 'inputPassword') {
      setState('upload')
      setValues({ password: '' })
      setImportError(null)
    } else {
      resetToDefault()
    }
  }

  const handleFilesChange = async (newFiles: UploadedFile[]) => {
    setFiles(newFiles)
    if (isScanned && newFiles.length < files.length) {
      setIsScanned(false)
      setImportedCodes([])
      setImportError(null)
    }

    if (!selectedOption) return

    if (selectedOption.type === ImportCodesOptionType.Proton2FA) {
      if (newFiles.length === 0) {
        setCodeFileInfo(null)
        return
      }
      try {
        const text = await readFileContent(newFiles[0].file)
        const parsedJson = parseCodeJsonContent(text as string)
        setCodeFileInfo({
          fileContent: text as string,
          parsedJson,
          isEncrypted: detectIsCodeFileEncrypted(
            selectedOption.type,
            parsedJson
          )
        })
      } catch {
        setCodeFileInfo(null)
      }
    }
  }

  const handleContinue = async () => {
    if (!selectedOption || files.length === 0) return

    setIsScanning(true)
    setImportError(null)

    try {
      if (selectedOption.type === ImportCodesOptionType.GoogleAuthenticator) {
        const decoded: string[] = await Promise.all(
          files.map((f) => decodeQrFromImage(f.file))
        )

        const result: NormalizeResult = normalizeImport(decoded)

        if (result.status === 'incomplete-batch') {
          setImportError(
            t(
              'To finish your export, please upload all required QR codes. ({received} currently uploaded)',
              {
                received: result.received
              }
            )
          )
          return
        }

        setImportedCodes(result.records)
        setIsScanned(true)
      } else if (selectedOption.type === ImportCodesOptionType.Proton2FA) {
        if (!codeFileInfo) return

        if (codeFileInfo.isEncrypted) {
          setValues({ password: '' })
          setState('inputPassword')
          return
        }

        const records: OTPRecord[] = normalizeProtonAuthenticator(
          codeFileInfo.fileContent
        )

        setImportedCodes(records)
        setIsScanned(true)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setImportError(message)
    } finally {
      setIsScanning(false)
    }
  }

  const handleImportEncrypted = async ({ password }: { password: string }) => {
    if (!selectedOption || !codeFileInfo?.parsedJson) return

    setIsScanning(true)
    setImportError(null)

    try {
      if (selectedOption.type === ImportCodesOptionType.Proton2FA) {
        const { version, salt, content } = codeFileInfo.parsedJson as {
          version: number
          salt: string
          content: string
        }
        const plaintext = await decryptProtonExport({
          version,
          salt,
          content,
          password
        })
        const records: OTPRecord[] = normalizeProtonAuthenticator(plaintext)
        setImportedCodes(records)
        setIsScanned(true)
        setState('upload')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (/incorrect password/i.test(message)) {
        setErrors({
          password: t(
            'Failed to decrypt file. Please check your password and try again.'
          )
        })
      } else {
        setImportError(message)
      }
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div style={styles.container}>
      {state === 'default' && (
        <>
          <PageHeader
            as="h1"
            title={t('Import')}
            subtitle={t(
              'To import data from another authenticator, first access the authenticator, export your data, and then upload the exported file into the designated field'
            )}
          />

          <div style={styles.listWrapper}>
            <Text color={theme.colors.colorTextSecondary} variant="caption">
              {t('Select Import Source')}
            </Text>

            <div style={styles.listItems}>
              {importCodesOptions.map((option, index) => (
                <div
                  key={option.title}
                  style={
                    index < importCodesOptions.length - 1
                      ? styles.listItemBorder
                      : undefined
                  }
                >
                  <ListItem
                    title={option.title}
                    subtitle={t('Required Format: {format}', {
                      format: option.accepts
                        .join(', ')
                        .replace(/\./g, '')
                        .toUpperCase()
                    })}
                    testID={option.testID}
                    rightElement={
                      <KeyboardArrowRightFilled
                        width={16}
                        height={16}
                        color={theme.colors.colorTextPrimary}
                      />
                    }
                    onClick={() => {
                      setSelectedOption(option)
                      setFiles([])
                      setState('upload')
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {(state === 'upload' || state === 'inputPassword') && selectedOption && (
        <>
          <div style={styles.backButton}>
            <Button
              size="small"
              variant="tertiary"
              iconBefore={
                <ArrowBackOutined color={theme.colors.colorTextPrimary} />
              }
              onClick={handleBack}
              aria-label={t('back')}
            />
            <Text>{t('Back')}</Text>
          </div>

          <div style={styles.header}>
            <Title as="h2">
              {t('Import from')} {selectedOption.title}
            </Title>
            <Text color={theme.colors.colorTextSecondary} as="p">
              {selectedOption.description}
              {selectedOption.learnMoreUrl && (
                <>
                  {' '}
                  {t('Additionally,')}{' '}
                  <Link
                    onClick={() =>
                      window.electronAPI?.openExternal(
                        selectedOption.learnMoreUrl!
                      )
                    }
                  >
                    {t(
                      `Learn more about exporting codes from ${selectedOption.title}`
                    )}
                  </Link>
                  {'.'}
                </>
              )}
            </Text>
          </div>

          {state === 'inputPassword' ? (
            <div style={styles.passwordSection}>
              <PasswordField
                label={t('File Password')}
                placeholder={t('Enter file password')}
                {...passwordProps}
                onChange={(e) => onChangePassword(e.target.value)}
                testID="import-codes-password-field"
              />
              <Text color={theme.colors.colorTextSecondary} variant="caption">
                {t(
                  'This file is encrypted. Enter the password used to create this backup.'
                )}
              </Text>
            </div>
          ) : (
            <div style={styles.uploadArea}>
              <UploadField
                acceptedFormats={selectedOption.accepts}
                maxFiles={selectedOption.multiFile ? 0 : 1}
                files={files}
                onFilesChange={handleFilesChange}
                allowDragAndDrop
                uploadLinkText={t('Upload file')}
                uploadSuffixText={t('or drag and drop it here')}
                formatsPrefix={t('Required Format:')}
                testID="import-codes-upload-field"
              />
            </div>
          )}

          {importError && (
            <AlertMessage
              title=""
              variant="error"
              size="small"
              description={importError}
              testID="import-codes-scan-error"
            />
          )}

          <div style={styles.footer}>
            {!isScanned &&
              (state === 'inputPassword' ? (
                <Button
                  variant="primary"
                  size="small"
                  disabled={!values.password || isScanning}
                  isLoading={isScanning}
                  onClick={handleSubmit(handleImportEncrypted)}
                  data-testid="import-codes-import-button"
                >
                  {t('Scan File')}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="small"
                  disabled={
                    (selectedOption.type ===
                    ImportCodesOptionType.GoogleAuthenticator
                      ? files.length === 0
                      : codeFileInfo === null) || isScanning
                  }
                  isLoading={isScanning}
                  onClick={handleContinue}
                  data-testid="import-codes-scan-file-button"
                >
                  {codeFileInfo?.isEncrypted ? t('Continue') : t('Scan File')}
                </Button>
              ))}
          </div>

          {isScanned && (
            <ScanResultsView
              importedCodes={importedCodes}
              onImportComplete={resetToDefault}
            />
          )}
        </>
      )}
    </div>
  )
}
