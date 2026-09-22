import { parseOtpToCsvText } from 'lockwright-lib-data-export'

import { downloadFile } from './downloadFile'

export const handleExportOtpCsv = async (data) => {
  const [file] = parseOtpToCsvText(data)
  if (!file) return

  downloadFile({ filename: file.filename, content: file.data }, 'csv')
}
