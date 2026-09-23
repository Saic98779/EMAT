import { useEffect, useMemo, useState } from 'react'
import {
  PmuFormShell, PmuSection, FieldRow, FieldCell, todayIso,
  RhfTextField, RhfFileField, SHRINK_LABEL, useForm, useWatch,
} from './_shared'
import {
  createContent, updateContent, uploadContentAttachments, DIA_ENDPOINTS,
} from '../../apis/diaContent'

// DIA — Pop-Ups
// GT_PMU raises; SIDBI HO Checker approves.

const ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp'
const INITIAL = { topic: '', relevance: '', startDate: '', endDate: '', attachments: [] }

function recordToDefaults(record) {
  if (!record) return INITIAL
  return {
    topic: record.topic || '',
    relevance: record.relevanceOfPopUp || '',
    startDate: (record.startDate || '').slice(0, 10),
    endDate: (record.endDate || '').slice(0, 10),
    attachments: [],
  }
}

export default function DiaPopUps({ editId = null, initialRecord = null } = {}) {
  const isEdit = !!editId
  const existingAttachment = initialRecord?.attachments || null
  const defaults = useMemo(() => recordToDefaults(initialRecord), [initialRecord])
  const methods = useForm({ mode: 'onSubmit', defaultValues: defaults })
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const startMin = useMemo(() => ({ min: isEdit ? undefined : todayIso() }), [isEdit])

  useEffect(() => {
    if (initialRecord) methods.reset(recordToDefaults(initialRecord))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRecord])

  const submit = async (values) => {
    setSubmitting(true)
    try {
      const dto = {
        topic: values.topic.trim(),
        relevanceOfPopUp: values.relevance.trim(),
        startDate: values.startDate,
        endDate: values.endDate,
        attachments: isEdit ? existingAttachment : null,
      }
      const savedId = isEdit
        ? (await updateContent(DIA_ENDPOINTS.POPUPS, editId, dto))?.id ?? editId
        : (await createContent(DIA_ENDPOINTS.POPUPS, dto))?.id
      if (values.attachments?.length && savedId) {
        try {
          const urls = await uploadContentAttachments(DIA_ENDPOINTS.POPUPS, savedId, values.attachments)
          if (urls.length) {
            await updateContent(DIA_ENDPOINTS.POPUPS, savedId, { ...dto, attachments: urls[0] })
          }
        } catch (uploadErr) {
          setToast({ severity: 'warning', msg: `Saved, but attachment upload failed: ${uploadErr.message || 'unknown error'}.` })
          if (!isEdit) methods.reset(INITIAL)
          return
        }
      }
      setToast({
        severity: 'success',
        msg: isEdit ? 'Resubmitted. The checker will re-review.' : 'Submitted. Sent to SIDBI HO Checker for approval.',
      })
      if (!isEdit) methods.reset(INITIAL)
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Submit failed.' })
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => methods.reset(isEdit ? defaults : INITIAL)

  return (
    <PmuFormShell
      title={isEdit ? 'Resubmit Pop-Up' : 'Pop-Ups'}
      subtitle={isEdit
        ? 'Address the checker\'s remarks and resubmit for re-review.'
        : 'Schedule a pop-up — submits to SIDBI HO Checker for approval.'}
      approvalNote="Once submitted, this pop-up goes to the SIDBI HO Checker for approval. It becomes live only after approval and stays visible for the duration you set."
      methods={methods}
      onSubmit={submit}
      onReset={reset}
      submitting={submitting}
      submitLabel={isEdit ? 'Resubmit for Approval' : 'Submit for Approval'}
      toast={toast} onToastClose={() => setToast(null)}
    >
      <PmuSection first title="Pop-up details">
        <FieldRow>
          <FieldCell>
            <RhfTextField name="topic" fullWidth required label="Topic" rules={REQUIRED_TEXT} />
          </FieldCell>
          <FieldCell>
            <RhfTextField
              name="relevance" fullWidth required multiline minRows={2}
              label="Relevance of the pop-up"
              rules={REQUIRED_TEXT}
            />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <RhfTextField
              name="startDate" fullWidth type="date" required label="Start date"
              InputLabelProps={SHRINK_LABEL}
              inputProps={startMin}
              rules={REQUIRED_DATE}
            />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <EndDateField />
          </FieldCell>
        </FieldRow>
      </PmuSection>

      <PmuSection title="Attachments">
        <RhfFileField
          name="attachments"
          multiple
          label="Files"
          accept={ATTACHMENT_ACCEPT}
          helperText={isEdit
            ? (existingAttachment
                ? `Currently attached: ${String(existingAttachment).split('/').pop().split('?')[0]}. Pick files to replace it.`
                : 'No files were previously attached. You can upload some now if needed.')
            : 'PDF, Word, PPT or image. Optional. You can add multiple.'}
        />
      </PmuSection>
    </PmuFormShell>
  )
}

const REQUIRED_TEXT = { validate: (v) => (String(v || '').trim() ? true : 'Required.') }
const REQUIRED_DATE = { required: 'Required.' }

function EndDateField() {
  const startDate = useWatch({ name: 'startDate' })
  const inputProps = useMemo(() => ({ min: startDate || todayIso() }), [startDate])
  return (
    <RhfTextField
      name="endDate" fullWidth type="date" required label="End date"
      InputLabelProps={SHRINK_LABEL}
      inputProps={inputProps}
      rules={{
        required: 'Required.',
        validate: (v, all) => (v && all.startDate && v < all.startDate)
          ? 'End date must be on or after the start date.'
          : true,
      }}
    />
  )
}
