import { memo, useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Stack, Typography, Button, Chip,
  CircularProgress, Snackbar, Alert, TextField, MenuItem,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import { SectionCard } from '../../components/shared'
import DocUpload from '../../components/DocUpload'
import { useBse, useUpdateBse } from '../../queries'
import { toUpdatePayload, fromDto } from '../../apis/bseRecommendations'

// GT PMU workspace for a single BSE recommendation.
//
// Perf shape mirrors HoBseReview — the editable PMU card is a memoized child
// with its own state so keystrokes don't re-render the read-only profile,
// the GT recommendation strip, or DocUpload.

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

export default function PmuReview() {
  const { uuid } = useParams()
  const navigate = useNavigate()

  const bseQ = useBse(uuid)
  const updateM = useUpdateBse()
  const dto = bseQ.data
  const view = useMemo(() => (dto ? fromDto(dto) : null), [dto])

  const [toast, setToast] = useState({ severity: '', msg: '' })

  const savePmu = useCallback(async (d) => {
    try {
      const patch = toUpdatePayload({
        pmuRecommendation: d.recommendation,
        pmuRecommendationDate: d.date || todayIso(),
        pmuRemarks: d.remarks,
      })
      await updateM.mutateAsync({ uuid, patch })
      setToast({ severity: 'success', msg: 'PMU recommendation saved.' })
      setTimeout(() => navigate('/gt/pmu/queue'), 900)
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Failed to save.' })
    }
  }, [updateM, uuid, navigate])

  if (bseQ.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
  }
  if (bseQ.error) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/gt/pmu/queue')} sx={{ mb: 2 }}>PMU Queue</Button>
        <Alert severity="error">{bseQ.error.message || 'Failed to load candidate'}</Alert>
      </Box>
    )
  }
  if (!view) return null

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/gt/pmu/queue')} sx={{ mb: 2 }}>PMU Queue</Button>

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
            <GtRecommendationCard dto={dto} />
            <PmuBlock initial={dto} onSave={savePmu} />
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={2.5} sx={{ position: { md: 'sticky' }, top: { md: 88 } }}>
            {/* Files uploaded during BSE create are keyed by the BSE
                record's own UUID, so read them off `dto.uuid`. */}
            <DocUpload registrationUuid={dto.uuid} readOnly />
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

const GtRecommendationCard = memo(function GtRecommendationCard({ dto }) {
  return (
    <SectionCard title="GT recommendation" subtitle="Recorded by the GT Field Manager.">
      <StageRow label="GT Field" status={dto.gtRecommendation} date={dto.gtRecommendationDate} remarks={dto.gtRemarks} />
    </SectionCard>
  )
})

// ── Editable block ──────────────────────────────────────────────────────────

const PmuBlock = memo(function PmuBlock({ initial, onSave }) {
  const [d, setD] = useState({
    recommendation: initial.pmuRecommendation || '',
    date: (initial.pmuRecommendationDate || '').slice(0, 10),
    remarks: initial.pmuRemarks || '',
  })
  const [saving, setSaving] = useState(false)

  const set = useCallback((k) => (v) => setD((p) => ({ ...p, [k]: v })), [])
  const save = useCallback(async () => {
    setSaving(true)
    try { await onSave(d) } finally { setSaving(false) }
  }, [onSave, d])

  return (
    <SectionCard title="PMU recommendation" subtitle="Your review at the GT PMU stage.">
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <RecommendationSelect value={d.recommendation} onChange={set('recommendation')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <DateField value={d.date} onChange={set('date')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 5 }}>
          <TextInput value={d.remarks} onChange={set('remarks')} label="Remarks" />
        </Grid>
      </Grid>
      <Stack direction="row" justifyContent="flex-end" mt={1.5}>
        <Button
          size="small" variant="contained"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          disabled={saving || !d.recommendation}
          onClick={save}
        >
          {saving ? 'Saving…' : 'Save PMU recommendation'}
        </Button>
      </Stack>
    </SectionCard>
  )
})

// ── Small reusable inputs ───────────────────────────────────────────────────

const RecommendationSelect = memo(function RecommendationSelect({ value, onChange }) {
  return (
    <TextField
      select fullWidth size="small" label="Recommendation"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <MenuItem value=""><em>None</em></MenuItem>
      {RECOMMENDATION_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
    </TextField>
  )
})

const DateField = memo(function DateField({ value, onChange }) {
  return (
    <TextField
      fullWidth size="small" type="date" label="Date"
      InputLabelProps={{ shrink: true }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
})

const TextInput = memo(function TextInput({ value, onChange, label }) {
  return (
    <TextField
      fullWidth size="small" label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
})

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
