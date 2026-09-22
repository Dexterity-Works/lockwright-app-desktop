import React, { useMemo, useState } from 'react'

import { useForm } from 'lockwright-lib-ui-react-hooks'
import { Validator } from 'lockwright-utils-validator'
import {
  AlertMessage,
  Button,
  Combobox,
  Dialog,
  Form,
  InputField,
  MultiSlotInput,
  PasswordField
} from 'lockwright-lib-ui-react-native-components'
import {
  RECORD_TYPES,
  matchLoginRecords,
  parseOtpInput,
  useFindOtpDuplicates,
  useCreateRecord,
  useRecords,
  validateOtpInput
} from 'lockwright-lib-vault'
import { createStyles } from './CreateOrEditAuthenticatorModalContent.styles'
import { useGlobalLoading } from '../../../../context/LoadingContext'
import { useModal } from '../../../../context/ModalContext'
import { useToast } from '../../../../context/ToastContext'
import { useTranslation } from '../../../../hooks/useTranslation'
import { useScrollToFirstError } from '../../../../hooks/useScrollToFirstError'
import { RecordItemIcon } from '../../../../components/RecordItemIcon/RecordItemIcon'

export type CreateOrEditAuthenticatorModalContentProps = {
  selectedFolder?: string
  isFavorite?: boolean
  onTypeChange?: (type: string) => void
}

