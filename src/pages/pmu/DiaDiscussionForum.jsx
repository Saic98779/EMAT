import { useMemo, useState } from 'react'
import {
  FormControlLabel, Radio, RadioGroup, Typography,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import {
  PmuFormShell, PmuSection, FieldRow, FieldCell, todayIso,
  RhfTextField, SHRINK_LABEL, useForm, useWatch, Controller,
} from './_shared'
import { createContent, updateContent, DIA_ENDPOINTS } from '../../apis/diaContent'

// DIA — Discussion Forum
// GT_PMU raises; SIDBI HO Checker approves.

const VISIBILITY_OPTIONS = [
  { value: 'global', label: 'Global — open to everyone' },
  { value: 'members', label: 'Only Members' },
]

const INITIAL = {
  topic: '', theme: '',
  relevance: '',
  startDate: '', endDate: '',
  visibility: 'global',
}

function recordToDefaults(record) {
  if (!record) return INITIAL
  return {
    topic: record.topic || '',
    theme: record.theme || '',
    relevance: record.relevanceOfTopic || '',
    startDate: (record.startDate || '').slice(0, 10),
    endDate: (record.endDate || '').slice(0, 10),
    visibility: record.globalOrOnlyMembers === 'MEMBERS' ? 'members' : 'global',
  }
}

export default function DiaDiscussionForum({ editId = null, initialRecord = null } = {}) {
  const isEdit = !!editId
  const defaults = useMemo(() => recordToDefaults(initialRecord), [initialRecord])
  const methods = useForm({ mode: 'onSubmit', defaultValues: defaults })
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const startMin = useMemo(() => ({ min: isEdit ? undefined : todayIso() }), [isEdit])

  const submit = async (values) => {
    setSubmitting(true)
    try {
      const dto = {
        topic: values.topic.trim(),
        theme: values.theme.trim(),
        relevanceOfTopic: values.relevance.trim(),
        startDate: values.startDate,
        endDate: values.endDate,
        globalOrOnlyMembers: values.visibility === 'members' ? 'MEMBERS' : 'GLOBAL',
      }
      if (isEdit) await updateContent(DIA_ENDPOINTS.FORUM, editId, dto)
      else await createContent(DIA_ENDPOINTS.FORUM, dto)
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
      title={isEdit ? 'Resubmit Discussion Forum' : 'Discussion Forum'}
      subtitle={isEdit
        ? 'Address the checker\'s remarks and resubmit for re-review.'
        : 'Open a forum thread — submits to SIDBI HO Checker for approval.'}
      approvalNote="Once submitted, this thread goes to the SIDBI HO Checker for approval. It becomes visible to participants only after approval."
      methods={methods}
      onSubmit={submit}
      onReset={reset}
      submitting={submitting}
      submitLabel={isEdit ? 'Resubmit for Approval' : 'Submit for Approval'}
      toast={toast} onToastClose={() => setToast(null)}
    >
      <PmuSection first title="Thread details">
        <FieldRow>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <RhfTextField name="topic" fullWidth required label="Topic" rules={REQUIRED_TEXT} />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <RhfTextField name="theme" fullWidth required label="Theme" rules={REQUIRED_TEXT} />
          </FieldCell>
          <FieldCell>
            <RhfTextField
              name="relevance"
              fullWidth required multiline minRows={2}
              label="Relevance of the topic"
              rules={REQUIRED_TEXT}
            />
          </FieldCell>
        </FieldRow>
      </PmuSection>

      <PmuSection title="Schedule & visibility">
        <FieldRow>
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
          <FieldCell>
            <VisibilityRadio />
          </FieldCell>
        </FieldRow>
      </PmuSection>
    </PmuFormShell>
  )
}

const REQUIRED_TEXT = { validate: (v) => (String(v || '').trim() ? true : 'Required.') }
const REQUIRED_DATE = { required: 'Required.' }

function EndDateField() {
  const startDate = useWatch({ name: 'startDate' })
  const inputProps = useMemo(() => ({ min: startDate || todayIso() }), [startDate])
  return (
    <RhfTextField
      name="endDate" fullWidth type="date" required label="End date"
      InputLabelProps={SHRINK_LABEL}
      inputProps={inputProps}
      rules={{
        required: 'Required.',
        validate: (v, all) => (v && all.startDate && v < all.startDate)
          ? 'End date must be on or after the start date.'
          : true,
      }}
    />
  )
}

function VisibilityRadio() {
  const theme = useTheme()
  return (
    <>
      <Typography
        sx={{
          fontSize: 12.5, fontWeight: 500,
          color: theme.palette.text.secondary, mb: '6px',
        }}
      >
        Visibility
      </Typography>
      <Controller
        name="visibility"
        render={({ field }) => (
          <RadioGroup row {...field}>
            {VISIBILITY_OPTIONS.map((o) => (
              <FormControlLabel
                key={o.value} value={o.value}
                control={<Radio />}
                label={o.label}
                sx={{ mr: 4 }}
              />
            ))}
          </RadioGroup>
        )}
      />
    </>
  )
}
