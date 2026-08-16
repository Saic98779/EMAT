import { useMemo } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack,
  Typography, Chip, Grid, Divider, LinearProgress, Alert, CircularProgress,
  IconButton, Tooltip,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import { useEligibilityMatrixByRegistration, useIA } from '../queries'
import { DIMENSIONS, MAX_SCORE, PARAM_KEYS, categorise } from '../apis/eligibilityMatrix'

// Read-only viewer for a GT eligibility assessment attached to an IA.
// Fetches both the matrix (by registrationUuid) and the IA record so the
// header can show the association name / email / PAN as context.
export default function EligibilityMatrixModal({ open, onClose, registrationUuid }) {
  const q = useEligibilityMatrixByRegistration(open ? registrationUuid : null)
  // IA context — name/email/PAN for the header. Cache is shared with the
  // rest of the app (useIAs / useIA), so this is usually free on re-open.
  const iaQ = useIA(open ? registrationUuid : null)
  const ia = iaQ.data

  // Backend may return single object OR list — take the newest if list.
  const record = useMemo(() => {
    if (!q.data) return null
    if (Array.isArray(q.data)) return q.data[0] || null
    return q.data
  }, [q.data])

  const answers = record || {}
  const { score, tier } = useMemo(() => categorise(answers), [answers])
  const answered = record
    ? PARAM_KEYS.filter((k) => answers[k] === true || answers[k] === false).length
    : 0

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{
        pb: 1.5, display: 'flex', alignItems: 'flex-start', gap: 1.5,
        borderBottom: '1px solid', borderColor: 'divider',
      }}>
        <Box sx={{
          width: 40, height: 40, borderRadius: 1.5, flexShrink: 0,
          bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
          color: 'primary.main',
          display: 'grid', placeItems: 'center', mt: 0.25,
        }}>
          <BusinessOutlinedIcon />
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary"
            sx={{ letterSpacing: '0.14em', fontWeight: 700, display: 'block', lineHeight: 1.4 }}>
            GT Assessment · Eligibility Matrix
          </Typography>
          <Typography variant="h6" fontWeight={700} noWrap>
            {ia?.name || (iaQ.isLoading ? 'Loading…' : '—')}
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mt: 0.25 }} flexWrap="wrap">
            <MetaField label="PAN" value={ia?.panNo} mono />
            <MetaField label="Email" value={ia?.email} mono />
          </Stack>
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, bgcolor: 'background.default' }}>
        {q.isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {q.error && (
          <Alert severity="warning" sx={{ m: 2 }} variant="outlined">
            {q.error.status === 404
              ? "This IA doesn't have an eligibility assessment on record."
              : q.error.message || 'Failed to load eligibility record.'}
          </Alert>
        )}

        {!q.isLoading && !q.error && !record && (
          <Alert severity="info" sx={{ m: 2 }} variant="outlined">
            No eligibility matrix has been submitted for this IA yet.
          </Alert>
        )}

        {record && (
          <>
            <ScoreHeader
              score={score}
              tier={tier}
              answered={answered}
            />
            <Box sx={{ p: 2.5 }}>
              <Stack spacing={2}>
                {DIMENSIONS.map((dim) => (
                  <DimensionBlock key={dim.title} dimension={dim} answers={answers} />
                ))}
              </Stack>
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ borderTop: '1px solid', borderColor: 'divider', px: 2.5, py: 1.5 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

// Compact "PAN · ABCDE1234F" style label used in the modal header. Falls
// back to em-dash so the row always renders and doesn't jump.
function MetaField({ label, value, mono }) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="baseline">
      <Typography variant="caption" color="text.secondary"
        sx={{ letterSpacing: '0.06em', fontWeight: 700, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography variant="body2"
        sx={{ fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' : undefined,
              color: value ? 'text.primary' : 'text.disabled' }}>
        {value || '—'}
      </Typography>
    </Stack>
  )
}

// Refined header — soft tinted background from the tier's colour (no more
// grey.50), a subtle top accent, a coloured dot next to the status pill,
// and a progress bar showing where the score sits on the 0–MAX scale.
function ScoreHeader({ score, tier, answered }) {
  const pct = MAX_SCORE ? Math.min(100, Math.round((score / MAX_SCORE) * 100)) : 0
  return (
    <Box sx={{
      px: 2.5, py: 2.25,
      bgcolor: (t) => alpha(mainColor(t, tier.color), 0.06),
      borderBottom: (t) => `1px solid ${alpha(mainColor(t, tier.color), 0.18)}`,
      borderTop: (t) => `3px solid ${alpha(mainColor(t, tier.color), 0.7)}`,
    }}>
      <Grid container spacing={2} alignItems="center">
        <Grid size={{ xs: 12, sm: 4 }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.14em', fontWeight: 700 }}>
            Total Score
          </Typography>
          <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mt: 0.25 }}>
            <Typography sx={{
              fontSize: '2rem', fontWeight: 800, lineHeight: 1,
              color: 'text.primary', fontVariantNumeric: 'tabular-nums',
            }}>
              {score}
            </Typography>
            <Typography color="text.secondary" fontWeight={600}>/ {MAX_SCORE}</Typography>
          </Stack>
          {/* Soft progress bar — same tier colour, muted */}
          <LinearProgress
            variant="determinate" value={pct}
            sx={{
              mt: 1, height: 5, borderRadius: 3,
              bgcolor: (t) => alpha(mainColor(t, tier.color), 0.12),
              '& .MuiLinearProgress-bar': {
                bgcolor: (t) => alpha(mainColor(t, tier.color), 0.75),
                borderRadius: 3,
              },
            }}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 5 }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.14em', fontWeight: 700 }}>
            Organisation Status
          </Typography>
          <Box sx={{ mt: 0.5 }}>
            <TierBadge tier={tier} />
          </Box>
        </Grid>

        <Grid size={{ xs: 12, sm: 3 }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.14em', fontWeight: 700 }}>
            Answered
          </Typography>
          <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mt: 0.5 }}>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'text.primary' }}>
              {answered}
            </Typography>
            <Typography color="text.secondary" fontWeight={600}>/ {PARAM_KEYS.length}</Typography>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  )
}

