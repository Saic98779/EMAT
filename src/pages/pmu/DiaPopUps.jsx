import { useMemo, useState } from 'react'
import {
  PmuFormShell, PmuSection, FieldRow, FieldCell, todayIso,
  RhfTextField, RhfFileField, SHRINK_LABEL, useForm, useWatch,
} from './_shared'
import {
  createContent, updateContent, uploadContentAttachments, DIA_ENDPOINTS,
} from '../../apis/diaContent'

// DIA — Pop-Ups
// GT_PMU raises; SIDBI HO Checker approves.

const ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp'
const INITIAL = { topic: '', relevance: '', startDate: '', endDate: '', attachments: [] }

export default function DiaPopUps() {
  const methods = useForm({ mode: 'onSubmit', defaultValues: INITIAL })
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const startMin = useMemo(() => ({ min: todayIso() }), [])

  const submit = async (values) => {
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
      if (values.attachments?.length && created?.id) {
        try {
          const urls = await uploadContentAttachments(DIA_ENDPOINTS.POPUPS, created.id, values.attachments)
          if (urls.length) {
            // Backend types `attachments` as `String` (not List) as of
            // 2026-09-19; send the first URL. Switch to `urls` once
            // backend flips the column to List<String>.
            await updateContent(DIA_ENDPOINTS.POPUPS, created.id, { ...dto, attachments: urls[0] })
          }
        } catch (uploadErr) {
          setToast({ severity: 'warning', msg: `Saved, but attachment upload failed: ${uploadErr.message || 'unknown error'}.` })
          methods.reset(INITIAL)
          return
        }
      }
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
      title="Pop-Ups"
      subtitle="Schedule a pop-up — submits to SIDBI HO Checker for approval."
      approvalNote="Once submitted, this pop-up goes to the SIDBI HO Checker for approval. It becomes live only after approval and stays visible for the duration you set."
      methods={methods}
      onSubmit={submit}
      onReset={reset}
      submitting={submitting}
      toast={toast} onToastClose={() => setToast(null)}
    >
      <PmuSection first title="Pop-up details">
        <FieldRow>
          <FieldCell>
            <RhfTextField name="topic" fullWidth required label="Topic" rules={REQUIRED_TEXT} />
          </FieldCell>
          <FieldCell>
            <RhfTextField
              name="relevance" fullWidth required multiline minRows={2}
              label="Relevance of the pop-up"
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

      <PmuSection title="Attachments">
        <RhfFileField
          name="attachments"
          multiple
          label="Files"
          accept={ATTACHMENT_ACCEPT}
          helperText="PDF, Word, PPT or image. Optional. You can add multiple."
        />
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
