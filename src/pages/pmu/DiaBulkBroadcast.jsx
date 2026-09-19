import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import {
  FormControl, FormHelperText, InputAdornment, InputLabel, MenuItem,
  OutlinedInput, Select,
} from '@mui/material'
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined'
import {
  PmuFormShell, PmuSection, FieldRow, FieldCell, FileDropField, todayIso, URL_RE,
  FormTextField, SHRINK_LABEL, useFieldHandlers, CHIP_RENDER_VALUE,
} from './_shared'
import {
  createContent, updateContent, uploadContentAttachments,
  toBackendChannels, DIA_ENDPOINTS,
} from '../../apis/diaContent'

// Stable prop objects for FormTextField — kept at module scope so memoized
// TextFields don't get busted by fresh object literals every render.
const LINK_ADORNMENT = {
  startAdornment: (
    <InputAdornment position="start">
      <LinkOutlinedIcon fontSize="small" />
    </InputAdornment>
  ),
}

// DIA — Bulk Broadcast
// GT_PMU raises; SIDBI HO Checker approves.

const CHANNELS = ['SMS', 'WhatsApp']
const ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp'
const MAIN_CONTENT_MAX = 5000

const REQUIRED_TEXT = ['topic', 'subject', 'relevance', 'sample', 'mainContent']

const INITIAL = {
  topic: '', subject: '',
  relevance: '', sample: '',
  broadcastDate: '',
  mainContent: '',
  channels: [],
  link: '',
}

export default function DiaBulkBroadcast() {
  const [values, setValues] = useState(INITIAL)
  const [attachment, setAttachment] = useState(null)
  const [touched, setTouched] = useState({})
  const [showAllErrors, setShowAllErrors] = useState(false)
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const { set, blur } = useFieldHandlers(setValues, setTouched)
  const setMainContent = useCallback(
    (e) => setValues((p) => ({ ...p, mainContent: e.target.value.slice(0, MAIN_CONTENT_MAX) })),
    [],
  )
  const handleChannelsChange = useCallback((e) => {
    setValues((p) => ({ ...p, channels: e.target.value }))
    setTouched((p) => (p.channels ? p : { ...p, channels: true }))
  }, [])

  // Defer validation so keystrokes stay snappy — see 3C form for rationale.
  const deferredValues = useDeferredValue(values)
  const errors = useMemo(() => validate(deferredValues), [deferredValues])
  const errFor = (name) => (showAllErrors || touched[name]) ? errors[name] : ''

  const broadcastMin = useMemo(() => ({ min: todayIso() }), [])
  const mainContentInputProps = useMemo(() => ({ maxLength: MAIN_CONTENT_MAX }), [])

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
        subjectLine: values.subject.trim(),
        relevanceOfTopic: values.relevance.trim(),
        sampleForBroadcast: values.sample.trim(),
        dateOfBroadcast: values.broadcastDate,
        mainContent: values.mainContent.trim(),
        // Backend still types `broadcastThrough` as `String` (not List) as of
        // 2026-09-19; send the first selected channel. Switch back to
        // `toBackendChannels(values.channels)` once Sameer changes the column.
        broadcastThrough: toBackendChannels(values.channels)[0] || null,
        link: values.link.trim() || null,
        attachment: null,
      }
      const created = await createContent(DIA_ENDPOINTS.BROADCAST, dto)
      if (attachment && created?.id) {
        try {
          const urls = await uploadContentAttachments(DIA_ENDPOINTS.BROADCAST, created.id, [attachment])
          if (urls[0]) {
            await updateContent(DIA_ENDPOINTS.BROADCAST, created.id, { ...dto, attachment: urls[0] })
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

  const chars = values.mainContent.length
  const contentErr = errFor('mainContent')

  return (
    <PmuFormShell
      title="Bulk Broadcast"
      subtitle="Draft a SMS / WhatsApp broadcast — submits to SIDBI HO Checker for approval."
      approvalNote="Once submitted, this broadcast goes to the SIDBI HO Checker for approval. Recipients receive it only after approval."
      onSubmit={submit} onReset={reset}
      submitting={submitting}
      toast={toast} onToastClose={() => setToast(null)}
    >
      <PmuSection first title="Broadcast details">
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
              fullWidth required label="Subject line"
              value={values.subject} onChange={set('subject')} onBlur={blur('subject')}
              error={!!errFor('subject')} helperText={errFor('subject')}
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
          <FieldCell>
            <FormTextField
              fullWidth required multiline minRows={2}
              label="Sample for the bulk broadcast"
              placeholder="Who receives this — audience, filters, sample size…"
              value={values.sample} onChange={set('sample')} onBlur={blur('sample')}
              error={!!errFor('sample')} helperText={errFor('sample')}
            />
          </FieldCell>
        </FieldRow>
      </PmuSection>

      <PmuSection title="Delivery">
        <FieldRow>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <FormTextField
              fullWidth type="date" required label="Date of broadcast"
              InputLabelProps={SHRINK_LABEL}
              inputProps={broadcastMin}
              value={values.broadcastDate} onChange={set('broadcastDate')} onBlur={blur('broadcastDate')}
              error={!!errFor('broadcastDate')} helperText={errFor('broadcastDate')}
            />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <FormControl fullWidth required error={!!errFor('channels')}>
              <InputLabel id="channels-label">Broadcast through</InputLabel>
              <Select
                labelId="channels-label" multiple
                value={values.channels}
                onChange={handleChannelsChange}
                input={<OutlinedInput label="Broadcast through" />}
                renderValue={CHIP_RENDER_VALUE}
              >
                {CHANNELS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
              {errFor('channels') && <FormHelperText>{errFor('channels')}</FormHelperText>}
            </FormControl>
          </FieldCell>
        </FieldRow>
      </PmuSection>

      <PmuSection title="Message body">
        <FieldRow>
          <FieldCell>
            <FormTextField
              fullWidth required multiline minRows={6}
              label="Main content"
              value={values.mainContent} onChange={setMainContent} onBlur={blur('mainContent')}
              error={!!contentErr} helperText={contentErr || `${chars} / ${MAIN_CONTENT_MAX} characters`}
              inputProps={mainContentInputProps}
            />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <FormTextField
              fullWidth label="Link" placeholder="https://…"
              value={values.link} onChange={set('link')} onBlur={blur('link')}
              error={!!errFor('link')} helperText={errFor('link')}
              InputProps={LINK_ADORNMENT}
            />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <FileDropField
              label="Attachment"
              accept={ATTACHMENT_ACCEPT}
              helperText="PDF, Word, PPT or image. Optional."
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
  for (const k of REQUIRED_TEXT) if (!String(v[k] || '').trim()) errs[k] = 'Required.'
  if (!v.broadcastDate) errs.broadcastDate = 'Required.'
  else if (v.broadcastDate < todayIso()) errs.broadcastDate = 'Broadcast date must be today or later.'
  if (!v.channels?.length) errs.channels = 'Pick at least one channel.'
  if (v.link && !URL_RE.test(v.link.trim())) errs.link = 'Enter a valid URL.'
  if (v.mainContent.length > MAIN_CONTENT_MAX) errs.mainContent = `Keep the main content under ${MAIN_CONTENT_MAX} characters.`
  return errs
}
