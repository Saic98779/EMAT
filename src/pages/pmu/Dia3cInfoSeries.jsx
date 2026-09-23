import { useEffect, useMemo, useState } from 'react'
import {
  PmuFormShell, PmuSection, FieldRow, FieldCell, FileDropField, todayIso,
  RhfTextField, RhfSelectField, RhfFileField, SHRINK_LABEL, CHIP_RENDER_VALUE,
  useForm,
} from './_shared'
import {
  createContent, updateContent, uploadContentAttachments,
  toBackendChannels, DIA_ENDPOINTS,
} from '../../apis/diaContent'

// DIA — 3C Info-Series
// GT_PMU raises; SIDBI HO Checker approves.

const CHANNELS = [
  { value: 'Email', label: 'Email' },
  { value: 'SMS', label: 'SMS' },
  { value: 'WhatsApp', label: 'WhatsApp' },
]
const ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp'

const INITIAL = {
  topic: '', chapterNo: '', subjectLine: '',
  relevance: '', brief: '', mainContent: '',
  channels: [], publishDate: '',
  attachment: null,
}

function recordToDefaults(record) {
  if (!record) return INITIAL
  return {
    topic: record.topic || '',
    chapterNo: record.chapterNo || '',
    subjectLine: record.subjectLine || '',
    relevance: record.relevanceOfTopic || '',
    brief: record.briefOfContent || '',
    mainContent: record.mainContent || '',
    channels: Array.isArray(record.bulkMessaging) ? record.bulkMessaging : [],
    publishDate: (record.proposedPublishDate || '').slice(0, 10),
    attachment: null,
  }
}

export default function Dia3cInfoSeries({ editId = null, initialRecord = null } = {}) {
  const isEdit = !!editId
  const existingAttachment = initialRecord?.attachment || null
  const defaults = useMemo(() => recordToDefaults(initialRecord), [initialRecord])
  const methods = useForm({ mode: 'onSubmit', defaultValues: defaults })
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const publishMin = useMemo(() => ({ min: isEdit ? undefined : todayIso() }), [isEdit])

  // Belt-and-suspenders: RHF captures defaultValues on first mount, but
  // if Suspense / lazy-loading mounts the form before `initialRecord` is
  // fully hydrated, the initial defaults may be blank. Reset explicitly
  // when the record arrives.
  useEffect(() => {
    if (initialRecord) methods.reset(recordToDefaults(initialRecord))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRecord])

  const submit = async (values) => {
    setSubmitting(true)
    try {
      const dto = {
        topic: values.topic.trim(),
        chapterNo: values.chapterNo.trim(),
        subjectLine: values.subjectLine.trim(),
        relevanceOfTopic: values.relevance.trim(),
        briefOfContent: values.brief.trim(),
        mainContent: values.mainContent.trim(),
        bulkMessaging: toBackendChannels(values.channels),
        proposedPublishDate: values.publishDate || null,
        attachment: isEdit ? existingAttachment : null,
      }
      const savedId = isEdit
        ? (await updateContent(DIA_ENDPOINTS.INFO_SERIES, editId, dto))?.id ?? editId
        : (await createContent(DIA_ENDPOINTS.INFO_SERIES, dto))?.id
      if (values.attachment && savedId) {
        try {
          const urls = await uploadContentAttachments(DIA_ENDPOINTS.INFO_SERIES, savedId, [values.attachment])
          if (urls[0]) {
            await updateContent(DIA_ENDPOINTS.INFO_SERIES, savedId, { ...dto, attachment: urls[0] })
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
      title={isEdit ? 'Resubmit 3C Info-Series' : '3C Info-Series'}
      subtitle={isEdit
        ? 'Address the checker\'s remarks and resubmit for re-review.'
        : 'Draft an info-series entry — submits to SIDBI HO Checker for approval.'}
      methods={methods}
      onSubmit={submit}
      onReset={reset}
      submitting={submitting}
      submitLabel={isEdit ? 'Resubmit for Approval' : 'Submit for Approval'}
      toast={toast} onToastClose={() => setToast(null)}
    >
      <PmuSection first title="Entry details">
        <FieldRow>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <RhfTextField name="topic" fullWidth required label="Topic" rules={REQUIRED_TEXT} />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <RhfTextField name="chapterNo" fullWidth required label="Chapter No." rules={REQUIRED_TEXT} />
          </FieldCell>
          <FieldCell>
            <RhfTextField name="subjectLine" fullWidth required label="Subject line" rules={REQUIRED_TEXT} />
          </FieldCell>
        </FieldRow>
      </PmuSection>

      <PmuSection title="Content" description="Short summary + full body copy that goes out.">
        <FieldRow>
          <FieldCell>
            <RhfTextField
              name="relevance" fullWidth required multiline minRows={2}
              label="Relevance of the topic"
              rules={REQUIRED_TEXT}
            />
          </FieldCell>
          <FieldCell>
            <RhfTextField
              name="brief" fullWidth required multiline minRows={3}
              label="Brief of the content"
              rules={REQUIRED_TEXT}
            />
          </FieldCell>
          <FieldCell>
            <RhfTextField
              name="mainContent" fullWidth required multiline minRows={6}
              label="Main content"
              rules={REQUIRED_TEXT}
            />
          </FieldCell>
        </FieldRow>
      </PmuSection>

      <PmuSection title="Delivery">
        <FieldRow>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <RhfSelectField
              name="channels"
              label="Bulk messaging"
              multiple
              options={CHANNELS}
              renderValue={CHIP_RENDER_VALUE}
            />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <RhfTextField
              name="publishDate" fullWidth type="date" label="Proposed publish date"
              InputLabelProps={SHRINK_LABEL}
              inputProps={publishMin}
            />
          </FieldCell>
          <FieldCell>
            <RhfFileField
              name="attachment"
              label="Attachment"
              accept={ATTACHMENT_ACCEPT}
              helperText={isEdit
                ? (existingAttachment
                    ? `Currently attached: ${existingAttachment.split('/').pop().split('?')[0]}. Pick a file to replace it.`
                    : 'No file was previously attached. You can upload one now if needed.')
                : 'PDF, Word, PPT, PNG or JPG. Optional.'}
            />
          </FieldCell>
        </FieldRow>
      </PmuSection>
    </PmuFormShell>
  )
}

const REQUIRED_TEXT = { validate: (v) => (String(v || '').trim() ? true : 'Required.') }
