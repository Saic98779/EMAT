import { useMemo, useState } from 'react'
import {
  PmuFormShell, PmuSection, FieldRow, FieldCell, todayIso,
  RhfTextField, SHRINK_LABEL, useForm, useWatch,
} from './_shared'
import { createContent, DIA_ENDPOINTS } from '../../apis/diaContent'

// DIA — Latest Developments
// GT_PMU raises; SIDBI HO Checker approves.
// Backed by react-hook-form — each field subscribes to its own path in
// the form store, so typing anywhere never re-renders the other fields.

const INITIAL = { topic: '', relevance: '', startDate: '', endDate: '' }

export default function DiaLatestDevelopments() {
  const methods = useForm({ mode: 'onSubmit', defaultValues: INITIAL })
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const startMin = useMemo(() => ({ min: todayIso() }), [])

  const submit = async (values) => {
    setSubmitting(true)
    try {
      await createContent(DIA_ENDPOINTS.LATEST_DEV, {
        topic: values.topic.trim(),
        relevanceOfTopic: values.relevance.trim(),
        startDate: values.startDate,
        endDate: values.endDate,
      })
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
      title="Latest Developments"
      subtitle="Add a Latest Developments entry — submits to SIDBI HO Checker for approval."
      methods={methods}
      onSubmit={submit}
      onReset={reset}
      submitting={submitting}
      toast={toast} onToastClose={() => setToast(null)}
    >
      <PmuSection first title="Entry details">
        <FieldRow>
          <FieldCell>
            <RhfTextField
              name="topic" fullWidth required label="Topic"
              rules={REQUIRED_TEXT}
            />
          </FieldCell>
          <FieldCell>
            <RhfTextField
              name="relevance" fullWidth required multiline minRows={2}
              label="Relevance of the topic"
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
    </PmuFormShell>
  )
}

const REQUIRED_TEXT = {
  validate: (v) => (String(v || '').trim() ? true : 'Required.'),
}
const REQUIRED_DATE = { required: 'Required.' }

// End date has a min = startDate; watching just the one field keeps this
// leaf isolated so unrelated keystrokes don't re-render it.
function EndDateField() {
  const startDate = useWatch({ name: 'startDate' })
  const inputProps = useMemo(
    () => ({ min: startDate || todayIso() }),
    [startDate],
  )
  return (
    <RhfTextField
      name="endDate" fullWidth type="date" required label="End date"
      InputLabelProps={SHRINK_LABEL}
      inputProps={inputProps}
      rules={{
        required: 'Required.',
        validate: (v, all) => {
          if (v && all.startDate && v < all.startDate) return 'End date must be on or after the start date.'
          return true
        },
      }}
    />
  )
}
