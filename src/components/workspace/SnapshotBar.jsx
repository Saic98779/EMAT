import { memo } from 'react'
import { Box, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'

// SnapshotBar
// ────────────────────────────────────────────────────────────────────────
// Compact strip of 3–4 key/value cells shown directly below the stage
// tracker on every workspace tab. Answers: "who has it, at what stage,
// what's next, how far along."
//
// Cell colouring is derived from an optional `tone` per cell:
//   default | warning | success | primary — maps to theme palette hues.
//
// Props
//   cells [{ label, value, tone? }]  — 1..N cells; layout wraps at 190px min
function SnapshotBar({ cells = [] }) {
  const theme = useTheme()
  if (!cells.length) return null

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1px',
        mt: 2,
        background: alpha(theme.palette.text.primary, 0.08),
        border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        borderRadius: 1.25,
        overflow: 'hidden',
      }}
    >
      {cells.map((cell, i) => (
        <SnapshotCell key={cell.label || i} cell={cell} />
      ))}
    </Box>
  )
}

export default memo(SnapshotBar)

function SnapshotCell({ cell }) {
  const theme = useTheme()
  const color = toneColor(cell.tone, theme)
  return (
    <Box
      sx={{
        flex: '1 1 190px',
        minWidth: 170,
        background: theme.palette.background.paper,
        px: 2,
        py: 1.5,
      }}
    >
      <Typography
        sx={{
          fontSize: 10.5,
          color: theme.palette.text.disabled,
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {cell.label}
      </Typography>
      <Typography
        sx={{
          fontSize: 13.5,
          fontWeight: 600,
          mt: 0.5,
          lineHeight: 1.35,
          color,
          overflowWrap: 'anywhere',
        }}
      >
        {cell.value ?? '—'}
      </Typography>
    </Box>
  )
}

function toneColor(tone, theme) {
  switch (tone) {
    case 'warning': return theme.palette.warning.dark
    case 'success': return theme.palette.success.dark
    case 'primary': return theme.palette.primary.dark
    case 'error':   return theme.palette.error.dark
    default:        return theme.palette.text.primary
  }
}
