import { memo } from 'react'
import { Box, Button, CircularProgress, Stack, Tooltip, Typography } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightIcon from '@mui/icons-material/ChevronRightRounded'
import { alpha, useTheme } from '@mui/material/styles'

// RegistrationFooter
// ────────────────────────────────────────────────────────────────────────
// Sticky bottom action bar for the Registration (L1) tab. Left cluster
// holds Previous / Section indicator; right holds Continue / Submit.
//
// Props
//   activeIndex           number
//   sectionCount          number
//   sectionName           string
//   canSubmit             Boolean
//   submitting            Boolean
//   completedCount        number — used to explain why submit is disabled
//   onPrev / onNext       () => void
//   onSubmit              () => void
function RegistrationFooter({
  activeIndex, sectionCount, sectionName,
  canSubmit, submitting, completedCount,
  onPrev, onNext, onSubmit,
}) {
  const theme = useTheme()
  const isLast = activeIndex === sectionCount - 1
  const isFirst = activeIndex === 0

  const submitDisabledReason = canSubmit
    ? ''
    : `${sectionCount - completedCount} section${sectionCount - completedCount === 1 ? '' : 's'} incomplete`

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
        px: 2,
        py: 1.5,
        zIndex: 10,
        boxShadow: '0 -4px 12px rgba(0,0,0,0.04)',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={2}>
        <Button
          size="small"
          variant="text"
          startIcon={<ChevronLeftIcon />}
          onClick={onPrev}
          disabled={isFirst || submitting}
          sx={{ color: 'text.secondary' }}
        >
          Previous
        </Button>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 11, color: theme.palette.text.disabled, fontWeight: 600, letterSpacing: '0.05em' }}>
            SECTION {activeIndex + 1} OF {sectionCount}
          </Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 500, color: theme.palette.text.secondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {sectionName}
          </Typography>
        </Box>

        {!isLast && (
          <Button
            size="small"
            variant="outlined"
            endIcon={<ChevronRightIcon />}
            onClick={onNext}
            disabled={submitting}
          >
            Continue
          </Button>
        )}

        <Tooltip title={submitDisabledReason} arrow disableHoverListener={!submitDisabledReason}>
          <span>
            <Button
              size="small"
              variant="contained"
              disableElevation
              onClick={onSubmit}
              disabled={!canSubmit || submitting}
              startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : null}
            >
              {submitting ? 'Submitting…' : 'Submit for L1 review'}
            </Button>
          </span>
        </Tooltip>
      </Stack>
    </Box>
  )
}

export default memo(RegistrationFooter)
