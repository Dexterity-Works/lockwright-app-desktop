import { parseOtpToJson } from 'lockwright-lib-data-export'
import { encryptExportData } from 'lockwright-lib-vault'

import { downloadFile } from './downloadFile'

export const handleExportOtpJson = async (data, encryptionPassword = null) => {
  const [file] = parseOtpToJson(data)
  if (!file) return

  const content = encryptionPassword
    ? JSON.stringify(
        await encryptExportData(file.data, encryptionPassword),
        null,
        2
      )
    : file.data

  downloadFile({ filename: file.filename, content }, 'json')
}
