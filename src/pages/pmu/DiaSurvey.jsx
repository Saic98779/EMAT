import { memo, useCallback, useDeferredValue, useMemo, useState } from 'react'
import {
  Box, Button, Chip, FormControl, IconButton, InputLabel, MenuItem, OutlinedInput,
  Select, Stack, Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import {
  PmuFormShell, PmuSection, FieldRow, FieldCell, FileDropField, todayIso,
  FormTextField, SHRINK_LABEL, useFieldHandlers, CHIP_RENDER_VALUE,
} from './_shared'
import {
  createContent, updateContent, uploadContentAttachments,
  toBackendChannels, DIA_ENDPOINTS,
} from '../../apis/diaContent'

// DIA — Survey
// GT_PMU raises; SIDBI HO Checker approves.

const CHANNELS = ['Email', 'SMS', 'WhatsApp']
const ATTACHMENT_ACCEPT = '.pdf,.doc,.docx'
// UI value → backend enum for the surveyQuestionnaire.questionType.
const RESPONSE_TYPES = [
  { value: 'SINGLE_CHOICE',   label: 'Single choice' },
  { value: 'MULTIPLE_CHOICE', label: 'Multiple choice' },
  { value: 'TEXT',            label: 'Text' },
]

const REQUIRED_TEXT = ['topic', 'relevance']

function makeQuestion() {
  return { id: `q_${Math.random().toString(36).slice(2, 10)}`, text: '', type: 'SINGLE_CHOICE', options: ['', ''] }
}

const INITIAL = {
  topic: '', relevance: '', sample: '',
  startDate: '', endDate: '', channels: [],
  questions: [makeQuestion()],
}

export default function DiaSurvey() {
  const [values, setValues] = useState(INITIAL)
  const [attachment, setAttachment] = useState(null)
  const [touched, setTouched] = useState({})
  const [showAllErrors, setShowAllErrors] = useState(false)
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const { set, blur } = useFieldHandlers(setValues, setTouched)

  // Defer validation so keystrokes stay snappy — the questionnaire
  // validate loop plus regex checks on 5+ scalar fields adds up on every
  // keystroke without this. Same pattern the IA registration form uses.
  const deferredValues = useDeferredValue(values)
  const errors = useMemo(() => validate(deferredValues), [deferredValues])
  const errFor = (name) => (showAllErrors || touched[name]) ? errors[name] : ''

  const startMin = useMemo(() => ({ min: todayIso() }), [])
  const endMin = useMemo(() => ({ min: values.startDate || todayIso() }), [values.startDate])
  const sampleMin = useMemo(() => ({ min: 1 }), [])

  const setQuestion = useCallback((id, patch) => setValues((p) => ({
    ...p, questions: p.questions.map((q) => q.id === id ? { ...q, ...patch } : q),
  })), [])
  const addQuestion = useCallback(() =>
    setValues((p) => ({ ...p, questions: [...p.questions, makeQuestion()] })), [])
  const removeQuestion = useCallback((id) => setValues((p) => ({
    ...p, questions: p.questions.length > 1 ? p.questions.filter((q) => q.id !== id) : p.questions,
  })), [])
  const setOption = useCallback((qid, i, val) => setValues((p) => ({
    ...p,
    questions: p.questions.map((q) => {
      if (q.id !== qid) return q
      const opts = [...q.options]; opts[i] = val
      return { ...q, options: opts }
    }),
  })), [])
  const addOption = useCallback((qid) => setValues((p) => ({
    ...p,
    questions: p.questions.map((q) => q.id === qid ? { ...q, options: [...q.options, ''] } : q),
  })), [])
  const removeOption = useCallback((qid, i) => setValues((p) => ({
    ...p,
    questions: p.questions.map((q) => {
      if (q.id !== qid) return q
      if (q.options.length <= 2) return q
      return { ...q, options: q.options.filter((_, idx) => idx !== i) }
    }),
  })), [])
  const handleChannelsChange = useCallback(
    (e) => setValues((p) => ({ ...p, channels: e.target.value })),
    [],
  )

  const reset = () => {
    setValues({ ...INITIAL, questions: [makeQuestion()] })
    setAttachment(null); setTouched({}); setShowAllErrors(false)
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
        relevanceOfTopic: values.relevance.trim(),
        startDate: values.startDate,
        endDate: values.endDate,
        sample: Number(values.sample),
        bulkMessaging: toBackendChannels(values.channels),
        attachment: null,
        surveyQuestionnaires: values.questions.map((q) => ({
          question: q.text.trim(),
          questionType: q.type,
          options: q.type === 'TEXT' ? [] : q.options.map((o) => o.trim()).filter(Boolean),
        })),
      }
      const created = await createContent(DIA_ENDPOINTS.SURVEY, dto)
      if (attachment && created?.id) {
        try {
          const urls = await uploadContentAttachments(DIA_ENDPOINTS.SURVEY, created.id, [attachment])
          if (urls[0]) {
            await updateContent(DIA_ENDPOINTS.SURVEY, created.id, { ...dto, attachment: urls[0] })
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
      title="Survey"
      subtitle="Draft a survey — submits to SIDBI HO Checker for approval."
      onSubmit={submit} onReset={reset}
      submitting={submitting}
      toast={toast} onToastClose={() => setToast(null)}
    >
      <PmuSection first title="Survey details">
        <FieldRow>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <FormTextField
              fullWidth required label="Topic"
              value={values.topic} onChange={set('topic')} onBlur={blur('topic')}
              error={!!errFor('topic')} helperText={errFor('topic')}
            />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel id="channels-label">Bulk messaging</InputLabel>
              <Select
                labelId="channels-label" multiple
                value={values.channels}
                onChange={handleChannelsChange}
                input={<OutlinedInput label="Bulk messaging" />}
                renderValue={CHIP_RENDER_VALUE}
              >
                {CHANNELS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
          </FieldCell>
          <FieldCell>
            <FormTextField
              fullWidth required multiline minRows={2} label="Relevance of the topic"
              value={values.relevance} onChange={set('relevance')} onBlur={blur('relevance')}
              error={!!errFor('relevance')} helperText={errFor('relevance')}
            />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <FormTextField
              fullWidth type="date" required label="Survey start date"
              InputLabelProps={SHRINK_LABEL}
              inputProps={startMin}
              value={values.startDate} onChange={set('startDate')} onBlur={blur('startDate')}
              error={!!errFor('startDate')} helperText={errFor('startDate')}
            />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <FormTextField
              fullWidth type="date" required label="Survey end date"
              InputLabelProps={SHRINK_LABEL}
              inputProps={endMin}
              value={values.endDate} onChange={set('endDate')} onBlur={blur('endDate')}
              error={!!errFor('endDate')} helperText={errFor('endDate')}
            />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <FormTextField
              fullWidth required type="number"
              label="Sample size"
              placeholder="Number of respondents"
              inputProps={sampleMin}
              value={values.sample} onChange={set('sample')} onBlur={blur('sample')}
              error={!!errFor('sample')} helperText={errFor('sample')}
            />
          </FieldCell>
        </FieldRow>
      </PmuSection>

      <PmuSection
        title="Questionnaire"
        description="Add the questions respondents will see. Each can be single-choice, multi-choice, or free text."
      >
        <Stack spacing={2.5}>
          {values.questions.map((q, idx) => (
            <QuestionCard
              key={q.id} index={idx} question={q}
              canRemove={values.questions.length > 1}
              onChangeQuestion={setQuestion}
              onRemoveQuestion={removeQuestion}
              onSetOption={setOption}
              onAddOption={addOption}
              onRemoveOption={removeOption}
              showErrors={showAllErrors}
              error={errors[`q_${q.id}`]}
            />
          ))}
          <Button
            size="small" variant="outlined" startIcon={<AddRoundedIcon />}
            onClick={addQuestion}
            sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
          >
            Add question
          </Button>
        </Stack>
      </PmuSection>

      <PmuSection title="Attachment">
        <FileDropField
          label="Reference document"
          accept={ATTACHMENT_ACCEPT}
          helperText="Word or PDF. Optional."
          files={attachment}
          onChange={setAttachment}
        />
      </PmuSection>
    </PmuFormShell>
  )
}

// Memoized so typing in one question doesn't re-render the other N.
// Parent hands us the raw id-bound callbacks; we re-bind to this
// question's id inline (the wrapper closures are only ever called on
// user action — never during render — so stability doesn't matter here,
// only for props passed *to* memoised children, which happen to be
// TextFields we already memoised via FormTextField).
const QuestionCard = memo(function QuestionCard({
  index, question, canRemove, onChangeQuestion, onRemoveQuestion,
  onSetOption, onAddOption, onRemoveOption,
  showErrors, error,
}) {
  const theme = useTheme()
  const needsOptions = question.type !== 'TEXT'
  const textErr = showErrors && !question.text.trim() ? 'Enter the question.' : ''
  const qid = question.id
  const handleTextChange = useCallback(
    (e) => onChangeQuestion(qid, { text: e.target.value }),
    [onChangeQuestion, qid],
  )
  const handleTypeChange = useCallback(
    (e) => onChangeQuestion(qid, { type: e.target.value }),
    [onChangeQuestion, qid],
  )
  const handleRemove = useCallback(
    () => onRemoveQuestion(qid),
    [onRemoveQuestion, qid],
  )
  const handleAddOption = useCallback(
    () => onAddOption(qid),
    [onAddOption, qid],
  )
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
        {canRemove && (
          <IconButton size="small" onClick={handleRemove} aria-label="Remove question">
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>

      <FieldRow>
        <FieldCell span={{ xs: 12, md: 8 }}>
          <FormTextField
            fullWidth required label="Question"
            value={question.text}
            onChange={handleTextChange}
            error={!!textErr} helperText={textErr}
          />
        </FieldCell>
        <FieldCell span={{ xs: 12, md: 4 }}>
          <FormTextField
            fullWidth select label="Response type"
            value={question.type}
            onChange={handleTypeChange}
          >
            {RESPONSE_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
          </FormTextField>
        </FieldCell>
        {needsOptions && (
          <FieldCell>
            <Typography sx={{ fontSize: 12.5, fontWeight: 500, color: theme.palette.text.secondary, mb: 1 }}>
              Options
            </Typography>
            <Stack spacing={1}>
              {question.options.map((opt, i) => (
                <OptionRow
                  key={i} index={i} value={opt} qid={qid}
                  showErrors={showErrors}
                  disableRemove={question.options.length <= 2}
                  onSetOption={onSetOption}
                  onRemoveOption={onRemoveOption}
                />
              ))}
              <Button
                size="small" variant="text" startIcon={<AddRoundedIcon />}
                onClick={handleAddOption}
                sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
              >
                Add option
              </Button>
            </Stack>
            {error && (
              <Typography sx={{ mt: 1, fontSize: 12.5, color: 'error.main' }}>{error}</Typography>
            )}
          </FieldCell>
        )}
      </FieldRow>
    </Box>
  )
})

// Memoized single option row. Typing in one option no longer re-renders
// the sibling options in the same question — each row observes only its
// own `value`, `index`, and the shared stable callbacks.
const OptionRow = memo(function OptionRow({
  index, value, qid, showErrors, disableRemove, onSetOption, onRemoveOption,
}) {
  const handleChange = useCallback(
    (e) => onSetOption(qid, index, e.target.value),
    [onSetOption, qid, index],
  )
  const handleRemove = useCallback(
    () => onRemoveOption(qid, index),
    [onRemoveOption, qid, index],
  )
  const empty = showErrors && !value.trim()
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <FormTextField
        fullWidth size="small"
        label={`Option ${String.fromCharCode(65 + index)}`}
        value={value}
        onChange={handleChange}
        error={empty}
        helperText={empty ? 'Required.' : ''}
      />
      <IconButton
        size="small" onClick={handleRemove}
        disabled={disableRemove}
        aria-label="Remove option"
      >
        <CloseRoundedIcon fontSize="small" />
      </IconButton>
    </Stack>
  )
})

function validate(v) {
  const errs = {}
  for (const k of REQUIRED_TEXT) if (!String(v[k] || '').trim()) errs[k] = 'Required.'
  if (!v.startDate) errs.startDate = 'Required.'
  if (!v.endDate) errs.endDate = 'Required.'
  if (v.startDate && v.endDate && v.endDate < v.startDate) errs.endDate = 'End date must be on or after the start date.'
  if (v.sample === '' || v.sample == null) errs.sample = 'Required.'
  else if (!Number.isFinite(Number(v.sample)) || Number(v.sample) < 1) errs.sample = 'Enter a positive number.'
  for (const q of v.questions) {
    if (q.type === 'TEXT') continue
    const emptyOpts = q.options.some((o) => !o.trim())
    const enough = q.options.length >= 2
    if (!enough || emptyOpts) errs[`q_${q.id}`] = 'Add at least 2 non-empty options.'
  }
  return errs
}
