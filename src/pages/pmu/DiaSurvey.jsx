import { useMemo, useState } from 'react'
import {
  Box, Button, IconButton, MenuItem, Stack, Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import {
  PmuFormShell, PmuSection, FieldRow, FieldCell, FileDropField, todayIso,
  RhfTextField, RhfSelectField, RhfFileField, SHRINK_LABEL, CHIP_RENDER_VALUE,
  useForm, useFieldArray, useWatch,
} from './_shared'
import {
  createContent, updateContent, uploadContentAttachments,
  toBackendChannels, DIA_ENDPOINTS,
} from '../../apis/diaContent'

// DIA — Survey
// GT_PMU raises; SIDBI HO Checker approves.

const CHANNELS = [
  { value: 'Email', label: 'Email' },
  { value: 'SMS', label: 'SMS' },
  { value: 'WhatsApp', label: 'WhatsApp' },
]
const ATTACHMENT_ACCEPT = '.pdf,.doc,.docx'

const RESPONSE_TYPES = [
  { value: 'SINGLE_CHOICE',   label: 'Single choice' },
  { value: 'MULTIPLE_CHOICE', label: 'Multiple choice' },
  { value: 'TEXT',            label: 'Text' },
]

function makeQuestion() {
  return { text: '', type: 'SINGLE_CHOICE', options: ['', ''] }
}

const INITIAL = {
  topic: '', relevance: '', sample: '',
  startDate: '', endDate: '', channels: [],
  attachment: null,
  questions: [makeQuestion()],
}

const SAMPLE_INPUT_PROPS = { min: 1 }

export default function DiaSurvey() {
  const methods = useForm({ mode: 'onSubmit', defaultValues: INITIAL })
  const { control } = methods
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const { fields, append, remove } = useFieldArray({ control, name: 'questions' })
  const startMin = useMemo(() => ({ min: todayIso() }), [])

  const submit = async (values) => {
    setSubmitting(true)
    try {
      const dto = {
        topic: values.topic.trim(),
        relevanceOfTopic: values.relevance.trim(),
        startDate: values.startDate,
        endDate: values.endDate,
        sample: Number(values.sample),
        bulkMessaging: toBackendChannels(values.channels),
        attachment: null,
        surveyQuestionnaires: values.questions.map((q) => ({
          question: (q.text || '').trim(),
          questionType: q.type,
          options: q.type === 'TEXT' ? [] : (q.options || []).map((o) => (o || '').trim()).filter(Boolean),
        })),
      }
      const created = await createContent(DIA_ENDPOINTS.SURVEY, dto)
      if (values.attachment && created?.id) {
        try {
          const urls = await uploadContentAttachments(DIA_ENDPOINTS.SURVEY, created.id, [values.attachment])
          if (urls[0]) {
            await updateContent(DIA_ENDPOINTS.SURVEY, created.id, { ...dto, attachment: urls[0] })
          }
        } catch (uploadErr) {
          setToast({ severity: 'warning', msg: `Saved, but attachment upload failed: ${uploadErr.message || 'unknown error'}.` })
          methods.reset(INITIAL)
          return
        }
      }
      setToast({ severity: 'success', msg: 'Submitted. Sent to SIDBI HO Checker for approval.' })
      methods.reset({ ...INITIAL, questions: [makeQuestion()] })
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Submit failed.' })
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => methods.reset({ ...INITIAL, questions: [makeQuestion()] })

  return (
    <PmuFormShell
      title="Survey"
      subtitle="Draft a survey — submits to SIDBI HO Checker for approval."
      methods={methods}
      onSubmit={submit}
      onReset={reset}
      submitting={submitting}
      toast={toast} onToastClose={() => setToast(null)}
    >
      <PmuSection first title="Survey details">
        <FieldRow>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <RhfTextField name="topic" fullWidth required label="Topic" rules={REQUIRED_TEXT} />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <RhfSelectField
              name="channels" label="Bulk messaging"
              multiple options={CHANNELS} renderValue={CHIP_RENDER_VALUE}
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
              name="startDate" fullWidth type="date" required label="Survey start date"
              InputLabelProps={SHRINK_LABEL}
              inputProps={startMin}
              rules={REQUIRED_DATE}
            />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <EndDateField />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <RhfTextField
              name="sample" fullWidth required type="number"
              label="Sample size" placeholder="Number of respondents"
              inputProps={SAMPLE_INPUT_PROPS}
              rules={{
                validate: (v) => {
                  if (v === '' || v == null) return 'Required.'
                  const n = Number(v)
                  if (!Number.isFinite(n) || n < 1) return 'Enter a positive number.'
                  return true
                },
              }}
            />
          </FieldCell>
        </FieldRow>
      </PmuSection>

      <PmuSection
        title="Questionnaire"
        description="Add the questions respondents will see. Each can be single-choice, multi-choice, or free text."
      >
        <Stack spacing={2.5}>
          {fields.map((f, i) => (
            <QuestionCard
              key={f.id}
              index={i}
              onRemove={() => fields.length > 1 && remove(i)}
              removable={fields.length > 1}
            />
          ))}
          <Button
            size="small" variant="outlined" startIcon={<AddRoundedIcon />}
            onClick={() => append(makeQuestion())}
            sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
          >
            Add question
          </Button>
        </Stack>
      </PmuSection>

      <PmuSection title="Attachment">
        <RhfFileField
          name="attachment"
          label="Reference document"
          accept={ATTACHMENT_ACCEPT}
          helperText="Word or PDF. Optional."
        />
      </PmuSection>
    </PmuFormShell>
  )
}

// ─── Per-question card ────────────────────────────────────────────────────
function QuestionCard({ index, onRemove, removable }) {
  const theme = useTheme()
  const base = `questions.${index}`
  const type = useWatch({ name: `${base}.type` })
  const needsOptions = type !== 'TEXT'

  return (
    <Box
      sx={{
        border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.1),
        borderRadius: 1.5,
        p: 2.5,
        bgcolor: alpha(theme.palette.text.primary, 0.015),
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 2 }}>
        <Box
          sx={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            color: theme.palette.text.disabled,
            border: 1, borderColor: alpha(theme.palette.text.primary, 0.18),
            borderRadius: 999, px: 1, py: 0.25,
          }}
        >
          Q{index + 1}
        </Box>
        <Box sx={{ flex: 1 }} />
        {removable && (
          <IconButton size="small" onClick={onRemove} aria-label="Remove question">
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>

      <FieldRow>
        <FieldCell span={{ xs: 12, md: 8 }}>
          <RhfTextField
            name={`${base}.text`} fullWidth required label="Question"
            rules={{ validate: (v) => (String(v || '').trim() ? true : 'Enter the question.') }}
          />
        </FieldCell>
        <FieldCell span={{ xs: 12, md: 4 }}>
          <RhfTextField name={`${base}.type`} select fullWidth label="Response type">
            {RESPONSE_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
          </RhfTextField>
        </FieldCell>
        {needsOptions && (
          <FieldCell>
            <OptionsList base={base} />
          </FieldCell>
        )}
      </FieldRow>
    </Box>
  )
}

// Dynamic option list for a single question. useFieldArray reads control
// from the enclosing FormProvider (installed by PmuFormShell), so a scoped
// name gives us a proper add/remove without re-rendering siblings.
function OptionsList({ base }) {
  const theme = useTheme()
  const { fields, append, remove } = useFieldArray({ name: `${base}.options` })

  return (
    <>
      <Typography sx={{ fontSize: 12.5, fontWeight: 500, color: theme.palette.text.secondary, mb: 1 }}>
        Options
      </Typography>
      <Stack spacing={1}>
        {fields.map((f, i) => (
          <Stack key={f.id} direction="row" spacing={1} alignItems="center">
            <RhfTextField
              name={`${base}.options.${i}`}
              fullWidth size="small"
              label={`Option ${String.fromCharCode(65 + i)}`}
              rules={{ validate: (v) => (String(v || '').trim() ? true : 'Required.') }}
            />
            <IconButton
              size="small"
              onClick={() => fields.length > 2 && remove(i)}
              disabled={fields.length <= 2}
              aria-label="Remove option"
            >
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
        <Button
          size="small" variant="text" startIcon={<AddRoundedIcon />}
          onClick={() => append('')}
          sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
        >
          Add option
        </Button>
      </Stack>
    </>
  )
}

function EndDateField() {
  const startDate = useWatch({ name: 'startDate' })
  const inputProps = useMemo(() => ({ min: startDate || todayIso() }), [startDate])
  return (
    <RhfTextField
      name="endDate" fullWidth type="date" required label="Survey end date"
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

const REQUIRED_TEXT = { validate: (v) => (String(v || '').trim() ? true : 'Required.') }
const REQUIRED_DATE = { required: 'Required.' }
