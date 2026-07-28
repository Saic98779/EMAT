import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Stack, Typography, Button, Chip, Divider,
  CircularProgress, Snackbar, Alert, TextField, MenuItem,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import { SectionCard } from '../../components/shared'
import DocUpload from '../../components/DocUpload'
import {
  getBseRecommendation,
  updateBseRecommendation,
  toUpdatePayload,
  fromDto,
} from '../../apis/bseRecommendations'

// Review stages, in display order. Each stage owns three PUT-able fields on
// the record: <stage>Recommendation, <stage>RecommendationDate, <stage>Remarks.
const STAGES = [
  { key: 'gt', label: 'GT (Field)' },
  { key: 'pmu', label: 'PMU' },
  { key: 'ho', label: 'HO' },
  { key: 'committee', label: 'Committee' },
]

const RECOMMENDATION_OPTIONS = ['Recommended', 'Not Recommended', 'Hold']

// Header colour for the pipeline status — mirrors BseTeam.
function statusColor(status) {
  switch (status) {
    case 'Onboarded': return 'success'
    case 'Committee reviewed': return 'info'
    case 'HO reviewed': return 'info'
    case 'PMU reviewed': return 'warning'
    case 'Proposed by GT': return 'primary'
    default: return 'default'
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export default function BseCandidateDetail({ backPath = '/gt/team', backLabel = 'BSE Team' }) {
  const { uuid } = useParams()
  const navigate = useNavigate()

  const [dto, setDto] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [toast, setToast] = useState({ severity: '', msg: '' })
  const [savingStage, setSavingStage] = useState(null)

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

  // Local drafts for the four review stages — seeded from the record and
  // flushed to the backend via PUT.
  const [drafts, setDrafts] = useState({})
  useEffect(() => {
    if (!dto) return
    setDrafts({
      gt: {
        recommendation: dto.gtRecommendation || '',
        date: (dto.gtRecommendationDate || '').slice(0, 10),
        remarks: dto.gtRemarks || '',
      },
      pmu: {
        recommendation: dto.pmuRecommendation || '',
        date: (dto.pmuRecommendationDate || '').slice(0, 10),
        remarks: dto.pmuRemarks || '',
      },
      ho: {
        recommendation: dto.hoRecommendation || '',
        date: (dto.hoRecommendationDate || '').slice(0, 10),
        remarks: dto.hoRemarks || '',
      },
      committee: {
        recommendation: dto.committeeRecommendation || '',
        date: (dto.committeeRecommendationDate || '').slice(0, 10),
        remarks: dto.committeeRemarks || '',
      },
    })
  }, [dto])

  const setDraft = (stage, field, value) =>
    setDrafts((prev) => ({ ...prev, [stage]: { ...prev[stage], [field]: value } }))

  const saveStage = async (stage) => {
    const d = drafts[stage]
    if (!d) return
    setSavingStage(stage)
    try {
      const patch = toUpdatePayload({
        [`${stage}Recommendation`]: d.recommendation,
        [`${stage}RecommendationDate`]: d.date || todayIso(),
        [`${stage}Remarks`]: d.remarks,
      })
      const updated = await updateBseRecommendation(uuid, patch)
      if (updated) setDto(updated)
      setToast({ severity: 'success', msg: `${STAGES.find((s) => s.key === stage).label} recommendation saved.` })
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Failed to save.' })
    } finally {
      setSavingStage(null)
    }
  }

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
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/gt/team')} sx={{ mb: 2 }}>BSE Team</Button>

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
          <SectionCard title="Review actions" subtitle="Record recommendations for each review stage. Each row PUTs independently.">
            <Stack spacing={2.5} divider={<Divider flexItem />}>
              {STAGES.map((s) => {
                const d = drafts[s.key] || {}
                return (
                  <Box key={s.key}>
                    <Typography variant="subtitle2" mb={1.25}>{s.label}</Typography>
                    <Grid container spacing={1.5}>
                      <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField
                          select fullWidth size="small" label="Recommendation"
                          value={d.recommendation || ''}
                          onChange={(e) => setDraft(s.key, 'recommendation', e.target.value)}
                        >
                          <MenuItem value=""><em>None</em></MenuItem>
                          {RECOMMENDATION_OPTIONS.map((opt) => (
                            <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 3 }}>
                        <TextField
                          fullWidth size="small" type="date" label="Date"
                          InputLabelProps={{ shrink: true }}
                          value={d.date || ''}
                          onChange={(e) => setDraft(s.key, 'date', e.target.value)}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 5 }}>
                        <TextField
                          fullWidth size="small" label="Remarks"
                          value={d.remarks || ''}
                          onChange={(e) => setDraft(s.key, 'remarks', e.target.value)}
                        />
                      </Grid>
                    </Grid>
                    <Stack direction="row" justifyContent="flex-end" mt={1.5}>
                      <Button
                        size="small" variant="contained"
                        startIcon={savingStage === s.key ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                        disabled={savingStage === s.key}
                        onClick={() => saveStage(s.key)}
                      >
                        {savingStage === s.key ? 'Saving…' : 'Save'}
                      </Button>
                    </Stack>
                  </Box>
                )
              })}
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={2.5}>
            <DocUpload registrationUuid={dto.registrationUuid} />
          </Stack>
        </Grid>
      </Grid>

      <Snackbar
        open={!!toast.msg}
        autoHideDuration={3200}
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
