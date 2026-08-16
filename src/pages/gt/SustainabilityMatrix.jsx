import { memo, useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Stack, Typography, Button, Snackbar, Alert,
  Paper, CircularProgress, Chip, ToggleButton, ToggleButtonGroup,
  LinearProgress, Divider,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SendIcon from '@mui/icons-material/Send'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import { PageHeader } from '../../components/shared'
import {
  useIA, useAppraisalByRegistration,
  useCreateAppraisal, useCreateSustainabilityMatrix,
} from '../../queries'
import { toCreatePayload as toAppraisalCreatePayload } from '../../apis/industryAssociationAppraisals'
import { DIMENSIONS, PARAM_KEYS, MAX_SCORE, categorise } from '../../apis/sustainabilityMatrix'

// GT / SDE — Sustainability Matrix.
//
// Placement in the flow: In-Principle Approved → Sustainability Matrix
// (no approval req) → Detailed Appraisal. The IA is already created at
// this point, so `:id` on the route is the `registrationUuid`.
//
// 22 boolean parameters across 7 dimensions; weights sum to 100.
// Score + band (Highly Sustainable / Developing / Vulnerable / Weak)
// are computed live from the same spec used by the payload adapter.

const INITIAL_ANSWERS = PARAM_KEYS.reduce((acc, k) => ({ ...acc, [k]: null }), {})

export default function SustainabilityMatrix({ backPath = '/gt/ias' } = {}) {
  const navigate = useNavigate()
  const { id } = useParams()
  const iaQ = useIA(id)
  // The matrix is FK'd to `appraisalUuid`. Backend does not auto-create
  // an appraisal shell at in-principle stage, so we look it up first and
  // fall back to creating a blank appraisal (registrationUuid only,
  // everything else null) at submit time.
  const apprQ = useAppraisalByRegistration(id)
  const existingAppraisalUuid = apprQ.data?.uuid || null
  const createAppraisal = useCreateAppraisal()
  const createMatrix = useCreateSustainabilityMatrix()

  const [answers, setAnswers] = useState(INITIAL_ANSWERS)
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const setAnswer = useCallback((key, value) => {
    setAnswers((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }))
  }, [])

  const { score, tier } = useMemo(() => categorise(answers), [answers])
  const answered = PARAM_KEYS.filter((k) => answers[k] === true || answers[k] === false).length

  const problem = validate(answered, apprQ.isLoading)
  const canSubmit = !problem && !submitting && !!id

  const submit = async () => {
    if (problem) { setToast({ kind: 'warning', msg: problem }); return }
    setSubmitting(true)
    try {
      // Ensure an appraisal record exists for this IA — the sustainability
      // matrix FK's to `appraisalUuid`, not the IA registration uuid.
      let appraisalUuid = existingAppraisalUuid
      if (!appraisalUuid) {
        const shell = await createAppraisal.mutateAsync(toAppraisalCreatePayload({}, id))
        appraisalUuid = shell?.uuid
        if (!appraisalUuid) throw new Error('Appraisal shell created but response was missing a uuid.')
      }

      await createMatrix.mutateAsync({ ...answers, appraisalUuid })
      setToast({ kind: 'success', msg: 'Sustainability matrix submitted. Opening Detailed Appraisal…' })
      // Hand off to the next step in the flow. `backPath` mirrors the caller
      // context (/gt vs /sde) so this works on both sides.
      setTimeout(() => navigate(`${backPath}/${id}/appraisal`), 1200)
    } catch (err) {
      const stage = existingAppraisalUuid ? 'matrix save' : 'appraisal shell / matrix save'
      setToast({ kind: 'error', msg: err?.message || `Failed during ${stage}.` })
    } finally {
      setSubmitting(false)
    }
  }

  const ia = iaQ.data
  const subtitle = ia?.name
    ? `${ia.name} · Score the IA on 22 parameters across 7 dimensions.`
    : 'Score the IA on 22 parameters across 7 dimensions. Total contributes to a 100-point sustainability band.'

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', pb: 10 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(backPath)} sx={{ mb: 2 }}>Back</Button>

      <PageHeader title="Sustainability Matrix" subtitle={subtitle} />

      <Stack spacing={2.5}>
        {/* IA identity strip (readonly — IA already exists) */}
        <SectionCard n={1} title="IA Identity">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReadonlyRow label="Name of IA" value={ia?.name || '—'} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadonlyRow label="State" value={ia?.state || '—'} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadonlyRow label="Status" value={ia?.status || '—'} />
            </Grid>
          </Grid>
        </SectionCard>

        {/* Matrix */}
        {DIMENSIONS.map((dim, i) => (
          <DimensionCard
            key={dim.title}
            n={i + 2}
            dimension={dim}
            answers={answers}
            onAnswer={setAnswer}
          />
        ))}

        {/* Score summary */}
        <ScoreCard score={score} tier={tier} answered={answered} />
      </Stack>

      {/* Sticky submit bar */}
      <Paper
        elevation={4}
        sx={{
          position: 'sticky', bottom: 16, mt: 3, p: 2, borderRadius: 2,
          display: 'flex', alignItems: 'center', gap: 2,
          border: '1px solid', borderColor: problem ? 'warning.light' : 'divider',
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box
            sx={{
              width: 8, height: 8, borderRadius: '50%',
              bgcolor: problem ? 'warning.main' : 'success.main',
              flexShrink: 0,
            }}
          />
          <Typography
            variant="body2"
            color={problem ? 'warning.dark' : 'text.secondary'}
            fontWeight={500}
            sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {problem || 'Ready to submit assessment.'}
          </Typography>
        </Stack>
        <Button color="inherit" onClick={() => navigate(backPath)} disabled={submitting} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          size="large"
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
          disabled={!canSubmit}
          onClick={submit}
          sx={{ textTransform: 'none', fontWeight: 700, px: 3 }}
        >
          {submitting ? 'Saving…' : 'Submit Assessment'}
        </Button>
      </Paper>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast && (
          <Alert severity={toast.kind} variant="filled" onClose={() => setToast(null)}>
            {toast.msg}
          </Alert>
        )}
      </Snackbar>
    </Box>
  )
}

