import { useMemo, useState } from 'react'
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

export default function Dia3cInfoSeries() {
  const methods = useForm({ mode: 'onSubmit', defaultValues: INITIAL })
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const publishMin = useMemo(() => ({ min: todayIso() }), [])

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
        attachment: null,
      }
      const created = await createContent(DIA_ENDPOINTS.INFO_SERIES, dto)
      if (values.attachment && created?.id) {
        try {
          const urls = await uploadContentAttachments(DIA_ENDPOINTS.INFO_SERIES, created.id, [values.attachment])
          if (urls[0]) {
            await updateContent(DIA_ENDPOINTS.INFO_SERIES, created.id, { ...dto, attachment: urls[0] })
          }
        } catch (uploadErr) {
          setToast({ severity: 'warning', msg: `Saved, but attachment upload failed: ${uploadErr.message || 'unknown error'}.` })
          methods.reset(INITIAL)
          return
        }
      }
      setToast({ severity: 'success', msg: 'Submitted. Sent to SIDBI HO Checker for approval.' })
      methods.reset(INITIAL)
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Submit failed.' })
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => methods.reset(INITIAL)

  return (
    <PmuFormShell
      title="3C Info-Series"
      subtitle="Draft an info-series entry — submits to SIDBI HO Checker for approval."
      methods={methods}
      onSubmit={submit}
      onReset={reset}
      submitting={submitting}
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
              helperText="PDF, Word, PPT, PNG or JPG. Optional."
            />
          </FieldCell>
        </FieldRow>
      </PmuSection>
    </PmuFormShell>
  )
}

const REQUIRED_TEXT = { validate: (v) => (String(v || '').trim() ? true : 'Required.') }
