import { useEffect } from 'react'

import { vaultGetFile } from 'lockwright-lib-vault'

import { logger } from '../utils/logger'

/**
 * @param {object} [param0]
 * @param {string[]} [param0.fieldNames]
 * @param {(name: string, value: unknown) => void} [param0.updateValues]
 * @param {{ data?: Record<string, unknown> } | undefined} [param0.initialRecord]
 */
export const useGetMultipleFiles = ({
  fieldNames,
  updateValues,
  initialRecord
} = {}) => {
  const getFilesAsync = async (fieldName) => {
    const attachments = initialRecord?.data?.[fieldName] || []

    if (!attachments.length) {
      return
    }

    try {
      const files = await Promise.all(
        attachments.map(async (attachment) => {
          const file = await vaultGetFile(
            `record/${initialRecord.id}/file/${attachment.id}`
          )
          return { ...attachment, buffer: file }
        })
      )

      updateValues(fieldName, files)
    } catch (error) {
      logger.error('useGetMultipleFiles', 'Error retrieving files:', error)
    }
  }

  useEffect(() => {
    ;(async () => {
      await Promise.all(
        fieldNames.map(async (fieldName) => {
          if (!fieldName || !updateValues || !initialRecord) {
            return
          }
          await getFilesAsync(fieldName)
        })
      )
    })()
  }, [initialRecord])
}