// ── Building blocks ─────────────────────────────────────────────────────────

const SectionCard = memo(function SectionCard({ n, title, subtitle, progress, children }) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: 1 },
      }}
    >
      <CardContent sx={{ p: 0 }}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={{
            px: 2.5, py: 1.75,
            borderBottom: '1px solid', borderColor: 'divider',
            bgcolor: 'grey.50',
          }}
        >
          <Box sx={{
            width: 30, height: 30, borderRadius: 1,
            bgcolor: 'primary.main', color: 'primary.contrastText',
            display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.85rem',
          }}>{n}</Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.25 }}>{title}</Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
            )}
          </Box>
        </Stack>
        {typeof progress === 'number' && (
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 3,
              bgcolor: 'transparent',
              '& .MuiLinearProgress-bar': {
                bgcolor: progress === 100 ? 'success.main' : 'primary.main',
              },
            }}
          />
        )}
        <Box sx={{ p: 2.5 }}>
          {children}
        </Box>
      </CardContent>
    </Card>
  )
})

function ReadonlyRow({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary"
        sx={{ letterSpacing: '0.06em', fontWeight: 700, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography variant="body1" fontWeight={600} sx={{ lineHeight: 1.35, mt: 0.25 }}>
        {value}
      </Typography>
    </Box>
  )
}

const DimensionCard = memo(function DimensionCard({ n, dimension, answers, onAnswer }) {
  const dimWeight = dimension.params.reduce((s, p) => s + p.weight, 0)
  const earned = dimension.params.reduce(
    (s, p) => s + (answers[p.key] === true ? p.weight : 0), 0,
  )
  const answered = dimension.params.filter((p) => answers[p.key] === true || answers[p.key] === false).length
  const total = dimension.params.length
  const progressPct = total === 0 ? 0 : (answered / total) * 100

  const subtitle = `${earned} of ${dimWeight} points · ${answered}/${total} answered`

  return (
    <SectionCard n={n} title={dimension.title} subtitle={subtitle} progress={progressPct}>
      <Stack divider={<Divider flexItem sx={{ borderStyle: 'dashed' }} />}>
        {dimension.params.map((p) => (
          <ParamRow
            key={p.key}
            param={p}
            paramKey={p.key}
            value={answers[p.key]}
            onAnswer={onAnswer}
          />
        ))}
      </Stack>
    </SectionCard>
  )
})

const ParamRow = memo(function ParamRow({ param, paramKey, value, onAnswer }) {
  const answered = value === true || value === false
  // Bound to `paramKey` here so DimensionCard doesn't need an inline arrow
  // per row — that would break this memo on every parent render.
  const handleChange = useCallback((_, next) => {
    if (next === null) return
    onAnswer(paramKey, next === 'true')
  }, [onAnswer, paramKey])

  return (
    <Box
      sx={{
        py: 1.75, px: 1, mx: -1, borderRadius: 1,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr auto' },
        alignItems: 'center', columnGap: 3, rowGap: 1.5,
        transition: 'background-color 0.15s',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: '0.9rem',
            fontWeight: answered ? 500 : 400,
            color: 'text.primary',
            lineHeight: 1.45,
          }}
        >
          {param.label}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}
        >
          {`WEIGHT · ${param.weight} pts`}
        </Typography>
      </Stack>

      <ToggleButtonGroup
        exclusive
        size="small"
        value={value === true ? 'true' : value === false ? 'false' : null}
        onChange={handleChange}
        sx={{
          justifySelf: { md: 'end' },
          '& .MuiToggleButton-root': {
            px: 2, py: 0.75, minWidth: 76, fontWeight: 700, textTransform: 'none',
            borderColor: 'divider',
          },
          '& .MuiToggleButton-root.Mui-selected[value="true"]': {
            bgcolor: 'success.main', color: 'success.contrastText',
            '&:hover': { bgcolor: 'success.dark' },
          },
          '& .MuiToggleButton-root.Mui-selected[value="false"]': {
            bgcolor: 'error.main', color: 'error.contrastText',
            '&:hover': { bgcolor: 'error.dark' },
          },
        }}
      >
        <ToggleButton value="true" aria-label="Yes">
          <CheckIcon sx={{ fontSize: 16, mr: 0.5 }} /> Yes
        </ToggleButton>
        <ToggleButton value="false" aria-label="No">
          <CloseIcon sx={{ fontSize: 16, mr: 0.5 }} /> No
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  )
})

function ScoreCard({ score, tier, answered }) {
  const scored = answered > 0
  const complete = answered === PARAM_KEYS.length
  const progressPct = (answered / PARAM_KEYS.length) * 100
  const accentColor = scored ? tier.color : 'primary'

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2, overflow: 'hidden',
        borderColor: scored ? `${accentColor}.main` : 'divider',
        borderTop: (t) => `4px solid ${t.palette[accentColor]?.main || t.palette.primary.main}`,
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid size={{ xs: 12, sm: 4 }}>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.14em', fontWeight: 700 }}>
              Total Score
            </Typography>
            <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mt: 0.5 }}>
              <Typography sx={{
                fontSize: '3rem', fontWeight: 800, lineHeight: 1,
                color: scored ? `${accentColor}.dark` : 'text.disabled',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {score}
              </Typography>
              <Typography color="text.secondary" fontWeight={600}>/ {MAX_SCORE}</Typography>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, sm: 5 }}>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.14em', fontWeight: 700 }}>
              Sustainability Band
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              {scored ? (
                <Chip
                  label={tier.label}
                  color={tier.color}
                  sx={{ fontWeight: 800, fontSize: '0.95rem', px: 1.25, py: 2.25, height: 'auto' }}
                />
              ) : (
                <Typography variant="body2" color="text.disabled" fontStyle="italic">
                  Not scored yet
                </Typography>
              )}
            </Box>
          </Grid>

          <Grid size={{ xs: 12, sm: 3 }}>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.14em', fontWeight: 700 }}>
              Progress
            </Typography>
            <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mt: 0.5 }}>
              <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {answered}
              </Typography>
              <Typography color="text.secondary" fontWeight={600}>
                / {PARAM_KEYS.length}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={progressPct}
              sx={{
                mt: 0.5, height: 6, borderRadius: 3,
                '& .MuiLinearProgress-bar': {
                  bgcolor: complete ? 'success.main' : 'primary.main',
                },
              }}
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 2.5 }} />

        <Typography variant="overline" color="text.secondary"
          sx={{ letterSpacing: '0.14em', fontWeight: 700, display: 'block', mb: 1 }}>
          Scoring Bands
        </Typography>
        <Grid container spacing={1.5}>
          <TierLegend activeLabel={scored ? tier.label : null} />
        </Grid>
      </CardContent>
    </Card>
  )
}

