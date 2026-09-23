import { useEffect, useMemo, useState } from 'react'
import {
  PmuFormShell, PmuSection, FieldRow, FieldCell, todayIso,
  RhfTextField, SHRINK_LABEL, useForm, useWatch,
} from './_shared'
import { createContent, updateContent, DIA_ENDPOINTS } from '../../apis/diaContent'

// DIA — Latest Developments
// GT_PMU raises; SIDBI HO Checker approves.
// Backed by react-hook-form — each field subscribes to its own path in
// the form store, so typing anywhere never re-renders the other fields.

const INITIAL = { topic: '', relevance: '', startDate: '', endDate: '' }

function recordToDefaults(record) {
  if (!record) return INITIAL
  return {
    topic: record.topic || '',
    relevance: record.relevanceOfTopic || '',
    startDate: (record.startDate || '').slice(0, 10),
    endDate: (record.endDate || '').slice(0, 10),
  }
}

export default function DiaLatestDevelopments({ editId = null, initialRecord = null } = {}) {
  const isEdit = !!editId
  const defaults = useMemo(() => recordToDefaults(initialRecord), [initialRecord])
  const methods = useForm({ mode: 'onSubmit', defaultValues: defaults })
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const startMin = useMemo(() => ({ min: isEdit ? undefined : todayIso() }), [isEdit])

  useEffect(() => {
    if (initialRecord) methods.reset(recordToDefaults(initialRecord))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRecord])

  const submit = async (values) => {
    setSubmitting(true)
    try {
      const dto = {
        topic: values.topic.trim(),
        relevanceOfTopic: values.relevance.trim(),
        startDate: values.startDate,
        endDate: values.endDate,
      }
      if (isEdit) await updateContent(DIA_ENDPOINTS.LATEST_DEV, editId, dto)
      else await createContent(DIA_ENDPOINTS.LATEST_DEV, dto)
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
      title={isEdit ? 'Resubmit Latest Developments' : 'Latest Developments'}
      subtitle={isEdit
        ? 'Address the checker\'s remarks and resubmit for re-review.'
        : 'Add a Latest Developments entry — submits to SIDBI HO Checker for approval.'}
      methods={methods}
      onSubmit={submit}
      onReset={reset}
      submitting={submitting}
      submitLabel={isEdit ? 'Resubmit for Approval' : 'Submit for Approval'}
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
