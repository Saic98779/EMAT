import { useState } from 'react'
import { InputAdornment } from '@mui/material'
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined'
import {
  PmuFormShell, PmuSection, FieldRow, FieldCell, URL_RE,
  RhfTextField, RhfFileField, useForm,
} from './_shared'
import {
  createContent, updateContent, uploadContentAttachments, DIA_ENDPOINTS,
} from '../../apis/diaContent'

// DIA — E-learning Module
// GT_PMU raises; SIDBI HO Checker approves.

const ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.webm,.mkv'

const LINK_ADORNMENT = {
  startAdornment: (
    <InputAdornment position="start">
      <LinkOutlinedIcon fontSize="small" />
    </InputAdornment>
  ),
}

const INITIAL = {
  topic: '', moduleName: '',
  relevance: '', brief: '', mainContent: '',
  link: '', placement: '',
  attachment: null,
}

export default function DiaElearningModule() {
  const methods = useForm({ mode: 'onSubmit', defaultValues: INITIAL })
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (values) => {
    setSubmitting(true)
    try {
      const dto = {
        topic: values.topic.trim(),
        moduleName: values.moduleName.trim(),
        relevanceOfTopic: values.relevance.trim(),
        briefOfContent: values.brief.trim(),
        mainContent: values.mainContent.trim(),
        link: values.link.trim() || null,
        placementOfModule: values.placement.trim(),
        attachment: null,
      }
      const created = await createContent(DIA_ENDPOINTS.ELEARNING, dto)
      if (values.attachment && created?.id) {
        try {
          const urls = await uploadContentAttachments(DIA_ENDPOINTS.ELEARNING, created.id, [values.attachment])
          if (urls[0]) {
            await updateContent(DIA_ENDPOINTS.ELEARNING, created.id, { ...dto, attachment: urls[0] })
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
      title="E-learning Module"
      subtitle="Draft a module — submits to SIDBI HO Checker for approval."
      methods={methods}
      onSubmit={submit}
      onReset={reset}
      submitting={submitting}
      toast={toast} onToastClose={() => setToast(null)}
    >
      <PmuSection first title="Module identity">
        <FieldRow>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <RhfTextField name="topic" fullWidth required label="Topic" rules={REQUIRED_TEXT} />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <RhfTextField name="moduleName" fullWidth required label="Module name" rules={REQUIRED_TEXT} />
          </FieldCell>
        </FieldRow>
      </PmuSection>

      <PmuSection title="Content">
        <FieldRow>
          <FieldCell>
            <RhfTextField
              name="relevance" fullWidth required multiline minRows={2}
              label="Relevance / rationale of the topic"
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

      <PmuSection title="Placement & assets">
        <FieldRow>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <RhfTextField
              name="link"
              fullWidth label="Link"
              placeholder="https://…"
              InputProps={LINK_ADORNMENT}
              rules={{
                validate: (v) => (!v || URL_RE.test(String(v).trim())) ? true : 'Enter a valid URL.',
              }}
            />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <RhfTextField
              name="placement"
              fullWidth required label="Placement of the module"
              placeholder="e.g. Course A, Chapter 3, Lesson 2"
              rules={REQUIRED_TEXT}
            />
          </FieldCell>
          <FieldCell>
            <RhfFileField
              name="attachment"
              label="Attachment"
              accept={ATTACHMENT_ACCEPT}
              helperText="PDF, Word, PPT, image or video. Optional."
            />
          </FieldCell>
        </FieldRow>
      </PmuSection>
    </PmuFormShell>
  )
}

const REQUIRED_TEXT = { validate: (v) => (String(v || '').trim() ? true : 'Required.') }