function TierLegend({ activeLabel }) {
  const bands = [
    { range: '80 – 100', label: 'Highly Sustainable',     color: 'success' },
    { range: '60 – 79',  label: 'Developing Association', color: 'info' },
    { range: '40 – 59',  label: 'Vulnerable Association', color: 'warning' },
    { range: '< 40',     label: 'Weak',                   color: 'error' },
  ]
  return bands.map((b) => {
    const active = activeLabel === b.label
    return (
      <Grid size={{ xs: 6, sm: 3 }} key={b.label}>
        <Box
          sx={{
            p: 1.25,
            borderRadius: 1.5,
            border: '1px solid',
            borderColor: active ? `${b.color}.main` : 'divider',
            bgcolor: active ? `${b.color}.light` : 'transparent',
            transition: 'all 0.2s',
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{
              width: 8, height: 8, borderRadius: '50%', bgcolor: `${b.color}.main`,
              boxShadow: active ? (t) => `0 0 0 3px ${t.palette[b.color].main}22` : 'none',
            }} />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em' }}>
                {b.range}
              </Typography>
              <Typography variant="body2" fontWeight={active ? 800 : 700}
                sx={{ color: active ? `${b.color}.dark` : 'text.primary', lineHeight: 1.25 }}>
                {b.label}
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Grid>
    )
  })
}

// ── Helpers ────────────────────────────────────────────────────────────────

function validate(answered, appraisalLoading) {
  if (appraisalLoading) return 'Loading appraisal record…'
  if (answered < PARAM_KEYS.length) {
    return `Answer all ${PARAM_KEYS.length} matrix parameters (${answered} done).`
  }
  return null
}
