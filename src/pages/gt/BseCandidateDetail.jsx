import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Stack, Typography, Button, Chip, Divider,
  CircularProgress, Snackbar, Alert,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { SectionCard } from '../../components/shared'
import DocUpload from '../../components/DocUpload'
import {
  getBseRecommendation,
  fromDto,
} from '../../apis/bseRecommendations'

// GT Field Team view of a proposed BSE candidate. Read-only across all four
// review stages — GT cannot record recommendations on behalf of PMU / HO /
// Committee; those roles have their own workspaces (PmuReview, HoBseReview).
// This page is a status snapshot: candidate profile + stage-by-stage progress
// + supporting documents.

// Colour for the header status chip — mirrors BseTeam.
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

const STAGES = [
  { key: 'gt', label: 'GT (Field)' },
  { key: 'pmu', label: 'PMU' },
  { key: 'ho', label: 'HO' },
  { key: 'committee', label: 'Committee' },
]

// Pull the status/date/remarks triple for a stage off the DTO. Committee
// uses `committeeDate` (not `committeeRecommendationDate`) — that's the only
// per-stage naming quirk on the backend.
function stageValues(dto, key) {
  if (!dto) return { status: '', date: '', remarks: '' }
  if (key === 'committee') {
    return {
      status: dto.committeeRecommendation || '',
      date: dto.committeeDate || '',
      remarks: dto.committeeRemarks || '',
    }
  }
  return {
    status: dto[`${key}Recommendation`] || '',
    date: dto[`${key}RecommendationDate`] || '',
    remarks: dto[`${key}Remarks`] || '',
  }
}

export default function BseCandidateDetail({ backPath = '/gt/team', backLabel = 'BSE Team' }) {
  const { uuid } = useParams()
  const navigate = useNavigate()

  const [dto, setDto] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [toast, setToast] = useState({ severity: '', msg: '' })

  const load = useCallback(async (signal) => {
    setLoading(true)
    setLoadError('')
    try {
      const raw = await getBseRecommendation(uuid, { signal })
      setDto(raw)
    } catch (err) {
      if (err.name === 'AbortError') return
      setLoadError(err.message || 'Failed to load candidate')
    } finally {
      setLoading(false)
    }
  }, [uuid])

  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [load])

  const view = useMemo(() => (dto ? fromDto(dto) : null), [dto])

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
  }

  if (loadError) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(backPath)} sx={{ mb: 2 }}>{backLabel}</Button>
        <Alert severity="error">{loadError}</Alert>
      </Box>
    )
  }

  if (!view) return null

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(backPath)} sx={{ mb: 2 }}>{backLabel}</Button>

      <Card sx={{ mb: 2.5 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap" mb={2}>
            <Typography variant="h5">{view.name}</Typography>
            <Chip size="small" color={statusColor(view.status)} label={view.status} />
            <Box sx={{ flexGrow: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Submitted {view.submitted} · {view.ia}
            </Typography>
          </Stack>

          <Grid container spacing={2}>
            <Field label="Mobile" value={view.mobile} />
            <Field label="Email" value={view.email} />
            <Field label="Qualification" value={view.qualification} />
            <Field label="Experience" value={view.experience} />
            <Field label="Employment status" value={view.employmentStatus} />
            <Field label="Expected salary" value={view.expectedSalary ? `₹${view.expectedSalary}` : '—'} />
            <Field label="Current salary" value={view.currentSalary != null ? `₹${view.currentSalary}` : '—'} />
            <Field label="Notice period" value={view.noticePeriod != null ? `${view.noticePeriod}d` : '—'} />
            <Field label="Last drawn salary" value={view.lastDrawnSalary != null ? `₹${view.lastDrawnSalary}` : '—'} />
            <Field label="Resume status" value={view.resumeStatus} />
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard
            title="Review progress"
            subtitle="Recommendations recorded at each stage. Decisions are made by PMU, HO, and Committee in their own workspaces."
          >
            <Stack divider={<Divider flexItem />} spacing={2}>
              {STAGES.map((s) => {
                const v = stageValues(dto, s.key)
                return <StageRow key={s.key} label={s.label} status={v.status} date={v.date} remarks={v.remarks} />
              })}
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          {/* Files uploaded during BSE create are keyed by the BSE record's
              own UUID (not the parent IA's), so read them off `dto.uuid`. */}
          <DocUpload registrationUuid={dto.uuid} readOnly />
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

function Field({ label, value }) {
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
