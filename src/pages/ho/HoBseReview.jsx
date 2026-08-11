import { memo, useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Stack, Typography, Button, Chip, Divider,
  CircularProgress, Snackbar, Alert, TextField, MenuItem,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { SectionCard } from '../../components/shared'
import DocUpload from '../../components/DocUpload'
import { useBse, useUpdateBse } from '../../queries'
import { toUpdatePayload, fromDto } from '../../apis/bseRecommendations'

// SIDBI HO Maker workspace for a single BSE recommendation.
//
// Perf shape: each editable card is a memoized child that owns its own local
// draft state. The parent only holds `dto`, the toast, and stable save
// callbacks. Typing in one card doesn't re-render the others or the
// read-only sections. DocUpload is memoized in its own module.
//
// Layout:
//   ① Candidate profile (read-only, from GT)
//   ② Upstream recommendations (GT, PMU — read-only)
//   ③ HO recommendation  (editable)
//   ④ Committee decision (editable — with MoM filename)
//   ⑤ Onboarding block   (revealed after Committee = "Recommended")
//   + Supporting documents sidebar

const RECOMMENDATION_OPTIONS = ['Recommended', 'Not Recommended', 'Hold']

const todayIso = () => new Date().toISOString().slice(0, 10)

function statusColor(status) {
  switch (status) {
    case 'Onboarded': return 'success'
    case 'Committee reviewed':
    case 'HO reviewed': return 'info'
    case 'PMU reviewed': return 'warning'
    case 'Proposed by GT': return 'primary'
    default: return 'default'
  }
}

export default function HoBseReview() {
  const { uuid } = useParams()
  const navigate = useNavigate()

  const bseQ = useBse(uuid)
  const updateM = useUpdateBse()
  const dto = bseQ.data
  const view = useMemo(() => (dto ? fromDto(dto) : null), [dto])

  const [toast, setToast] = useState({ severity: '', msg: '' })

  // Save handlers are `useCallback` so child components never see a fresh
  // prop identity between keystrokes.
  const doSave = useCallback(async (label, patchSource) => {
    try {
      const patch = toUpdatePayload(patchSource)
      await updateM.mutateAsync({ uuid, patch })
      setToast({ severity: 'success', msg: `${label} saved.` })
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Failed to save.' })
    }
  }, [updateM, uuid])

  const saveHo = useCallback((d) => doSave('HO recommendation', {
    hoRecommendation: d.recommendation,
    hoRecommendationDate: d.date || todayIso(),
    hoRemarks: d.remarks,
  }), [doSave])

  const saveCommittee = useCallback((d) => doSave('Committee decision', {
    committeeRecommendation: d.recommendation,
    committeeDate: d.date || todayIso(),
    committeeRemarks: d.remarks,
    committeeMom: d.mom,
  }), [doSave])

  const saveOnboarding = useCallback((d) => doSave('Onboarding details', {
    approvedSalary: d.approvedSalary,
    approvedTravelAllowance: d.approvedTravelAllowance,
    dateOfJoining: d.dateOfJoining || todayIso(),
    iaMapped: d.iaMapped,
    // Mirror `iaMapped` onto `iaSelected` — the backend `/user/{id}/selected`
    // endpoint filters on `iaSelected`, so without this the MPA disbursement
    // resource list stays empty even after a candidate is onboarded.
    iaSelected: d.iaMapped,
  }), [doSave])

  if (bseQ.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
  }
  if (bseQ.error) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/sde/bse-approvals')} sx={{ mb: 2 }}>BSE Approvals</Button>
        <Alert severity="error">{bseQ.error.message || 'Failed to load candidate'}</Alert>
      </Box>
    )
  }
  if (!view) return null

  // Onboarding is only meaningful after Committee has recommended the candidate.
  const committeeApproved = dto.committeeRecommendation === 'Recommended'

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/sde/bse-approvals')} sx={{ mb: 2 }}>BSE Approvals</Button>

      <Card sx={{ mb: 2.5 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
            <Typography variant="h5">{view.name}</Typography>
            <Chip size="small" color={statusColor(view.status)} label={view.status} />
            <Box sx={{ flexGrow: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Submitted {view.submitted} · {view.ia}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={2.5}>
            <CandidateProfile view={view} />
            <UpstreamRecommendations dto={dto} />
            <HoBlock initial={dto} onSave={saveHo} />
            <CommitteeBlock initial={dto} onSave={saveCommittee} />
            {committeeApproved && <OnboardingBlock initial={dto} onSave={saveOnboarding} />}
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={2.5} sx={{ position: { md: 'sticky' }, top: { md: 88 } }}>
            {/* Files uploaded during BSE create are keyed by the BSE
                record's own UUID, so scope the panel to `dto.uuid`. HO can
                also attach the Committee MoM here. */}
            <DocUpload registrationUuid={dto.uuid} />
          </Stack>
        </Grid>
      </Grid>

      <Snackbar
        open={!!toast.msg}
        autoHideDuration={3000}
        onClose={() => setToast({ severity: '', msg: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast.severity || 'info'} variant="filled" onClose={() => setToast({ severity: '', msg: '' })}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}

// ── Read-only sections ──────────────────────────────────────────────────────

const CandidateProfile = memo(function CandidateProfile({ view }) {
  return (
    <SectionCard title="Candidate profile" subtitle="Captured by GT Field Manager.">
      <Grid container spacing={2}>
        <ReadField label="Mobile" value={view.mobile} />
        <ReadField label="Email" value={view.email} />
        <ReadField label="Qualification" value={view.qualification} />
        <ReadField label="Experience" value={view.experience} />
        <ReadField label="Employment status" value={view.employmentStatus} />
        <ReadField label="Current salary" value={view.currentSalary != null ? `₹${view.currentSalary}` : '—'} />
        <ReadField label="Notice period" value={view.noticePeriod != null ? `${view.noticePeriod}d` : '—'} />
        <ReadField label="Last drawn salary" value={view.lastDrawnSalary != null ? `₹${view.lastDrawnSalary}` : '—'} />
        <ReadField label="Expected salary" value={view.expectedSalary ? `₹${view.expectedSalary}` : '—'} />
        <ReadField label="Resume status" value={view.resumeStatus} />
      </Grid>
    </SectionCard>
  )
})

const UpstreamRecommendations = memo(function UpstreamRecommendations({ dto }) {
  return (
    <SectionCard title="Upstream recommendations" subtitle="GT and PMU have already reviewed this candidate.">
      <Stack divider={<Divider flexItem />} spacing={2}>
        <StageRow label="GT Field" status={dto.gtRecommendation} date={dto.gtRecommendationDate} remarks={dto.gtRemarks} />
        <StageRow label="GT PMU" status={dto.pmuRecommendation} date={dto.pmuRecommendationDate} remarks={dto.pmuRemarks} />
      </Stack>
    </SectionCard>
  )
})

// ── Editable blocks — each owns its own state ───────────────────────────────

const HO_MAPPING = [
  ['recommendation', 'hoRecommendation', false],
  ['date', 'hoRecommendationDate', true],
  ['remarks', 'hoRemarks', false],
]

const HoBlock = memo(function HoBlock({ initial, onSave }) {
  const [d, setD] = useState({
    recommendation: initial.hoRecommendation || '',
    date: (initial.hoRecommendationDate || '').slice(0, 10),
    remarks: initial.hoRemarks || '',
  })
  const [saving, setSaving] = useState(false)

  const set = useCallback((k) => (v) => setD((p) => ({ ...p, [k]: v })), [])
  const save = useCallback(async () => {
    setSaving(true)
    try { await onSave(d) } finally { setSaving(false) }
  }, [onSave, d])

  const dirty = isDirty(d, initial, HO_MAPPING)

  return (
    <SectionCard
      title="HO recommendation"
      subtitle="Your review at the SIDBI HO stage."
      action={<SavedChip status={initial.hoRecommendation} date={initial.hoRecommendationDate} />}
    >
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <RecommendationSelect value={d.recommendation} onChange={set('recommendation')} label="Recommendation" />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <DateField value={d.date} onChange={set('date')} label="Date" />
        </Grid>
        <Grid size={{ xs: 12, sm: 5 }}>
          <TextInput value={d.remarks} onChange={set('remarks')} label="Remarks" />
        </Grid>
      </Grid>
      <SaveRow onSave={save} saving={saving} dirty={dirty} label="Save HO recommendation" />
    </SectionCard>
  )
})

const COMMITTEE_MAPPING = [
  ['recommendation', 'committeeRecommendation', false],
  ['date', 'committeeDate', true],
  ['remarks', 'committeeRemarks', false],
  ['mom', 'committeeMom', false],
]

const CommitteeBlock = memo(function CommitteeBlock({ initial, onSave }) {
  const [d, setD] = useState({
    recommendation: initial.committeeRecommendation || '',
    date: (initial.committeeDate || '').slice(0, 10),
    remarks: initial.committeeRemarks || '',
    mom: initial.committeeMom || '',
  })
  const [saving, setSaving] = useState(false)

  const set = useCallback((k) => (v) => setD((p) => ({ ...p, [k]: v })), [])
  const save = useCallback(async () => {
    setSaving(true)
    try { await onSave(d) } finally { setSaving(false) }
  }, [onSave, d])

  const dirty = isDirty(d, initial, COMMITTEE_MAPPING)

  return (
    <SectionCard
      title="Committee decision"
      subtitle="Recorded by SIDBI HO Maker on behalf of the committee."
      action={<SavedChip status={initial.committeeRecommendation} date={initial.committeeDate} />}
    >
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <RecommendationSelect value={d.recommendation} onChange={set('recommendation')} label="Committee status" />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <DateField value={d.date} onChange={set('date')} label="Committee date" />
        </Grid>
        <Grid size={{ xs: 12, sm: 5 }}>
          <TextInput
            value={d.mom}
            onChange={set('mom')}
            label="MoM file / reference"
            placeholder="e.g. committee_mom_2026-08-03.pdf"
            helperText="Upload the actual PDF via the Supporting Documents panel; paste the filename here."
          />
        </Grid>
        <Grid size={12}>
          <TextInput value={d.remarks} onChange={set('remarks')} label="Committee remarks" multiline />
        </Grid>
      </Grid>
      <SaveRow onSave={save} saving={saving} dirty={dirty} label="Save committee decision" />
    </SectionCard>
  )
})

const ONBOARDING_MAPPING = [
  ['approvedSalary', 'approvedSalary', false],
  ['approvedTravelAllowance', 'approvedTravelAllowance', false],
  ['dateOfJoining', 'dateOfJoining', true],
  ['iaMapped', 'iaMapped', false],
]

const OnboardingBlock = memo(function OnboardingBlock({ initial, onSave }) {
  const [d, setD] = useState({
    approvedSalary: initial.approvedSalary ?? '',
    approvedTravelAllowance: initial.approvedTravelAllowance ?? '',
    dateOfJoining: (initial.dateOfJoining || '').slice(0, 10),
    iaMapped: !!initial.iaMapped,
  })
  const [saving, setSaving] = useState(false)

  const set = useCallback((k) => (v) => setD((p) => ({ ...p, [k]: v })), [])
  const save = useCallback(async () => {
    setSaving(true)
    try { await onSave(d) } finally { setSaving(false) }
  }, [onSave, d])

  // Onboarding has no "recommendation" — treat "any onboarding value present"
  // as the saved indicator so the chip appears once HO has filled it in.
  const onboarded = initial.dateOfJoining || initial.approvedSalary != null || initial.iaMapped
  // Manual dirty-check because iaMapped is a boolean coerced from a string.
  const dirty =
    String(d.approvedSalary ?? '') !== String(initial.approvedSalary ?? '') ||
    String(d.approvedTravelAllowance ?? '') !== String(initial.approvedTravelAllowance ?? '') ||
    (d.dateOfJoining || '') !== (initial.dateOfJoining || '').slice(0, 10) ||
    !!d.iaMapped !== !!initial.iaMapped

  return (
    <SectionCard
      title="Onboarding"
      subtitle="Confirm salary, travel allowance, joining date and IA mapping."
      action={
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip size="small" color="success" icon={<CheckCircleOutlineIcon />} label="Committee approved" />
          {onboarded && (
            <Chip
              size="small" color="success" variant="outlined"
              icon={<CheckCircleOutlineIcon />}
              label={initial.dateOfJoining
                ? `Onboarded · DOJ ${new Date(initial.dateOfJoining).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
                : 'Onboarded'}
              sx={{ fontWeight: 700 }}
            />
          )}
        </Stack>
      }
    >
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, sm: 3 }}>
          <MoneyField value={d.approvedSalary} onChange={set('approvedSalary')} label="Approved salary (₹/month)" />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <MoneyField value={d.approvedTravelAllowance} onChange={set('approvedTravelAllowance')} label="Approved TA (₹/month)" />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <DateField value={d.dateOfJoining} onChange={set('dateOfJoining')} label="Date of joining" />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField
            select fullWidth size="small" label="IA Mapped"
            value={d.iaMapped ? 'yes' : 'no'}
            onChange={(e) => set('iaMapped')(e.target.value === 'yes')}
          >
            <MenuItem value="no">No</MenuItem>
            <MenuItem value="yes">Yes</MenuItem>
          </TextField>
        </Grid>
      </Grid>
      <SaveRow onSave={save} saving={saving} dirty={dirty} label="Save onboarding details" color="success" />
    </SectionCard>
  )
})

// ── Small reusable inputs (each takes primitive value + setter) ─────────────

const RecommendationSelect = memo(function RecommendationSelect({ value, onChange, label }) {
  return (
    <TextField
      select fullWidth size="small" label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <MenuItem value=""><em>None</em></MenuItem>
      {RECOMMENDATION_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
    </TextField>
  )
})

const DateField = memo(function DateField({ value, onChange, label }) {
  return (
    <TextField
      fullWidth size="small" type="date" label={label}
      InputLabelProps={{ shrink: true }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
})

const TextInput = memo(function TextInput({ value, onChange, label, placeholder, helperText, multiline }) {
  return (
    <TextField
      fullWidth size="small" label={label}
      placeholder={placeholder}
      helperText={helperText}
      multiline={!!multiline}
      minRows={multiline ? 2 : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
})

const MoneyField = memo(function MoneyField({ value, onChange, label }) {
  return (
    <TextField
      fullWidth size="small" type="number" label={label}
      InputProps={{ startAdornment: <Typography sx={{ mr: 0.5 }}>₹</Typography> }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
})

// Save button row + inline "unsaved changes" hint. When the local draft
// matches the DTO's saved values the button greys out and reads "Saved" —
// clearly signalling the write has landed and there's nothing to do.
function SaveRow({ onSave, saving, label, color = 'primary', dirty = true }) {
  return (
    <Stack direction="row" spacing={1.5} justifyContent="flex-end" alignItems="center" mt={1.5}>
      {dirty && !saving && (
        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          Unsaved changes
        </Typography>
      )}
      <Button
        size="small" variant="contained" color={color}
        startIcon={saving
          ? <CircularProgress size={14} color="inherit" />
          : dirty ? <SaveIcon /> : <CheckCircleOutlineIcon />}
        disabled={saving || !dirty}
        onClick={onSave}
      >
        {saving ? 'Saving…' : dirty ? label : 'Saved'}
      </Button>
    </Stack>
  )
}

// Small "already saved" chip that lives in a SectionCard's `action` slot.
// Renders nothing until the DTO has a recorded status — after that, it
// shows the decision + the date it was recorded so the reviewer sees at a
// glance that the stage is done.
function SavedChip({ status, date }) {
  if (!status) return null
  const color = status === 'Recommended' ? 'success'
    : status === 'Not Recommended' ? 'error' : 'warning'
  const dateLabel = date ? new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null
  return (
    <Chip
      size="small" color={color}
      icon={<CheckCircleOutlineIcon />}
      label={dateLabel ? `${status} · ${dateLabel}` : status}
      sx={{ fontWeight: 700 }}
    />
  )
}

// Detects whether the current draft matches the DTO's saved values. Used to
// gate the Save button + show the "Unsaved changes" hint.
function isDirty(d, initial, mapping) {
  for (const [draftKey, dtoKey, sliceDate] of mapping) {
    const draftVal = d[draftKey] ?? ''
    const savedVal = initial[dtoKey] ?? ''
    const norm = sliceDate ? String(savedVal).slice(0, 10) : savedVal
    if (String(draftVal) !== String(norm)) return true
  }
  return false
}

function ReadField({ label, value }) {
  return (
    <Grid size={{ xs: 6, sm: 4, md: 3 }}>
      <Typography variant="overline" color="text.secondary" display="block">{label}</Typography>
      <Typography fontWeight={500}>{value ?? '—'}</Typography>
    </Grid>
  )
}

function StageRow({ label, status, date, remarks }) {
  const decided = !!status
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
      <Typography variant="subtitle2" sx={{ minWidth: 100 }}>{label}</Typography>
      <Chip size="small"
        color={status === 'Recommended' ? 'success' : status === 'Not Recommended' ? 'error' : 'default'}
        label={decided ? status : 'Pending'}
        sx={{ fontWeight: 600 }} />
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110 }}>
        {date ? new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
      </Typography>
      <Typography variant="body2" sx={{ flexGrow: 1 }}>
        {remarks || <Box component="span" sx={{ color: 'text.disabled' }}>No remarks</Box>}
      </Typography>
    </Stack>
  )
}
