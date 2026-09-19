import { useDeferredValue, useMemo, useState } from 'react'
import {
  FormControlLabel, Radio, RadioGroup, Typography,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import {
  PmuFormShell, PmuSection, FieldRow, FieldCell, todayIso,
  FormTextField, SHRINK_LABEL, useFieldHandlers,
} from './_shared'
import { createContent, DIA_ENDPOINTS } from '../../apis/diaContent'

// DIA — Discussion Forum
// GT_PMU raises; SIDBI HO Checker approves.

const VISIBILITY_OPTIONS = [
  { value: 'global', label: 'Global — open to everyone' },
  { value: 'members', label: 'Only Members' },
]

const REQUIRED_TEXT = ['topic', 'theme', 'relevance']

const INITIAL = {
  topic: '', theme: '',
  relevance: '',
  startDate: '', endDate: '',
  visibility: 'global',
}

export default function DiaDiscussionForum() {
  const theme = useTheme()
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
      await createContent(DIA_ENDPOINTS.FORUM, {
        topic: values.topic.trim(),
        theme: values.theme.trim(),
        relevanceOfTopic: values.relevance.trim(),
        startDate: values.startDate,
        endDate: values.endDate,
        globalOrOnlyMembers: values.visibility === 'members' ? 'MEMBERS' : 'GLOBAL',
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
      title="Discussion Forum"
      subtitle="Open a forum thread — submits to SIDBI HO Checker for approval."
      approvalNote="Once submitted, this thread goes to the SIDBI HO Checker for approval. It becomes visible to participants only after approval."
      onSubmit={submit} onReset={reset}
      submitting={submitting}
      toast={toast} onToastClose={() => setToast(null)}
    >
      <PmuSection first title="Thread details">
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
              fullWidth required label="Theme"
              value={values.theme} onChange={set('theme')} onBlur={blur('theme')}
              error={!!errFor('theme')} helperText={errFor('theme')}
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
        </FieldRow>
      </PmuSection>

      <PmuSection title="Schedule & visibility">
        <FieldRow>
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
          <FieldCell>
            <Typography
              sx={{
                fontSize: 12.5, fontWeight: 500,
                color: theme.palette.text.secondary, mb: '6px',
              }}
            >
              Visibility
            </Typography>
            <RadioGroup row value={values.visibility} onChange={set('visibility')}>
              {VISIBILITY_OPTIONS.map((o) => (
                <FormControlLabel
                  key={o.value} value={o.value}
                  control={<Radio />}
                  label={o.label}
                  sx={{ mr: 4 }}
                />
              ))}
            </RadioGroup>
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