export const CreateOrEditAuthenticatorModalContent = ({
  selectedFolder,
  isFavorite
}: CreateOrEditAuthenticatorModalContentProps) => {
  const { t } = useTranslation()
  const { closeModal } = useModal()
  const styles = createStyles()
  const { setToast } = useToast()

  const { createRecord, isLoading: isCreateLoading } = useCreateRecord({
    onCompleted: () => {
      closeModal()
      setToast({ message: t('Record created successfully') })
    }
  })

  const { updateRecords, isLoading: isUpdateLoading } = useRecords({
    onCompleted: () => {
      closeModal()
      setToast({ message: t('Record updated successfully') })
    }
  })

  const { data: loginRecords } = useRecords({
    variables: { filters: { type: RECORD_TYPES.LOGIN } }
  }) as { data?: Array<{ id: string; data?: Record<string, unknown> }> }

  const onError = (error: { message: string }) => {
    setToast({ message: error.message })
  }

  const isLoading = isCreateLoading || isUpdateLoading

  useGlobalLoading({ isLoading })

  const schema = useMemo(
    () =>
      Validator.object({
        title: Validator.string().required(t('Title is required')),
        otpSecret: Validator.string().refine(validateOtpInput)
      }),
    [t]
  )

  const { register, handleSubmit, values, setValue, errors } = useForm({
    initialValues: {
      title: '',
      otpSecret: '',
      linkedRecordId: ''
    },
    validate: (formValues: Record<string, unknown>) =>
      schema.validate(formValues)
  })

  useScrollToFirstError(errors)

  const parsedOtp = useMemo(
    () => parseOtpInput(values.otpSecret),
    [values.otpSecret]
  )

  const matchedRecords = useMemo(
    () => matchLoginRecords(parsedOtp, loginRecords ?? []),
    [parsedOtp, loginRecords]
  )

  const { data: duplicates } = useFindOtpDuplicates({
    secret: parsedOtp?.secret,
    excludeRecordId: values.linkedRecordId || undefined
  })
  const duplicateRecord = duplicates[0]

  const linkedRecord = useMemo(
    () =>
      values.linkedRecordId
        ? (loginRecords ?? []).find((r) => r.id === values.linkedRecordId)
        : undefined,
    [values.linkedRecordId, loginRecords]
  )

  const parsedEmail =
    typeof parsedOtp?.label === 'string' ? parsedOtp.label : ''

  const onSubmit = (formValues: Record<string, unknown>) => {
    const otpInput = (formValues.otpSecret as string)?.trim() || undefined
    const selectedLinkedRecord = formValues.linkedRecordId
      ? (loginRecords ?? []).find((r) => r.id === formValues.linkedRecordId)
      : undefined

    if (selectedLinkedRecord) {
      updateRecords(
        [
          {
            ...selectedLinkedRecord,
            data: {
              ...(selectedLinkedRecord.data ?? {}),
              otpInput
            }
          }
        ],
        onError
      )
      return
    }

    createRecord(
      {
        type: RECORD_TYPES.LOGIN,
        folder: selectedFolder,
        isFavorite,
        data: {
          title: formValues.title,
          otpInput,
          ...(parsedEmail ? { username: parsedEmail } : {})
        }
      },
      onError
    )
  }

  const [searchQuery, setSearchQuery] = useState('')

  const dropdownRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      return (loginRecords ?? []).filter((r) => {
        const title = ((r.data?.title as string) ?? '').toLowerCase()
        const username = ((r.data?.username as string) ?? '').toLowerCase()
        return title.includes(q) || username.includes(q)
      })
    }
    return matchedRecords.map(({ record }) => record)
  }, [searchQuery, loginRecords, matchedRecords])

  const titleField = register('title')
  const otpSecretField = register('otpSecret')

  return (
    <Dialog
      title={t('New Authenticator Code Item')}
      onClose={closeModal}
      testID='createoredit-authenticator-dialog'
      closeButtonTestID='createoredit-authenticator-close'
      footer={
        <>
          <Button
            variant='secondary'
            size='small'
            type='button'
            onClick={closeModal}
            data-testid='createoredit-authenticator-button-discard'
          >
            {t('Discard')}
          </Button>
          <Button
            variant='primary'
            size='small'
            type='button'
            disabled={
              isLoading ||
              (!linkedRecord && !values.title?.trim()) ||
              !!otpSecretField.error
            }
            isLoading={isLoading}
            onClick={() => handleSubmit(onSubmit)()}
            data-testid='createoredit-authenticator-button-save'
          >
            {t('Add Item')}
          </Button>
        </>
      }
    >
      <Form
        onSubmit={handleSubmit(onSubmit)}
        style={styles.form as React.ComponentProps<typeof Form>['style']}
        testID='createoredit-authenticator-form'
      >
        <InputField
          label={t('Title')}
          placeholder={t('Enter Title')}
          value={
            linkedRecord
              ? ((linkedRecord.data?.title as string) ?? '')
              : titleField.value
          }
          onChange={(e) => titleField.onChange(e.target.value)}
          error={titleField.error || undefined}
          disabled={!!linkedRecord}
          testID='createoredit-authenticator-input-title'
        />


        <PasswordField
          label={t('Authenticator Secret Key')}
          placeholder={t('Enter your key or URI')}
          value={otpSecretField.value}
          error={otpSecretField.error || undefined}
          onChange={(e) => otpSecretField.onChange(e.target.value)}
          testID='createoredit-authenticator-input-otpsecret'
        />

        {duplicateRecord && (
          <AlertMessage
            variant="warning"
            size="small"
            title={t('Potential code duplicate')}
            description={t(
              `An item with this secret key or URL already exists: ${duplicateRecord.title || t('Untitled')}`
            )}
            testID="otp-duplicate-warning"
          />
        )}

        <MultiSlotInput testID='createoredit-authenticator-link-slot'>
          <Combobox
            label={t('Link to Existing Login')}
            title={t('Change Login Match')}
            value={(linkedRecord?.data?.title as string) ?? ''}
            placeholder={t('No record linked')}
            onClear={() => setValue('linkedRecordId', '')}
            onOpenChange={(open) => {
              if (!open) setSearchQuery('')
            }}
            items={dropdownRecords.map((record) => ({
              id: record.id,
              title: (record.data?.title as string) ?? t('Untitled'),
              subtitle: record.data?.username as string | undefined,
              icon: (
                <RecordItemIcon
                  record={{ ...record, type: RECORD_TYPES.LOGIN }}
                  size={32}
                />
              )
            }))}
            selectedId={values.linkedRecordId}
            onSelect={(id) => {
              setValue('linkedRecordId', id)
              const rec = (loginRecords ?? []).find((r) => r.id === id)
              setValue('title', (rec?.data?.title as string) ?? '')
            }}
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder={t('Search...')}
            emptyText={
              searchQuery.trim()
                ? t('No login items found')
                : t('No matching login items')
            }
            testID='createoredit-authenticator-link-combobox'
          />
        </MultiSlotInput>
      </Form>
    </Dialog>
  )
}
