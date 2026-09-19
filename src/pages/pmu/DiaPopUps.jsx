import { useDeferredValue, useMemo, useState } from 'react'
import {
  PmuFormShell, PmuSection, FieldRow, FieldCell, FileDropField, todayIso,
  FormTextField, SHRINK_LABEL, useFieldHandlers,
} from './_shared'
import {
  createContent, updateContent, uploadContentAttachments, DIA_ENDPOINTS,
} from '../../apis/diaContent'

// DIA — Pop-Ups
// GT_PMU raises; SIDBI HO Checker approves.

const ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp'
const REQUIRED_TEXT = ['topic', 'relevance']

const INITIAL = { topic: '', relevance: '', startDate: '', endDate: '' }

export default function DiaPopUps() {
  const [values, setValues] = useState(INITIAL)
  const [attachments, setAttachments] = useState([])
  const [touched, setTouched] = useState({})
  const [showAllErrors, setShowAllErrors] = useState(false)
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const { set, blur } = useFieldHandlers(setValues, setTouched)
  // Defer validation so keystrokes stay snappy — see 3C form for rationale.
  const deferredValues = useDeferredValue(values)
  const errors = useMemo(() => validate(deferredValues), [deferredValues])
  const errFor = (name) => (showAllErrors || touched[name]) ? errors[name] : ''

  const startMin = useMemo(() => ({ min: todayIso() }), [])
  const endMin = useMemo(() => ({ min: values.startDate || todayIso() }), [values.startDate])

  const reset = () => {
    setValues(INITIAL); setAttachments([]); setTouched({}); setShowAllErrors(false)
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
        relevanceOfPopUp: values.relevance.trim(),
        startDate: values.startDate,
        endDate: values.endDate,
        attachments: null,
      }
      const created = await createContent(DIA_ENDPOINTS.POPUPS, dto)
      if (attachments.length && created?.id) {
        try {
          const urls = await uploadContentAttachments(DIA_ENDPOINTS.POPUPS, created.id, attachments)
          if (urls.length) {
            // Backend types `attachments` as `String` (not List) as of
            // 2026-09-19; send the first URL. Files beyond the first are
            // still uploaded via the file API and retrievable by scope.
            // Switch to `urls` once Sameer changes the column to List.
            await updateContent(DIA_ENDPOINTS.POPUPS, created.id, { ...dto, attachments: urls[0] })
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
      title="Pop-Ups"
      subtitle="Schedule a pop-up — submits to SIDBI HO Checker for approval."
      approvalNote="Once submitted, this pop-up goes to the SIDBI HO Checker for approval. It becomes live only after approval and stays visible for the duration you set."
      onSubmit={submit} onReset={reset}
      submitting={submitting}
      toast={toast} onToastClose={() => setToast(null)}
    >
      <PmuSection first title="Pop-up details">
        <FieldRow>
          <FieldCell>
            <FormTextField
              fullWidth required label="Topic"
              value={values.topic} onChange={set('topic')} onBlur={blur('topic')}
              error={!!errFor('topic')} helperText={errFor('topic')}
            />
          </FieldCell>
          <FieldCell>
            <FormTextField
              fullWidth required multiline minRows={2}
              label="Relevance of the pop-up"
              value={values.relevance} onChange={set('relevance')} onBlur={blur('relevance')}
              error={!!errFor('relevance')} helperText={errFor('relevance')}
            />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <FormTextField
              fullWidth type="date" required label="Start date"
              InputLabelProps={SHRINK_LABEL}
              inputProps={startMin}
              value={values.startDate} onChange={set('startDate')} onBlur={blur('startDate')}
              error={!!errFor('startDate')} helperText={errFor('startDate')}
            />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <FormTextField
              fullWidth type="date" required label="End date"
              InputLabelProps={SHRINK_LABEL}
              inputProps={endMin}
              value={values.endDate} onChange={set('endDate')} onBlur={blur('endDate')}
              error={!!errFor('endDate')} helperText={errFor('endDate')}
            />
          </FieldCell>
        </FieldRow>
      </PmuSection>

      <PmuSection title="Attachments">
        <FileDropField
          label="Files"
          accept={ATTACHMENT_ACCEPT}
          helperText="PDF, Word, PPT or image. Optional. You can add multiple."
          multiple
          files={attachments}
          onChange={setAttachments}
        />
      </PmuSection>
    </PmuFormShell>
  )
}

function validate(v) {
  const errs = {}
  for (const k of REQUIRED_TEXT) if (!String(v[k] || '').trim()) errs[k] = 'Required.'
  if (!v.startDate) errs.startDate = 'Required.'
  if (!v.endDate) errs.endDate = 'Required.'
  if (v.startDate && v.endDate && v.endDate < v.startDate) errs.endDate = 'End date must be on or after the start date.'
  return errs
}
