import { memo } from 'react'
import { Box, Button, CircularProgress, LinearProgress, Stack, Tooltip, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'

// MatrixSubmitBar
// ────────────────────────────────────────────────────────────────────────
// Sticky bottom bar shared by the scoring-matrix tabs (Eligibility,
// Sustainability). Keeps score + progress + Submit reachable no matter
// how far the user has scrolled through the 22 questions.
//
// Compact by design — score + progress in the left cluster, the single
// Submit action on the right.
//
// Props
//   score        0..100
//   tier         { label, color } from the matching TIERS export
//   answered     count of answered params
//   total        total params
//   canSubmit    Boolean
//   submitting   Boolean
//   onSubmit     () => void
function MatrixSubmitBar({
  answered = 0, total = 22,
  canSubmit = false, submitting = false, onSubmit,
}) {
  const theme = useTheme()
  const answeredPct = Math.round((answered / total) * 100)
  const disabledReason = canSubmit ? '' : `Answer all ${total} parameters to submit`

  return (
    <Box
      sx={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        mt: 4,
        background: theme.palette.background.paper,
        borderTop: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        px: { xs: 2, md: 3 },
        py: 1.5,
        zIndex: 10,
        boxShadow: '0 -4px 12px rgba(0,0,0,0.04)',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        spacing={{ xs: 1.5, sm: 2 }}
      >
        {/* Progress bar + count (score/tier live in the right-rail panel) */}
        <Box sx={{ flex: 1, minWidth: 140 }}>
          <Typography sx={{ fontSize: 12, color: theme.palette.text.secondary, mb: 0.5 }}>
            {answered} of {total} answered
          </Typography>
          <LinearProgress
            variant="determinate"
            value={answeredPct}
            sx={{
              height: 4,
              borderRadius: 2,
              background: alpha(theme.palette.text.primary, 0.09),
              '& .MuiLinearProgress-bar': {
                background: canSubmit ? theme.palette.success.main : theme.palette.primary.main,
              },
            }}
          />
        </Box>

        {/* Action */}
        <Tooltip title={disabledReason} arrow disableHoverListener={!disabledReason}>
          <span style={{ flexShrink: 0 }}>
            <Button
              size="small"
              variant="contained"
              disableElevation
              onClick={onSubmit}
              disabled={!canSubmit || submitting}
              startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : null}
            >
              {submitting ? 'Submitting…' : 'Submit matrix'}
            </Button>
          </span>
        </Tooltip>
      </Stack>
    </Box>
  )
}

export default memo(MatrixSubmitBar)
