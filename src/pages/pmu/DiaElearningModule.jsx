import { useEffect, useMemo, useState } from 'react'
import { InputAdornment } from '@mui/material'
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined'
import {
  PmuFormShell, PmuSection, FieldRow, FieldCell, URL_RE,
  RhfTextField, RhfFileField, useForm,
  CHAR_LIMITS, requiredText, optionalText, capChars,
} from './_shared'
import {
  createContent, updateContent, resubmitContent, uploadContentAttachments, DIA_ENDPOINTS,
} from '../../apis/diaContent'

// DIA — E-learning Module
// GT_PMU raises; SIDBI HO Maker approves first, then HO Checker signs off.

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

function recordToDefaults(record) {
  if (!record) return INITIAL
  return {
    topic: record.topic || '',
    moduleName: record.moduleName || '',
    relevance: record.relevanceOfTopic || '',
    brief: record.briefOfContent || '',
    mainContent: record.mainContent || '',
    link: record.link || '',
    placement: record.placementOfModule || '',
    attachment: null,
  }
}

export default function DiaElearningModule({ editId = null, initialRecord = null, onResubmitDone } = {}) {
  const isEdit = !!editId
  const existingAttachment = initialRecord?.attachment || null
  const defaults = useMemo(() => recordToDefaults(initialRecord), [initialRecord])
  const methods = useForm({ mode: 'onSubmit', defaultValues: defaults })
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (initialRecord) methods.reset(recordToDefaults(initialRecord))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRecord])

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
        attachment: isEdit ? existingAttachment : null,
      }
      const savedId = isEdit
        ? (await resubmitContent(DIA_ENDPOINTS.ELEARNING, editId, dto))?.id ?? editId
        : (await createContent(DIA_ENDPOINTS.ELEARNING, dto))?.id
      if (values.attachment && savedId) {
        try {
          const urls = await uploadContentAttachments(DIA_ENDPOINTS.ELEARNING, savedId, [values.attachment])
          if (urls[0]) {
            await updateContent(DIA_ENDPOINTS.ELEARNING, savedId, { ...dto, attachment: urls[0] })
          }
        } catch (uploadErr) {
          setToast({ severity: 'warning', msg: `Saved, but attachment upload failed: ${uploadErr.message || 'unknown error'}.` })
          if (!isEdit) methods.reset(INITIAL)
          return
        }
      }
      setToast({
        severity: 'success',
        msg: isEdit ? 'Resubmitted. The maker will re-review.' : 'Submitted. Sent to SIDBI HO Maker for approval.',
      })
      if (!isEdit) methods.reset(INITIAL)
      else onResubmitDone?.()
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Submit failed.' })
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => methods.reset(isEdit ? defaults : INITIAL)

  return (
    <PmuFormShell
      title={isEdit ? 'Resubmit E-learning Module' : 'E-learning Module'}
      subtitle={isEdit
        ? 'Address the reviewer\'s remarks and resubmit for re-review.'
        : 'Draft a module — submits to SIDBI HO Maker for approval.'}
      methods={methods}
      onSubmit={submit}
      onReset={reset}
      submitting={submitting}
      submitLabel={isEdit ? 'Resubmit for Approval' : 'Submit for Approval'}
      toast={toast} onToastClose={() => setToast(null)}
    >
      <PmuSection first title="Module identity">
        <FieldRow>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <RhfTextField name="topic" fullWidth required label="Topic" rules={requiredText(CHAR_LIMITS.SHORT)} inputProps={capChars(CHAR_LIMITS.SHORT)} />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <RhfTextField name="moduleName" fullWidth required label="Module name" rules={requiredText(CHAR_LIMITS.SHORT)} inputProps={capChars(CHAR_LIMITS.SHORT)} />
          </FieldCell>
        </FieldRow>
      </PmuSection>

      <PmuSection title="Content">
        <FieldRow>
          <FieldCell>
            <RhfTextField
              name="relevance" fullWidth required multiline minRows={2}
              label="Relevance / rationale of the topic"
              rules={requiredText(CHAR_LIMITS.MEDIUM)}
              inputProps={capChars(CHAR_LIMITS.MEDIUM)}
            />
          </FieldCell>
          <FieldCell>
            <RhfTextField
              name="brief" fullWidth required multiline minRows={3}
              label="Brief of the content"
              rules={requiredText(CHAR_LIMITS.MEDIUM)}
              inputProps={capChars(CHAR_LIMITS.MEDIUM)}
            />
          </FieldCell>
          <FieldCell>
            <RhfTextField
              name="mainContent" fullWidth required multiline minRows={6}
              label="Main content"
              rules={requiredText(CHAR_LIMITS.MEDIUM)}
              inputProps={capChars(CHAR_LIMITS.MEDIUM)}
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
              inputProps={capChars(CHAR_LIMITS.MEDIUM)}
              rules={{
                validate: (v) => {
                  const s = String(v || '').trim()
                  if (!s) return true
                  if (!URL_RE.test(s)) return 'Enter a valid URL.'
                  if (s.length > CHAR_LIMITS.MEDIUM) return `Max ${CHAR_LIMITS.MEDIUM} characters.`
                  return true
                },
              }}
            />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <RhfTextField
              name="placement"
              fullWidth required label="Placement of the module"
              placeholder="e.g. Course A, Chapter 3, Lesson 2"
              rules={requiredText(CHAR_LIMITS.SHORT)}
              inputProps={capChars(CHAR_LIMITS.SHORT)}
            />
          </FieldCell>
          <FieldCell>
            <RhfFileField
              name="attachment"
              label="Attachment"
              accept={ATTACHMENT_ACCEPT}
              existing={isEdit ? existingAttachment : null}
              helperText={isEdit
                ? (existingAttachment
                    ? 'Pick a file to replace it.'
                    : 'No file was previously attached. You can upload one now if needed.')
                : 'PDF, Word, PPT, image or video. Optional.'}
            />
          </FieldCell>
        </FieldRow>
      </PmuSection>
    </PmuFormShell>
  )
}
