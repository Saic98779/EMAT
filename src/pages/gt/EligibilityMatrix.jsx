import { memo, useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Stack, Typography, Button, Snackbar, Alert,
  Paper, CircularProgress, TextField, MenuItem, Chip, Tooltip, IconButton,
  Divider, ToggleButton, ToggleButtonGroup, LinearProgress,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SendIcon from '@mui/icons-material/Send'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import { PageHeader } from '../../components/shared'
import { STATES } from '../../geo'
import { createIndustryAssociation } from '../../apis/industryAssociations'
import { useCreateEligibilityMatrix } from '../../queries'
import { DIMENSIONS, PARAM_KEYS, MAX_SCORE, categorise } from '../../apis/eligibilityMatrix'
import { useAuth } from '../../auth'

// GT Field Team — Eligibility Matrix.
//
// Flow:
//   1. GT fills header (state, IA name, PAN, email) + 22 boolean parameters.
//   2. On submit, POST /industry-association-registrations with the
//      header fields (backend accepts a partial record) → returns
//      `registrationUuid`.
//   3. POST /eligibility-matrix with `registrationUuid` + the 22 booleans
//      + computed totalScore.
//
// PAN and IA-level email don't have proper columns on the current IA
// schema yet (only apex/nodal person emails exist). Sent optimistically
// as `pan` and `emailId` — backend has been asked to add those columns.
// If they land on other field names, adjust `iaPayloadFromHeader` below.
//
// Score + tier are computed live from spec weights (see
// `apis/eligibilityMatrix.js`). Reason / guide text render as tooltips.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/

// Initial answers = every param unset. Users must explicitly pick True/False
// for each — no silent defaults so the score reflects real answers only.
const INITIAL_ANSWERS = PARAM_KEYS.reduce((acc, k) => ({ ...acc, [k]: null }), {})

export default function EligibilityMatrix() {
  const navigate = useNavigate()
  const { role } = useAuth()
  const createMatrix = useCreateEligibilityMatrix()

  // Post-submit redirect target depends on the actor's workspace. SDE has
  // to land in /sde/… so the In-Principle form runs its auto-approve
  // branch (InPrincipleApproval reads `role === 'sde'`). /gt/… routes are
  // walled off from SDE by <Protected role="gt">, so a hard-coded /gt
  // path bounces SDE back to the dashboard mid-flow.
  const workspaceBase = role === 'sde' ? '/sde' : '/gt'

  const [header, setHeader] = useState({ state: '', industryAssociationName: '', pan: '', emailId: '' })
  const [answers, setAnswers] = useState(INITIAL_ANSWERS)
  const [toast, setToast] = useState(null)
  // Two-step submit state — remember any IA uuid created in step 1 so a
  // step-2 failure can retry without creating a duplicate IA.
  const [createdIaUuid, setCreatedIaUuid] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const setHeaderField = useCallback((name, value) => {
    setHeader((prev) => (prev[name] === value ? prev : { ...prev, [name]: value }))
  }, [])
  const setAnswer = useCallback((key, value) => {
    setAnswers((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }))
  }, [])

  const { score, tier } = useMemo(() => categorise(answers), [answers])
  const answered = PARAM_KEYS.filter((k) => answers[k] === true || answers[k] === false).length

  const problem = validate(header, answers, answered)
  const canSubmit = !problem && !submitting

  const submit = async () => {
    if (problem) { setToast({ kind: 'warning', msg: problem }); return }
    setSubmitting(true)
    try {
      // Step 1: create (or reuse) the IA record for identity.
      let regUuid = createdIaUuid
      if (!regUuid) {
        const iaResp = await createIndustryAssociation(iaPayloadFromHeader(header))
        regUuid = iaResp?.uuid
        if (!regUuid) throw new Error('IA created but response was missing a uuid.')
        setCreatedIaUuid(regUuid)
      }

      // Step 2: create the eligibility matrix record linked to that IA.
      await createMatrix.mutateAsync({ ...answers, registrationUuid: regUuid })

      setToast({ kind: 'success', msg: 'Eligibility matrix submitted. Continuing to In-Principle Approval…' })
      // Push GT into the In-Principle form for this same IA — the header
      // fields (state, name, PAN, email) are already on the backend record
      // and the matrix is linked. In-Principle will hydrate + PUT-merge.
      setTimeout(() => navigate(`${workspaceBase}/ias/${regUuid}/in-principle`), 900)
    } catch (err) {
      // Step-1 failure vs step-2 failure gets a different message; the
      // retry path is safe either way because we remember `createdIaUuid`.
      const stage = createdIaUuid ? 'eligibility save' : 'IA creation'
      setToast({ kind: 'error', msg: err?.message || `Failed during ${stage}.` })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', pb: 10 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(workspaceBase)} sx={{ mb: 2 }}>Back</Button>

      <PageHeader
        title="Eligibility Matrix"
        subtitle="Score a candidate IA against the SIDBI PPT criteria. Each dimension contributes to a 100-point total that classifies the IA."
      />

      <Stack spacing={2.5}>
        {/* Header block ────────────────────────────────────────────── */}
        <SectionCard n={1} title="IA Identity">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                select fullWidth size="small" required
                label="State"
                value={header.state}
                onChange={(e) => setHeaderField('state', e.target.value)}
                helperText="Location of assessment"
              >
                {STATES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <TextField
                fullWidth size="small" required
                label="Name of Industry Association (IA)"
                value={header.industryAssociationName}
                onChange={(e) => setHeaderField('industryAssociationName', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth size="small" required
                label="PAN (UID)"
                value={header.pan}
                onChange={(e) => setHeaderField('pan', e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
                inputProps={{ maxLength: 10 }}
                error={!!header.pan && !PAN_RE.test(header.pan)}
                helperText={
                  header.pan && !PAN_RE.test(header.pan)
                    ? 'Enter a valid 10-character PAN (5 letters + 4 digits + 1 letter).'
                    : ' '
                }
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth size="small" required
                label="Email ID"
                type="email"
                value={header.emailId}
                onChange={(e) => setHeaderField('emailId', e.target.value)}
                error={!!header.emailId && !EMAIL_RE.test(header.emailId)}
                helperText={
                  header.emailId && !EMAIL_RE.test(header.emailId)
                    ? 'Enter a valid email address.'
                    : ' '
                }
              />
            </Grid>
          </Grid>
        </SectionCard>

        {/* Matrix ─────────────────────────────────────────────────── */}
        {DIMENSIONS.map((dim, i) => (
          <DimensionCard
            key={dim.title}
            n={i + 2}
            dimension={dim}
            answers={answers}
            onAnswer={setAnswer}
          />
        ))}

        {/* Score summary ───────────────────────────────────────────── */}
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
            {problem || (createdIaUuid ? 'IA already created — retrying eligibility save only.' : 'Ready to submit assessment.')}
          </Typography>
        </Stack>
        <Button color="inherit" onClick={() => navigate(workspaceBase)} disabled={submitting} sx={{ textTransform: 'none' }}>
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
          {submitting
            ? (createdIaUuid ? 'Saving matrix…' : 'Creating IA…')
            : (createdIaUuid ? 'Retry matrix save' : 'Submit Assessment')}
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

const DimensionCard = memo(function DimensionCard({ n, dimension, answers, onAnswer }) {
  const dimWeight = dimension.params.reduce((s, p) => s + p.weight, 0)
  const earned = dimension.params.reduce(
    (s, p) => s + (answers[p.key] === true ? p.weight : 0), 0,
  )
  const answered = dimension.params.filter((p) => answers[p.key] === true || answers[p.key] === false).length
  const total = dimension.params.length
  const progressPct = total === 0 ? 0 : (answered / total) * 100

  const subtitle = dimWeight === 0
    ? 'Not weighted — recorded for context only.'
    : `${earned} of ${dimWeight} points · ${answered}/${total} answered`

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
  const zeroWeight = param.weight === 0
  // `onAnswer` is a stable ref from the parent (useCallback with no deps).
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
      {/* Label + hints + weight badge */}
      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
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
          {param.guide && (
            <Tooltip title={param.guide} arrow placement="top">
              <IconButton size="small" sx={{ p: 0.25 }} tabIndex={-1}>
                <HelpOutlineIcon sx={{ fontSize: 16 }} color="action" />
              </IconButton>
            </Tooltip>
          )}
          {param.reason && (
            <Tooltip title={param.reason} arrow placement="top">
              <IconButton size="small" sx={{ p: 0.25 }} tabIndex={-1}>
                <InfoOutlinedIcon sx={{ fontSize: 16 }} color="action" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        <Typography
          variant="caption"
          sx={{
            color: zeroWeight ? 'text.disabled' : 'text.secondary',
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}
        >
          {zeroWeight ? 'CONTEXT ONLY · 0 pts' : `WEIGHT · ${param.weight} pts`}
        </Typography>
      </Stack>

      {/* Yes / No toggle */}
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
  // Only show tier colour once GT has answered *something*. Before that,
  // the card stays neutral so a fresh form doesn't scream "Weak" in red.
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
          {/* Score dial */}
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

          {/* Status chip */}
          <Grid size={{ xs: 12, sm: 5 }}>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.14em', fontWeight: 700 }}>
              Organisation Status
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

          {/* Answered progress */}
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
    { range: '75 – 100', label: 'Developed',              color: 'success' },
    { range: '50 – 74',  label: 'Moderately Developed',   color: 'info' },
    { range: '25 – 49',  label: 'Developing Association', color: 'warning' },
    { range: '< 25',     label: 'Weak',                   color: 'error' },
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

function validate(header, answers, answered) {
  if (!header.state) return 'Pick the state.'
  if (!header.industryAssociationName?.trim()) return 'Enter the IA name.'
  if (!header.pan?.trim()) return 'Enter the PAN.'
  if (!PAN_RE.test(header.pan)) return 'PAN format is invalid.'
  if (!header.emailId?.trim()) return 'Enter the email ID.'
  if (!EMAIL_RE.test(header.emailId)) return 'Email format is invalid.'
  if (answered < PARAM_KEYS.length) {
    return `Answer all ${PARAM_KEYS.length} matrix parameters (${answered} done).`
  }
  return null
}

// Map header state → IA `toPayload` input shape. The IA POST expects the
// underscore-cased frontend keys (`ia_name`, `pan_no`, `email` — the
// adapter re-maps them to the backend's `industryAssociationName`,
// `panNo`, `email`). See `apis/industryAssociations.js#toPayload`.
// Backend added the `panNo` and `email` columns Aug '26 (verified live
// on 2026-08-16 — POST round-trips both).
function iaPayloadFromHeader(h) {
  return {
    state: h.state,
    ia_name: h.industryAssociationName,
    pan_no: h.pan,
    email: h.emailId,
  }
}
