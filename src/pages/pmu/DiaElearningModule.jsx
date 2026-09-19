import { useDeferredValue, useMemo, useState } from 'react'
import { InputAdornment } from '@mui/material'
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined'
import {
  PmuFormShell, PmuSection, FieldRow, FieldCell, FileDropField, URL_RE,
  FormTextField, useFieldHandlers,
} from './_shared'
import {
  createContent, updateContent, uploadContentAttachments, DIA_ENDPOINTS,
} from '../../apis/diaContent'

// Stable adornment object — kept at module scope so
// `InputProps={LINK_ADORNMENT}` keeps the same reference across renders
// and doesn't defeat FormTextField's memoization.
const LINK_ADORNMENT = {
  startAdornment: (
    <InputAdornment position="start">
      <LinkOutlinedIcon fontSize="small" />
    </InputAdornment>
  ),
}

// DIA — E-learning Module
// GT_PMU raises; SIDBI HO Checker approves.

const ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.webm,.mkv'
const REQUIRED = ['topic', 'moduleName', 'relevance', 'brief', 'mainContent', 'placement']

const INITIAL = {
  topic: '', moduleName: '',
  relevance: '', brief: '', mainContent: '',
  link: '', placement: '',
}

export default function DiaElearningModule() {
  const [values, setValues] = useState(INITIAL)
  const [attachment, setAttachment] = useState(null)
  const [touched, setTouched] = useState({})
  const [showAllErrors, setShowAllErrors] = useState(false)
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const { set, blur } = useFieldHandlers(setValues, setTouched)
  // Defer validation so keystrokes stay snappy — see 3C form for rationale.
  const deferredValues = useDeferredValue(values)
  const errors = useMemo(() => validate(deferredValues), [deferredValues])
  const errFor = (name) => (showAllErrors || touched[name]) ? errors[name] : ''

  const reset = () => {
    setValues(INITIAL); setAttachment(null); setTouched({}); setShowAllErrors(false)
  }

  const submit = async (e) => {
    e.preventDefault()
    setShowAllErrors(true)
    if (Object.keys(errors).length > 0) {
      setToast({ severity: 'warning', msg: 'Please fix the highlighted fields.' })
      return
    }
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
      if (attachment && created?.id) {
        try {
          const urls = await uploadContentAttachments(DIA_ENDPOINTS.ELEARNING, created.id, [attachment])
          if (urls[0]) {
            await updateContent(DIA_ENDPOINTS.ELEARNING, created.id, { ...dto, attachment: urls[0] })
          }
        } catch (uploadErr) {
          setToast({ severity: 'warning', msg: `Saved, but attachment upload failed: ${uploadErr.message || 'unknown error'}.` })
          reset()
          return
        }
      }
      setToast({ severity: 'success', msg: 'Submitted. Sent to SIDBI HO Checker for approval.' })
      reset()
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Submit failed.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PmuFormShell
      title="E-learning Module"
      subtitle="Draft a module — submits to SIDBI HO Checker for approval."
      onSubmit={submit} onReset={reset}
      submitting={submitting}
      toast={toast} onToastClose={() => setToast(null)}
    >
      <PmuSection first title="Module identity">
        <FieldRow>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <FormTextField
              fullWidth required label="Topic"
              value={values.topic} onChange={set('topic')} onBlur={blur('topic')}
              error={!!errFor('topic')} helperText={errFor('topic')}
            />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <FormTextField
              fullWidth required label="Module name"
              value={values.moduleName} onChange={set('moduleName')} onBlur={blur('moduleName')}
              error={!!errFor('moduleName')} helperText={errFor('moduleName')}
            />
          </FieldCell>
        </FieldRow>
      </PmuSection>

      <PmuSection title="Content">
        <FieldRow>
          <FieldCell>
            <FormTextField
              fullWidth required multiline minRows={2}
              label="Relevance / rationale of the topic"
              value={values.relevance} onChange={set('relevance')} onBlur={blur('relevance')}
              error={!!errFor('relevance')} helperText={errFor('relevance')}
            />
          </FieldCell>
          <FieldCell>
            <FormTextField
              fullWidth required multiline minRows={3}
              label="Brief of the content"
              value={values.brief} onChange={set('brief')} onBlur={blur('brief')}
              error={!!errFor('brief')} helperText={errFor('brief')}
            />
          </FieldCell>
          <FieldCell>
            <FormTextField
              fullWidth required multiline minRows={6}
              label="Main content"
              value={values.mainContent} onChange={set('mainContent')} onBlur={blur('mainContent')}
              error={!!errFor('mainContent')} helperText={errFor('mainContent')}
            />
          </FieldCell>
        </FieldRow>
      </PmuSection>

      <PmuSection title="Placement & assets">
        <FieldRow>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <FormTextField
              fullWidth label="Link"
              placeholder="https://…"
              value={values.link} onChange={set('link')} onBlur={blur('link')}
              error={!!errFor('link')} helperText={errFor('link')}
              InputProps={LINK_ADORNMENT}
            />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <FormTextField
              fullWidth required label="Placement of the module"
              placeholder="e.g. Course A, Chapter 3, Lesson 2"
              value={values.placement} onChange={set('placement')} onBlur={blur('placement')}
              error={!!errFor('placement')} helperText={errFor('placement')}
            />
          </FieldCell>
          <FieldCell>
            <FileDropField
              label="Attachment"
              accept={ATTACHMENT_ACCEPT}
              helperText="PDF, Word, PPT, image or video. Optional."
              files={attachment}
              onChange={setAttachment}
            />
          </FieldCell>
        </FieldRow>
      </PmuSection>
    </PmuFormShell>
  )
}

function validate(v) {
  const errs = {}
  for (const k of REQUIRED) if (!String(v[k] || '').trim()) errs[k] = 'Required.'
  if (v.link && !URL_RE.test(v.link.trim())) errs.link = 'Enter a valid URL.'
  return errs
}
