import { useDeferredValue, useMemo, useState } from 'react'
import {
  PmuFormShell, PmuSection, FieldRow, FieldCell, todayIso,
  FormTextField, SHRINK_LABEL, useFieldHandlers,
} from './_shared'
import { createContent, DIA_ENDPOINTS } from '../../apis/diaContent'

// DIA — Latest Developments
// GT_PMU raises; SIDBI HO Checker approves.

const REQUIRED_TEXT = ['topic', 'relevance']

const INITIAL = { topic: '', relevance: '', startDate: '', endDate: '' }

export default function DiaLatestDevelopments() {
  const [values, setValues] = useState(INITIAL)
  const [touched, setTouched] = useState({})
  const [showAllErrors, setShowAllErrors] = useState(false)
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const { set, blur } = useFieldHandlers(setValues, setTouched)
  // Defer validation so keystrokes stay snappy — see 3C form for rationale.
  const deferredValues = useDeferredValue(values)
  const errors = useMemo(() => validate(deferredValues), [deferredValues])
  const errFor = (name) => (showAllErrors || touched[name]) ? errors[name] : ''

  // Stable inputProps for date-min so FormTextField memo isn't busted
  // by a fresh `{ min: todayIso() }` object every render.
  const startMin = useMemo(() => ({ min: todayIso() }), [])
  const endMin = useMemo(() => ({ min: values.startDate || todayIso() }), [values.startDate])

  const reset = () => { setValues(INITIAL); setTouched({}); setShowAllErrors(false) }

  const submit = async (e) => {
    e.preventDefault()
    setShowAllErrors(true)
    if (Object.keys(errors).length > 0) {
      setToast({ severity: 'warning', msg: 'Please fix the highlighted fields.' })
      return
    }
    setSubmitting(true)
    try {
      await createContent(DIA_ENDPOINTS.LATEST_DEV, {
        topic: values.topic.trim(),
        relevanceOfTopic: values.relevance.trim(),
        startDate: values.startDate,
        endDate: values.endDate,
      })
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
      title="Latest Developments"
      subtitle="Add a Latest Developments entry — submits to SIDBI HO Checker for approval."
      onSubmit={submit} onReset={reset}
      submitting={submitting}
      toast={toast} onToastClose={() => setToast(null)}
    >
      <PmuSection first title="Entry details">
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
              label="Relevance of the topic"
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