// Soft-fill outlined pill with a coloured dot — reads calmer than a solid
// MUI Chip and works even when the underlying `tier.color` is red/error.
function TierBadge({ tier }) {
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 1,
      pl: 1.25, pr: 1.75, py: 0.6,
      borderRadius: 999,
      bgcolor: (t) => alpha(mainColor(t, tier.color), 0.10),
      border: (t) => `1px solid ${alpha(mainColor(t, tier.color), 0.35)}`,
      color: (t) => darkColor(t, tier.color),
    }}>
      <Box sx={{
        width: 8, height: 8, borderRadius: '50%',
        bgcolor: (t) => alpha(mainColor(t, tier.color), 0.85),
      }} />
      <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', lineHeight: 1 }}>
        {tier.label}
      </Typography>
    </Box>
  )
}

function DimensionBlock({ dimension, answers }) {
  const dimWeight = dimension.params.reduce((s, p) => s + p.weight, 0)
  const earned = dimension.params.reduce(
    (s, p) => s + (answers[p.key] === true ? p.weight : 0), 0,
  )
  const pct = dimWeight === 0 ? 0 : (earned / dimWeight) * 100

  return (
    <Box sx={{
      border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden',
      bgcolor: 'background.paper',
    }}>
      <Stack
        direction="row" alignItems="center" spacing={1.5}
        sx={{ px: 2, py: 1.25, bgcolor: (t) => alpha(t.palette.primary.main, 0.03), borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1 }}>
          {dimension.title}
        </Typography>
        <Chip
          size="small" variant="outlined"
          color={dimWeight === 0 ? 'default' : 'primary'}
          label={`${earned} / ${dimWeight} pts`}
          sx={{ fontWeight: 700 }}
        />
      </Stack>
      {dimWeight > 0 && (
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{
            height: 3, bgcolor: 'transparent',
            '& .MuiLinearProgress-bar': { bgcolor: (t) => alpha(t.palette.primary.main, 0.7) },
          }}
        />
      )}
      <Stack divider={<Divider flexItem sx={{ borderStyle: 'dashed' }} />}>
        {dimension.params.map((p) => (
          <ParamLine key={p.key} param={p} answer={answers[p.key]} />
        ))}
      </Stack>
    </Box>
  )
}

function ParamLine({ param, answer }) {
  const isYes = answer === true
  const isNo = answer === false
  const unanswered = !isYes && !isNo

  return (
    <Box sx={{
      px: 2, py: 1.25,
      display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 1.5, alignItems: 'center',
    }}>
      <Stack direction="row" alignItems="flex-start" spacing={0.5} sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.85rem', lineHeight: 1.4, flexGrow: 1 }}>
          {param.label}
        </Typography>
        {param.guide && (
          <Tooltip title={param.guide} arrow placement="top">
            <HelpOutlineIcon sx={{ fontSize: 15, color: 'action.active', mt: 0.25 }} />
          </Tooltip>
        )}
        {param.reason && (
          <Tooltip title={param.reason} arrow placement="top">
            <InfoOutlinedIcon sx={{ fontSize: 15, color: 'action.active', mt: 0.25 }} />
          </Tooltip>
        )}
      </Stack>
      <Typography variant="caption" color="text.secondary" fontWeight={600}
        sx={{ letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
        {param.weight} pts
      </Typography>
      <AnswerBadge yes={isYes} no={isNo} unanswered={unanswered} />
    </Box>
  )
}

// Soft outlined pills — the Yes chip now uses a tinted background instead
// of full-saturation MUI success/error so it reads as data, not alarm.
function AnswerBadge({ yes, no, unanswered }) {
  if (unanswered) {
    return (
      <SoftPill
        icon={<RemoveCircleOutlineIcon sx={{ fontSize: 14 }} />}
        label="—"
        colorKey="grey"
      />
    )
  }
  if (yes) {
    return (
      <SoftPill
        icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
        label="Yes"
        colorKey="success"
      />
    )
  }
  return (
    <SoftPill
      icon={<CancelIcon sx={{ fontSize: 14 }} />}
      label="No"
      colorKey="error"
    />
  )
}

function SoftPill({ icon, label, colorKey }) {
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5,
      minWidth: 72, justifyContent: 'center',
      px: 1, py: 0.5, borderRadius: 999,
      bgcolor: (t) => alpha(mainColor(t, colorKey), 0.10),
      border: (t) => `1px solid ${alpha(mainColor(t, colorKey), 0.28)}`,
      color: (t) => darkColor(t, colorKey),
      fontWeight: 700, fontSize: '0.78rem',
    }}>
      {icon}
      <span>{label}</span>
    </Box>
  )
}

// Palette resolvers — accept the MUI theme + a colour key ('success'|'info'|
// 'warning'|'error'|'primary'|'grey') and fall back to primary/text if the
// key isn't in the palette. Keeps the tint math consistent across chips.
function mainColor(t, key) {
  if (key === 'grey') return t.palette.text.primary
  return t.palette[key]?.main || t.palette.primary.main
}
function darkColor(t, key) {
  if (key === 'grey') return t.palette.text.secondary
  return t.palette[key]?.dark || t.palette.primary.dark
}
