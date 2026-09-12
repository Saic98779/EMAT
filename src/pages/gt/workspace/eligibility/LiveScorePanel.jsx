import { memo } from 'react'
import { Box, LinearProgress, Stack, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'

// LiveScorePanel
// ────────────────────────────────────────────────────────────────────────
// Sticky right-rail on any scoring matrix tab. Shows the running
// percentage + tier badge + answered-progress + band legend + Submit.
// Fully data-driven so it works for Eligibility and Sustainability with
// only the tier bands changing.
//
// Props
//   score            0..100
//   tier             { label, color } from `tiers`
//   tiers            [{ min, label, color }] sorted descending by `min`
//   answered         count of answered params
//   total            total params
//   canSubmit        Boolean — enables Submit button
//   submitting       Boolean — spinner state
//   onSubmit         () => void
function LiveScorePanel({
  score = 0, tier, tiers = [], answered = 0, total = 22,
}) {
  const theme = useTheme()
  const answeredPct = Math.round((answered / total) * 100)
  const activeTier = tier || tiers[tiers.length - 1]
  const tierPalette = activeTier ? (theme.palette[activeTier.color] || theme.palette.info) : theme.palette.info

  return (
    <Box
      sx={{
        position: { md: 'sticky' },
        top: { md: 88 },
        alignSelf: 'flex-start',
        border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        borderRadius: 1.5,
        p: 2.75,
        background: theme.palette.background.paper,
        // Explicit height cap so the panel never stretches to fill the
        // grid cell if the parent uses `stretch`.
        height: 'fit-content',
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
        {activeTier && (
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
        )}
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

      {tiers.length > 0 && (
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
            {tiers.map((band) => {
              const active = score >= band.min && (band === tiers[0] || score < previousTierMin(tiers, band))
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
      )}

      {/* Submit button removed — the sticky `MatrixSubmitBar` at the
          bottom of both Eligibility + Sustainability tabs is the single
          canonical submit affordance. Two side-by-side buttons was
          confusing users. */}
    </Box>
  )
}

export default memo(LiveScorePanel)

function previousTierMin(tiers, band) {
  const idx = tiers.findIndex((t) => t === band)
  return idx > 0 ? tiers[idx - 1].min : 101
}
