import React, { useState } from 'react'

import { useForm } from 'lockwright-lib-ui-react-hooks'
import { Validator } from 'lockwright-utils-validator'
import {
  AttachmentField as UiKitAttachmentField,
  Button,
  Dialog,
  Form,
  InputField,
  MultiSlotInput,
  PasswordField,
  Text,
  useTheme
} from 'lockwright-lib-ui-react-native-components'
import { RECORD_TYPES } from 'lockwright-lib-vault'
import { useCreateRecord, useRecords } from 'lockwright-lib-vault'
import {
  Add,
  SyncLock,
  TrashOutlined,
  UploadFileFilled
} from 'lockwright-lib-ui-react-native-components/icons'
import { html } from 'htm/react'

import { createStyles } from './CreateOrEditWifiModalContent.styles'
import { ATTACHMENTS_FIELD_KEY } from '../../../../constants/formFields'
import { useGlobalLoading } from '../../../../context/LoadingContext'
import { useModal } from '../../../../context/ModalContext'
import { useToast } from '../../../../context/ToastContext'
import { useTranslation } from '../../../../hooks/useTranslation'
import { useScrollToFirstError } from '../../../../hooks/useScrollToFirstError'
import { useCreateOrEditRecord } from '../../../../hooks/useCreateOrEditRecord'
import { useGetMultipleFiles } from '../../../../hooks/useGetMultipleFiles'
import { getFilteredAttachmentsById } from '../../../../utils/getFilteredAttachmentsById'
import { handleFileSelect } from '../../../../utils/handleFileSelect'
import {
  historyUses,
  markHistoryUsed
} from '../../../../utils/passwordGeneratorHistory'
import { UploadFilesModalContent } from '../../UploadFilesModalContent'
import { PasswordFieldStrengthIndicator } from '../../../../components/PasswordFieldStrengthIndicator'
import { PassType } from '../../../../shared/types'
import { FolderDropdown } from '../../../../components/FolderDropdown/FolderDropdown'

export type CreateOrEditWifiModalContentProps = {
  initialRecord?: {
    data: {
      title: string
      password: string
      note: string
      customFields: { type: string; name: string }[]
      attachments: { id: string; name: string }[]
      [key: string]: unknown
    }
    folder?: string
    isFavorite?: boolean
    attachments?: { id: string; name: string }[]
    [key: string]: unknown
  }
  selectedFolder?: string
  isFavorite?: boolean
  onTypeChange: (type: string) => void
}

