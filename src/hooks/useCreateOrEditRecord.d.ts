import { PassType } from '../shared/types'

export type CreateOrEditRecordParams = {
  recordType: string
  initialRecord?: unknown
  selectedFolder?: string
  isFavorite?: boolean
  setValue?: (value: string, type: PassType) => void
  contextLabel?: string
  contextKind?: 'site' | 'entry'
  uses?: Array<{ contextLabel: string; contextKind: 'site' | 'entry' }>
}

export function useCreateOrEditRecord(): {
  handleCreateOrEditRecord: (params: CreateOrEditRecordParams) => void
}
