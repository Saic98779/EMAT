import { useMemo, useState } from 'react'
import { InputAdornment } from '@mui/material'
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined'
import {
  PmuFormShell, PmuSection, FieldRow, FieldCell, todayIso, URL_RE,
  RhfTextField, RhfSelectField, RhfFileField, SHRINK_LABEL, CHIP_RENDER_VALUE,
  useForm, useWatch,
} from './_shared'
import {
  createContent, updateContent, uploadContentAttachments,
  toBackendChannels, DIA_ENDPOINTS,
} from '../../apis/diaContent'

// DIA — Bulk Broadcast
// GT_PMU raises; SIDBI HO Checker approves.

const CHANNELS = [
  { value: 'SMS', label: 'SMS' },
  { value: 'WhatsApp', label: 'WhatsApp' },
]
const ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp'
const MAIN_CONTENT_MAX = 5000

const LINK_ADORNMENT = {
  startAdornment: (
    <InputAdornment position="start">
      <LinkOutlinedIcon fontSize="small" />
    </InputAdornment>
  ),
}
const MAIN_INPUT_PROPS = { maxLength: MAIN_CONTENT_MAX }

const INITIAL = {
  topic: '', subject: '',
  relevance: '', sample: '',
  broadcastDate: '',
  mainContent: '',
  channels: [],
  link: '',
  attachment: null,
}

function recordToDefaults(record) {
  if (!record) return INITIAL
  const channel = record.broadcastThrough
  return {
    topic: record.topic || '',
    subject: record.subjectLine || '',
    relevance: record.relevanceOfTopic || '',
    sample: record.sampleForBroadcast || '',
    broadcastDate: (record.dateOfBroadcast || '').slice(0, 10),
    mainContent: record.mainContent || '',
    channels: channel ? [channel] : [],
    link: record.link || '',
    attachment: null,
  }
}

export default function DiaBulkBroadcast({ editId = null, initialRecord = null } = {}) {
  const isEdit = !!editId
  const existingAttachment = initialRecord?.attachment || null
  const defaults = useMemo(() => recordToDefaults(initialRecord), [initialRecord])
  const methods = useForm({ mode: 'onSubmit', defaultValues: defaults })
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const broadcastMin = useMemo(() => ({ min: isEdit ? undefined : todayIso() }), [isEdit])

  const submit = async (values) => {
    setSubmitting(true)
    try {
      const dto = {
        topic: values.topic.trim(),
        subjectLine: values.subject.trim(),
        relevanceOfTopic: values.relevance.trim(),
        sampleForBroadcast: values.sample.trim(),
        dateOfBroadcast: values.broadcastDate,
        mainContent: values.mainContent.trim(),
        broadcastThrough: toBackendChannels(values.channels)[0] || null,
        link: values.link.trim() || null,
        attachment: isEdit ? existingAttachment : null,
      }
      const savedId = isEdit
        ? (await updateContent(DIA_ENDPOINTS.BROADCAST, editId, dto))?.id ?? editId
        : (await createContent(DIA_ENDPOINTS.BROADCAST, dto))?.id
      if (values.attachment && savedId) {
        try {
          const urls = await uploadContentAttachments(DIA_ENDPOINTS.BROADCAST, savedId, [values.attachment])
          if (urls[0]) {
            await updateContent(DIA_ENDPOINTS.BROADCAST, savedId, { ...dto, attachment: urls[0] })
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
      title={isEdit ? 'Resubmit Bulk Broadcast' : 'Bulk Broadcast'}
      subtitle={isEdit
        ? 'Address the checker\'s remarks and resubmit for re-review.'
        : 'Draft a SMS / WhatsApp broadcast — submits to SIDBI HO Checker for approval.'}
      approvalNote="Once submitted, this broadcast goes to the SIDBI HO Checker for approval. Recipients receive it only after approval."
      methods={methods}
      onSubmit={submit}
      onReset={reset}
      submitting={submitting}
      submitLabel={isEdit ? 'Resubmit for Approval' : 'Submit for Approval'}
      toast={toast} onToastClose={() => setToast(null)}
    >
      <PmuSection first title="Broadcast details">
        <FieldRow>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <RhfTextField name="topic" fullWidth required label="Topic" rules={REQUIRED_TEXT} />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <RhfTextField name="subject" fullWidth required label="Subject line" rules={REQUIRED_TEXT} />
          </FieldCell>
          <FieldCell>
            <RhfTextField
              name="relevance" fullWidth required multiline minRows={2}
              label="Relevance of the topic"
              rules={REQUIRED_TEXT}
            />
          </FieldCell>
          <FieldCell>
            <RhfTextField
              name="sample" fullWidth required multiline minRows={2}
              label="Sample for the bulk broadcast"
              placeholder="Who receives this — audience, filters, sample size…"
              rules={REQUIRED_TEXT}
            />
          </FieldCell>
        </FieldRow>
      </PmuSection>

      <PmuSection title="Delivery">
        <FieldRow>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <RhfTextField
              name="broadcastDate" fullWidth type="date" required label="Date of broadcast"
              InputLabelProps={SHRINK_LABEL}
              inputProps={broadcastMin}
              rules={{
                required: 'Required.',
                validate: (v) => (v && v >= todayIso()) ? true : 'Broadcast date must be today or later.',
              }}
            />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <RhfSelectField
              name="channels"
              label="Broadcast through"
              multiple required
              options={CHANNELS}
              renderValue={CHIP_RENDER_VALUE}
              rules={{ validate: (v) => (Array.isArray(v) && v.length) ? true : 'Pick at least one channel.' }}
            />
          </FieldCell>
        </FieldRow>
      </PmuSection>

      <PmuSection title="Message body">
        <FieldRow>
          <FieldCell>
            <MainContentField />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <RhfTextField
              name="link"
              fullWidth label="Link" placeholder="https://…"
              InputProps={LINK_ADORNMENT}
              rules={{
                validate: (v) => (!v || URL_RE.test(String(v).trim())) ? true : 'Enter a valid URL.',
              }}
            />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <RhfFileField
              name="attachment"
              label="Attachment"
              accept={ATTACHMENT_ACCEPT}
              helperText={isEdit && existingAttachment
                ? `Currently attached: ${existingAttachment.split('/').pop().split('?')[0]}. Pick a file to replace it.`
                : 'PDF, Word, PPT or image. Optional.'}
            />
          </FieldCell>
        </FieldRow>
      </PmuSection>
    </PmuFormShell>
  )
}

// Live character counter uses `useWatch` — the surrounding form doesn't
// re-render on keystrokes, only this leaf does.
function MainContentField() {
  const value = useWatch({ name: 'mainContent' }) || ''
  const helper = `${value.length} / ${MAIN_CONTENT_MAX} characters`
  return (
    <RhfTextField
      name="mainContent"
      fullWidth required multiline minRows={6}
      label="Main content"
      inputProps={MAIN_INPUT_PROPS}
      helperText={helper}
      rules={{
        validate: (v) => {
          const s = String(v || '').trim()
          if (!s) return 'Required.'
          if (s.length > MAIN_CONTENT_MAX) return `Keep the main content under ${MAIN_CONTENT_MAX} characters.`
          return true
        },
      }}
    />
  )
}

const REQUIRED_TEXT = { validate: (v) => (String(v || '').trim() ? true : 'Required.') }