export const CreateOrEditWifiModalContent = ({
  initialRecord,
  selectedFolder,
  isFavorite,
  onTypeChange: _onTypeChange
}: CreateOrEditWifiModalContentProps) => {
  const { t } = useTranslation()
  const { closeModal, setModal } = useModal()
  const { handleCreateOrEditRecord } = useCreateOrEditRecord()
  const [passwordType, setPasswordType] = useState<PassType>(PassType.Password)

  const { setToast } = useToast()
  const { theme } = useTheme()
  const styles = createStyles()

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

  const onError = (error: { message: string }) => {
    setToast({ message: error.message })
  }

  const isLoading = isCreateLoading || isUpdateLoading
  useGlobalLoading({ isLoading })

  const schema = Validator.object({
    title: Validator.string().required(t('Name is required')),
    password: Validator.string().required(t('Password is required')),
    note: Validator.string(),
    customFields: Validator.array().items(
      Validator.object({
        note: Validator.string()
      })
    ),
    folder: Validator.string(),
    attachments: Validator.array().items(
      Validator.object({
        id: Validator.string(),
        name: Validator.string().required()
      })
    )
  })

  const { register, handleSubmit, registerArray, setValue, values, errors } = useForm({
    initialValues: {
      title: initialRecord?.data?.title ?? '',
      password: initialRecord?.data?.password ?? '',
      note: initialRecord?.data?.note ?? '',
      customFields: initialRecord?.data?.customFields?.length
        ? initialRecord.data.customFields
        : [{ type: 'note', note: '' }],
      folder: selectedFolder ?? initialRecord?.folder,
      attachments: initialRecord?.attachments ?? []
    },
    validate: (formValues: Record<string, unknown>) =>
      schema.validate(formValues)
  })

  useScrollToFirstError(errors)

  const {
    value: customFieldsList,
    addItem: addCustomField,
    registerItem: registerCustomFieldItem,
    removeItem: removeCustomFieldItem
  } = registerArray('customFields')

  useGetMultipleFiles({
    fieldNames: [ATTACHMENTS_FIELD_KEY],
    updateValues: setValue,
    initialRecord
  })

  const onSubmit = (formValues: Record<string, unknown>) => {
    const data = {
      type: RECORD_TYPES.WIFI_PASSWORD,
      folder: formValues.folder,
      isFavorite: initialRecord?.isFavorite ?? isFavorite,
      data: {
        ...(initialRecord?.data ? initialRecord.data : {}),
        title: formValues.title,
        password: formValues.password,
        note: formValues.note,
        customFields: (
          (formValues.customFields as Array<{ type: string; note?: string }>) ??
          []
        ).filter((f) => f.note?.trim().length),
        attachments: formValues.attachments
      }
    }

    const password =
      typeof formValues.password === 'string' ? formValues.password : ''
    const uses = historyUses({ title: formValues.title })
    if (password && uses.length) {
      void markHistoryUsed(password, { uses, onlyExisting: true })
    }

    if (initialRecord) {
      updateRecords([{ ...initialRecord, ...data }], onError)
    } else {
      createRecord(data, onError)
    }
  }

  const handleFileLoad = () => {
    setModal(
      html`<${UploadFilesModalContent}
        type=${'file'}
        onFilesSelected=${(files: File[]) =>
          handleFileSelect({
            files: files as unknown as FileList,
            fieldName: ATTACHMENTS_FIELD_KEY,
            setValue,
            values
          })}
      />`
    )
  }

  const isEdit = !!initialRecord

  const titleField = register('title')
  const passwordField = register('password')
  const noteField = register('note')

  return (
    <Dialog
      title={isEdit ? t('Edit Wi-Fi Item') : t('New Wi-Fi Item')}
      onClose={closeModal}
      testID="createoredit-wifi-dialog"
      closeButtonTestID="createoredit-wifi-close"
      footer={
        <>
          <Button
            variant="secondary"
            size="small"
            type="button"
            onClick={closeModal}
            data-testid="createoredit-wifi-button-discard"
          >
            {t('Discard')}
          </Button>
          <Button
            variant="primary"
            size="small"
            type="button"
            disabled={isLoading || (!isEdit && (!values.title?.trim() || !values.password?.trim()))}
            isLoading={isLoading}
            onClick={() => handleSubmit(onSubmit)()}
            data-testid="createoredit-wifi-button-save"
          >
            {isEdit ? t('Save') : t('Add Item')}
          </Button>
        </>
      }
    >
      <Form
        onSubmit={handleSubmit(onSubmit)}
        style={styles.form as React.ComponentProps<typeof Form>['style']}
        testID="createoredit-wifi-form"
      >
        <div style={styles.sectionLabel}>
          <Text variant="caption" color={theme.colors.colorTextSecondary}>
            {t('Credentials')}
          </Text>
        </div>

        <MultiSlotInput
          testID="createoredit-wifi-credentials-slot"
          actions={
            <Button
              variant="tertiaryAccent"
              size="small"
              type="button"
              iconBefore={<SyncLock width={16} height={16} />}
              onClick={() => {
                handleCreateOrEditRecord({
                  recordType: 'password',
                  setValue: (value: string, type: PassType) => {
                    setValue('password', value)
                    setPasswordType(
                      type === PassType.PassPhrase
                        ? PassType.PassPhrase
                        : PassType.Password
                    )
                  },
                  uses: historyUses({ title: titleField.value })
                })
              }}
              data-testid="createoredit-wifi-button-generatepassword"
            >
              {t('Generate Password')}
            </Button>
          }
        >
          <InputField
            label={t('Wi-Fi Name')}
            placeholder={t('Enter Name of Network')}
            value={titleField.value}
            onChange={(e) => titleField.onChange(e.target.value)}
            error={titleField.error || undefined}
            testID="createoredit-wifi-input-name"
          />
          <PasswordFieldStrengthIndicator
            testID="createoredit-wifi-input-password"
            passwordField={passwordField}
            passwordType={passwordType}
            setPasswordType={setPasswordType}
          />
        </MultiSlotInput>

        <div style={styles.sectionLabel}>
          <Text variant="caption" color={theme.colors.colorTextSecondary}>
            {t('Additional')}
          </Text>
        </div>

        <FolderDropdown
          selectedFolder={values?.folder}
          onFolderSelect={(name) =>
            setValue('folder', name === values.folder ? '' : name)
          }
        />

        <MultiSlotInput
          testID="createoredit-wifi-attachments-slot"
          actions={
            <Button
              variant="tertiaryAccent"
              size="small"
              type="button"
              iconBefore={<Add width={16} height={16} />}
              onClick={handleFileLoad}
              data-testid="createoredit-wifi-button-addattachment"
            >
              {t('Add Another Attachment')}
            </Button>
          }
        >
          {values.attachments.length > 0
            ? values.attachments.map(
                (
                  attachment: {
                    id?: string
                    tempId?: string
                    name: string
                  },
                  index: number
                ) => (
                  <UiKitAttachmentField
                    key={attachment.id || attachment.tempId}
                    label={t('Attachment')}
                    value={attachment.name}
                    testID={`createoredit-wifi-attachment-${index}`}
                    rightSlot={
                      <Button
                        variant="tertiary"
                        size="small"
                        type="button"
                        aria-label={t('Delete File')}
                        iconBefore={
                          <TrashOutlined
                            width={16}
                            height={16}
                            color={theme.colors.colorTextPrimary}
                          />
                        }
                        onClick={() =>
                          setValue(
                            ATTACHMENTS_FIELD_KEY,
                            getFilteredAttachmentsById(
                              values.attachments,
                              attachment
                            )
                          )
                        }
                        data-testid={`createoredit-wifi-button-deleteattachment-${index}`}
                      />
                    }
                  />
                )
              )
            : null}
          <UiKitAttachmentField
            label={t('Attachment')}
            placeholder={t('Add or Drop File / Photos')}
            onClick={handleFileLoad}
            testID="createoredit-wifi-attachment-upload"
            rightSlot={
              <UploadFileFilled
                width={16}
                height={16}
                color={theme.colors.colorTextPrimary}
              />
            }
          />
        </MultiSlotInput>

        <InputField
          label={t('Comment')}
          placeholder={t('Enter Comment')}
          value={noteField.value}
          onChange={(e) => noteField.onChange(e.target.value)}
          error={noteField.error || undefined}
          testID="createoredit-wifi-input-comment"
        />

        <MultiSlotInput
          testID="createoredit-wifi-hiddenmessage-slot"
          actions={
            <Button
              variant="tertiaryAccent"
              size="small"
              type="button"
              iconBefore={<Add width={16} height={16} />}
              onClick={() => addCustomField({ type: 'note', note: '' })}
              data-testid="createoredit-wifi-button-addhiddenmessage"
            >
              {t('Add Another Message')}
            </Button>
          }
        >
          {customFieldsList.map((field: { id: string }, index: number) => {
            const fieldReg = registerCustomFieldItem('note', index)
            const canRemove = customFieldsList.length > 1
            return (
              <PasswordField
                key={field.id}
                label={t('Hidden Message')}
                placeholder={t('Enter Hidden Message')}
                value={fieldReg.value}
                onChange={(e) => fieldReg.onChange(e.target.value)}
                error={fieldReg.error || undefined}
                testID={`createoredit-wifi-input-hiddenmessage-${index}`}
                rightSlot={
                  canRemove ? (
                    <Button
                      variant="tertiary"
                      size="small"
                      type="button"
                      aria-label={t('Remove')}
                      iconBefore={
                        <TrashOutlined
                          width={16}
                          height={16}
                          color={theme.colors.colorTextPrimary}
                        />
                      }
                      onClick={() => removeCustomFieldItem(index)}
                      data-testid={`createoredit-wifi-button-removehiddenmessage-${index}`}
                    />
                  ) : undefined
                }
              />
            )
          })}
        </MultiSlotInput>
      </Form>
    </Dialog>
  )
}
