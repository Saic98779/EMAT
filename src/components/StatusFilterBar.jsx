import { memo } from 'react'
import { Box, Stack, Typography, Badge } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'

// StatusFilterBar
// ────────────────────────────────────────────────────────────────────────
// Reusable segmented filter used above list pages (IA Approvals, BSE
// Approvals, IA Onboarding list). Renders as a soft pill row inside a
// single rounded container — reads like a segmented control, not a
// loose chip strip.
//
// Props:
//   filters   [{ key, label, count?, tone? }]  — tone ∈ {'default','success','warning','error','info'}
//   value     string — the currently selected key
//   onChange  (key: string) => void
//   label     optional caption shown to the left ("Filter", "Show")
//
// Design notes:
//   • Selected pill picks its tone from the filter's `tone` field so
//     "Rejected" chips render red-on-red, "Approved" green-on-green
//     etc. Default falls back to primary.
//   • Count badges float on the right of each label — muted when
//     inactive, high-contrast when the pill is selected.
//   • Hover state bumps a subtle background for unselected pills.
//   • Whole bar scrolls horizontally on narrow screens without wrapping
//     the labels so counts and labels stay together.
function StatusFilterBar({ filters = [], value, onChange, label = null }) {
  const theme = useTheme()
  const toneOf = (t) => {
    const p = theme.palette
    switch (t) {
      case 'success': return p.success
      case 'warning': return p.warning
      case 'error':   return p.error
      case 'info':    return p.info
      default:        return p.primary
    }
  }

  return (
    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 2.5 }}>
      {label && (
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: theme.palette.text.disabled,
            flexShrink: 0,
          }}
        >
          {label}
        </Typography>
      )}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          p: 0.5,
          borderRadius: 999,
          bgcolor: alpha(theme.palette.text.primary, 0.04),
          border: 1,
          borderColor: alpha(theme.palette.text.primary, 0.08),
          overflowX: 'auto',
          minHeight: 40,
          // Hide the scrollbar visually while keeping scroll behaviour.
          '&::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
        }}
      >
        {filters.map((f) => {
          const active = f.key === value
          const tone = toneOf(f.tone)
          return (
            <Box
              key={f.key}
              onClick={() => onChange?.(f.key)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange?.(f.key) } }}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.85,
                px: 1.75,
                py: 0.85,
                borderRadius: 999,
                cursor: 'pointer',
                userSelect: 'none',
                whiteSpace: 'nowrap',
                fontSize: 13.5,
                fontWeight: 600,
                transition: 'background 120ms ease, color 120ms ease, box-shadow 120ms ease',
                color: active ? '#fff' : theme.palette.text.secondary,
                bgcolor: active ? tone.main : 'transparent',
                boxShadow: active ? `0 1px 2px ${alpha(tone.main, 0.35)}` : 'none',
                '&:hover': {
                  bgcolor: active ? tone.dark : alpha(theme.palette.text.primary, 0.06),
                  color: active ? '#fff' : theme.palette.text.primary,
                },
                '&:focus-visible': {
                  outline: 2,
                  outlineColor: tone.main,
                  outlineOffset: 2,
                },
              }}
            >
              <span>{f.label}</span>
              {f.count != null && (
                <Badge
                  badgeContent={f.count}
                  showZero
                  color="default"
                  sx={{
                    // Push the count away from the label without a full margin.
                    ml: 0.5,
                    '.MuiBadge-badge': {
                      position: 'relative',
                      transform: 'none',
                      minWidth: 22,
                      height: 20,
                      padding: '0 6px',
                      borderRadius: 12,
                      fontSize: 11.5,
                      fontWeight: 700,
                      bgcolor: active ? alpha('#fff', 0.22) : alpha(theme.palette.text.primary, 0.09),
                      color: active ? '#fff' : theme.palette.text.secondary,
                    },
                  }}
                />
              )}
            </Box>
          )
        })}
      </Box>
    </Stack>
  )
}

export default memo(StatusFilterBar)
