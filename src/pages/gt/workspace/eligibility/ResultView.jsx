import { memo, useState } from 'react'
import { Box, Button, Collapse, LinearProgress, Stack, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { alpha, useTheme } from '@mui/material/styles'
import { DIMENSIONS, TIERS } from '../../../../apis/eligibilityMatrix'

// ResultView
// ────────────────────────────────────────────────────────────────────────
// Read-only view rendered on the Eligibility tab once the matrix has
// been submitted. Everything hero-first: giant score → tier chip →
// per-dimension breakdown → collapsed answer list → continue CTA.
//
// Props
//   score               0..100
//   tier                { label, color } from TIERS
//   answers             Map of paramKey → true | false | null
//   submittedBy         String — actor display name
//   submittedAt         String — human-readable timestamp
//   onContinue          () => void — advances to Registration L1 tab
function ResultView({ score, tier, answers = {}, submittedBy, submittedAt, onContinue }) {
  const theme = useTheme()
  const [answersOpen, setAnswersOpen] = useState(false)

  const activeTier = tier || TIERS[TIERS.length - 1]
  const tierPalette = theme.palette[activeTier.color] || theme.palette.info

  const perDimension = DIMENSIONS.map((d) => {
    const total = d.params.length
    const yes = d.params.filter((p) => answers[p.key] === true).length
    return {
      title: d.title,
      pct: total ? Math.round((yes / total) * 100) : 0,
      ratio: `${yes} of ${total}`,
      color: bandColor(theme, total ? (yes / total) * 100 : 0),
    }
  })

  return (
    <Box>
      {/* Hero score */}
      <Box
        sx={{
          textAlign: 'center',
          py: 3,
          borderBottom: 1,
          borderColor: alpha(theme.palette.text.primary, 0.09),
        }}
      >
        <Typography sx={{ fontSize: 64, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1 }}>
          {score}%
        </Typography>
        <Box
          sx={{
            display: 'inline-block',
            mt: 1.5,
            background: alpha(tierPalette.main, 0.16),
            color: tierPalette.dark,
            fontSize: 13.5,
            fontWeight: 600,
            px: 1.75,
            py: 0.75,
            borderRadius: 1,
          }}
        >
          {activeTier.label}
        </Box>
        {(submittedBy || submittedAt) && (
          <Typography sx={{ fontSize: 12.75, color: theme.palette.text.disabled, mt: 1.5 }}>
            {submittedBy ? `Submitted by ${submittedBy}` : ''}
            {submittedBy && submittedAt ? ' · ' : ''}
            {submittedAt || ''}
          </Typography>
        )}
      </Box>

      {/* Per-dimension breakdown */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 0,
          borderBottom: 1,
          borderColor: alpha(theme.palette.text.primary, 0.09),
        }}
      >
        {perDimension.map((d) => (
          <Box key={d.title} sx={{ py: 3, pr: 3 }}>
            <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary }}>{d.title}</Typography>
            <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mt: 0.75 }}>
              <Typography sx={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{d.pct}%</Typography>
              <Typography sx={{ fontSize: 12.75, color: theme.palette.text.disabled }}>{d.ratio}</Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={d.pct}
              sx={{
                mt: 1.25,
                height: 3,
                borderRadius: 1,
                maxWidth: 150,
                background: alpha(theme.palette.text.primary, 0.09),
                '& .MuiLinearProgress-bar': { background: d.color },
              }}
            />
          </Box>
        ))}
      </Box>

      {/* Collapsible answer list */}
      <Box sx={{ mt: 4, maxWidth: 820 }}>
        <Box
          component="button"
          type="button"
          onClick={() => setAnswersOpen((v) => !v)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            width: '100%',
            border: 0,
            background: 'transparent',
            fontFamily: 'inherit',
            padding: '0 0 12px',
            cursor: 'pointer',
            textAlign: 'left',
            borderBottom: 1,
            borderColor: alpha(theme.palette.text.primary, 0.09),
          }}
        >
          <ExpandMoreIcon
            sx={{
              fontSize: 20,
              color: theme.palette.text.disabled,
              transform: answersOpen ? 'none' : 'rotate(-90deg)',
              transition: 'transform 150ms ease',
            }}
          />
          <Typography sx={{ fontSize: 14.5, fontWeight: 600 }}>View all 22 answers</Typography>
        </Box>
        <Collapse in={answersOpen} unmountOnExit>
          <Stack>
            {DIMENSIONS.flatMap((d) => d.params.map((p) => ({ ...p, dim: d.title }))).map((p) => (
              <AnswerRow key={p.key} param={p} value={answers[p.key]} />
            ))}
          </Stack>
        </Collapse>
      </Box>

      {/* Continue CTA */}
      <Box
        sx={{
          mt: 5,
          background: alpha(theme.palette.primary.light, 0.5),
          borderRadius: 1.5,
          px: 3,
          py: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 2.5,
          flexWrap: 'wrap',
          maxWidth: 820,
        }}
      >
        <Box sx={{ flex: '1 1 320px', minWidth: 260 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700 }}>Continue to Registration (L1)</Typography>
          <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary, mt: 0.5 }}>
            The next step is your In-Principle Approval form.
          </Typography>
        </Box>
        <Button variant="contained" disableElevation onClick={onContinue}>
          Open L1 form
        </Button>
      </Box>
    </Box>
  )
}

export default memo(ResultView)

function AnswerRow({ param, value }) {
  const theme = useTheme()
  const label = value === true ? 'Yes' : value === false ? 'No' : '—'
  const bg =
    value === true ? alpha(theme.palette.success.main, 0.14)
    : value === false ? alpha(theme.palette.error.main, 0.14)
    : alpha(theme.palette.text.primary, 0.06)
  const fg =
    value === true ? theme.palette.success.dark
    : value === false ? theme.palette.error.dark
    : theme.palette.text.disabled

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.75}
      sx={{
        py: 1.25,
        borderBottom: 1,
        borderColor: alpha(theme.palette.text.primary, 0.06),
      }}
    >
      <Typography sx={{ fontSize: 11.5, color: theme.palette.text.disabled, width: 130, flexShrink: 0 }}>
        {param.dim}
      </Typography>
      <Typography sx={{ flex: 1, minWidth: 0, fontSize: 13.5, textWrap: 'pretty' }}>{param.label}</Typography>
      <Box
        sx={{
          flexShrink: 0,
          width: 44,
          textAlign: 'center',
          fontSize: 12.5,
          fontWeight: 600,
          py: 0.375,
          borderRadius: 0.75,
          background: bg,
          color: fg,
        }}
      >
        {label}
      </Box>
    </Stack>
  )
}

function bandColor(theme, pct) {
  if (pct >= 75) return theme.palette.success.main
  if (pct >= 50) return theme.palette.info.main
  if (pct >= 25) return theme.palette.warning.main
  return theme.palette.error.main
}
