import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import {
  FormControl, InputLabel, MenuItem, OutlinedInput, Select,
} from '@mui/material'
import {
  PmuFormShell, PmuSection, FieldRow, FieldCell, FileDropField, todayIso,
  FormTextField, SHRINK_LABEL, useFieldHandlers, CHIP_RENDER_VALUE,
} from './_shared'
import {
  createContent, updateContent, uploadContentAttachments,
  toBackendChannels, DIA_ENDPOINTS,
} from '../../apis/diaContent'

// DIA — 3C Info-Series
// GT_PMU raises; SIDBI HO Checker approves.

const CHANNELS = ['Email', 'SMS', 'WhatsApp']
const ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp'

const REQUIRED = ['topic', 'chapterNo', 'subjectLine', 'relevance', 'brief', 'mainContent']

const INITIAL = {
  topic: '', chapterNo: '', subjectLine: '',
  relevance: '', brief: '', mainContent: '',
  channels: [], publishDate: '',
}

export default function Dia3cInfoSeries() {
  const [values, setValues] = useState(INITIAL)
  const [attachment, setAttachment] = useState(null)
  const [touched, setTouched] = useState({})
  const [showAllErrors, setShowAllErrors] = useState(false)
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const { set, blur } = useFieldHandlers(setValues, setTouched)

  // Defer the values used for validation so `validate()` runs off the
  // critical path — keystrokes render immediately, error re-computation
  // catches up on idle. Same pattern the IA registration form uses.
  const deferredValues = useDeferredValue(values)
  const errors = useMemo(() => validate(deferredValues), [deferredValues])
  const errFor = (name) => (showAllErrors || touched[name]) ? errors[name] : ''

  // Stable Select onChange so the MUI Select isn't re-instantiated on every
  // keystroke in unrelated text fields.
  const handleChannelsChange = useCallback(
    (e) => setValues((p) => ({ ...p, channels: e.target.value })),
    [],
  )

  const publishMin = useMemo(() => ({ min: todayIso() }), [])

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
        chapterNo: values.chapterNo.trim(),
        subjectLine: values.subjectLine.trim(),
        relevanceOfTopic: values.relevance.trim(),
        briefOfContent: values.brief.trim(),
        mainContent: values.mainContent.trim(),
        bulkMessaging: toBackendChannels(values.channels),
        proposedPublishDate: values.publishDate || null,
        attachment: null,
      }
      const created = await createContent(DIA_ENDPOINTS.INFO_SERIES, dto)
      if (attachment && created?.id) {
        try {
          const urls = await uploadContentAttachments(DIA_ENDPOINTS.INFO_SERIES, created.id, [attachment])
          if (urls[0]) {
            await updateContent(DIA_ENDPOINTS.INFO_SERIES, created.id, { ...dto, attachment: urls[0] })
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
      title="3C Info-Series"
      subtitle="Draft an info-series entry — submits to SIDBI HO Checker for approval."
      onSubmit={submit} onReset={reset}
      submitting={submitting}
      toast={toast} onToastClose={() => setToast(null)}
    >
      <PmuSection first title="Entry details">
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
              fullWidth required label="Chapter No."
              value={values.chapterNo} onChange={set('chapterNo')} onBlur={blur('chapterNo')}
              error={!!errFor('chapterNo')} helperText={errFor('chapterNo')}
            />
          </FieldCell>
          <FieldCell>
            <FormTextField
              fullWidth required label="Subject line"
              value={values.subjectLine} onChange={set('subjectLine')} onBlur={blur('subjectLine')}
              error={!!errFor('subjectLine')} helperText={errFor('subjectLine')}
            />
          </FieldCell>
        </FieldRow>
      </PmuSection>

      <PmuSection title="Content" description="Short summary + full body copy that goes out.">
        <FieldRow>
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

      <PmuSection title="Delivery">
        <FieldRow>
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
          <FieldCell span={{ xs: 12, md: 6 }}>
            <FormTextField
              fullWidth type="date" label="Proposed publish date"
              InputLabelProps={SHRINK_LABEL}
              inputProps={publishMin}
              value={values.publishDate} onChange={set('publishDate')} onBlur={blur('publishDate')}
              error={!!errFor('publishDate')} helperText={errFor('publishDate')}
            />
          </FieldCell>
          <FieldCell>
            <FileDropField
              label="Attachment"
              accept={ATTACHMENT_ACCEPT}
              helperText="PDF, Word, PPT, PNG or JPG. Optional."
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
  if (v.publishDate && v.publishDate < todayIso()) errs.publishDate = 'Publish date must be today or later.'
  return errs
}
