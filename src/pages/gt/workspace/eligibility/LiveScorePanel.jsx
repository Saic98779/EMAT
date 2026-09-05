import { memo } from 'react'
import { Box, Button, LinearProgress, Stack, Tooltip, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { TIERS } from '../../../../apis/eligibilityMatrix'

// LiveScorePanel
// ────────────────────────────────────────────────────────────────────────
// Sticky right-rail on the Eligibility Matrix tab. Shows the running
// percentage + tier badge + answered-progress + band legend, and hosts
// the Submit / Save-Draft actions.
//
// Props
//   score            0..100 (already computed)
//   tier             { label, color } from TIERS
//   answered         count of answered params
//   total            total params (usually 22)
//   canSubmit        Boolean — enables Submit button
//   submitting       Boolean — spinner state
//   onSubmit         () => void
//   onSaveDraft      () => void  (may be a placeholder for now)
function LiveScorePanel({
  score = 0, tier, answered = 0, total = 22,
  canSubmit = false, submitting = false,
  onSubmit, onSaveDraft,
}) {
  const theme = useTheme()
  const answeredPct = Math.round((answered / total) * 100)
  const activeTier = tier || TIERS[TIERS.length - 1]
  const tierPalette = theme.palette[activeTier.color] || theme.palette.info

  return (
    <Box
      sx={{
        position: { md: 'sticky' },
        top: { md: 88 },
        border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        borderRadius: 1.5,
        p: 2.75,
        background: theme.palette.background.paper,
      }}
    >
      <Typography
        variant="overline"
        sx={{
          fontSize: 11,
          color: theme.palette.text.disabled,
          fontWeight: 600,
          letterSpacing: '0.05em',
        }}
      >
        Live score
      </Typography>

      <Stack direction="row" alignItems="baseline" spacing={1.25} sx={{ mt: 0.75 }}>
        <Typography sx={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1 }}>
          {score}%
        </Typography>
        <Box
          sx={{
            fontSize: 12.75,
            fontWeight: 600,
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            background: alpha(tierPalette.main, 0.16),
            color: tierPalette.dark,
          }}
        >
          {activeTier.label}
        </Box>
      </Stack>

      <Box sx={{ mt: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ fontSize: 12.5, color: theme.palette.text.secondary }}>
          <span>{answered} of {total} answered</span>
          <span>{answeredPct}%</span>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={answeredPct}
          sx={{
            height: 5,
            borderRadius: 3,
            mt: 1,
            background: alpha(theme.palette.text.primary, 0.09),
            '& .MuiLinearProgress-bar': { background: theme.palette.primary.main },
          }}
        />
      </Box>

      <Box
        sx={{
          mt: 2.75,
          pt: 1.75,
          borderTop: 1,
          borderColor: alpha(theme.palette.text.primary, 0.09),
        }}
      >
        <Typography
          variant="overline"
          sx={{
            fontSize: 11,
            color: theme.palette.text.disabled,
            fontWeight: 600,
            letterSpacing: '0.05em',
          }}
        >
          Bands
        </Typography>
        <Stack spacing={0.75} sx={{ mt: 1 }}>
          {TIERS.map((band) => {
            const active = score >= band.min && (band === TIERS[0] || score < previousTierMin(band))
            const palette = theme.palette[band.color] || theme.palette.info
            return (
              <Stack key={band.label} direction="row" alignItems="center" spacing={1.25}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: 0.25,
                    flexShrink: 0,
                    background: palette.main,
                  }}
                />
                <Typography
                  sx={{
                    fontSize: 12.75,
                    fontWeight: active ? 600 : 400,
                    color: score >= band.min ? theme.palette.text.primary : theme.palette.text.disabled,
                  }}
                >
                  {band.min}+ {band.label}
                </Typography>
              </Stack>
            )
          })}
        </Stack>
      </Box>

      <Stack spacing={1.25} sx={{ mt: 2.5 }}>
        <Button
          fullWidth
          variant="contained"
          disableElevation
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? 'Submitting…' : 'Submit matrix'}
        </Button>
        {!canSubmit && !submitting && (
          <Typography sx={{ fontSize: 11.5, color: theme.palette.text.disabled, textAlign: 'center' }}>
            Answer all parameters to submit
          </Typography>
        )}
        <Tooltip title="Save-draft support will land alongside the backend endpoint." arrow>
          <span>
            <Button
              fullWidth
              variant="outlined"
              onClick={onSaveDraft}
              disabled={submitting}
              sx={{ color: 'text.secondary' }}
            >
              Save draft
            </Button>
          </span>
        </Tooltip>
      </Stack>
    </Box>
  )
}

export default memo(LiveScorePanel)

function previousTierMin(band) {
  const idx = TIERS.findIndex((t) => t === band)
  return idx > 0 ? TIERS[idx - 1].min : 101
}
