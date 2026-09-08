import { memo } from 'react'
import { Box, Stack, Tooltip, Typography } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { alpha, useTheme } from '@mui/material/styles'

// SnapshotBar
// ────────────────────────────────────────────────────────────────────────
// Compact strip below the stage tracker on every workspace tab. Two rows
// share the same rounded container:
//
//   Row 1 — 3–4 key/value cells ("who has it / stage / next / progress")
//   Row 2 — optional supplementary view links (Overview · Documents · Activity)
//
// The supplementary links replace what used to be a separate tab rail —
// stage tabs (Eligibility / Registration / …) are reached from the stage
// tracker above, so the only nav that lives here is for the non-stage
// views. Rendering both rows inside one container keeps them visually
// unified.
//
// Cell colouring is derived from an optional `tone` per cell:
//   default | warning | success | primary — maps to theme palette hues.
//
// Props
//   cells   [{ label, value, tone? }]           — 1..N key/value cells
//   views   [{ key, label, activeKey, onClick }] — optional link row
//   activeViewKey  string  — highlights the current view link
function SnapshotBar({ cells = [], views = [], activeViewKey }) {
  const theme = useTheme()
  if (!cells.length && !views.length) return null

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
      {views.length > 0 && <ViewLinks views={views} activeViewKey={activeViewKey} />}
    </Box>
  )
}

export default memo(SnapshotBar)

function ViewLinks({ views, activeViewKey }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        flex: '1 1 100%',
        background: theme.palette.background.paper,
        px: 2.25,
        py: 1.25,
      }}
    >
      <Stack direction="row" spacing={2.25} alignItems="center" flexWrap="wrap">
        {views.map((v) => {
          const active = v.key === activeViewKey
          const disabled = !!v.disabled
          const btn = (
            <Box
              key={v.key}
              component="button"
              type="button"
              onClick={v.onClick}
              disabled={disabled}
              sx={{
                border: 0,
                background: 'transparent',
                fontFamily: 'inherit',
                cursor: disabled ? 'not-allowed' : 'pointer',
                px: 0,
                py: 0.25,
                fontSize: 12.75,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                color: disabled
                  ? theme.palette.text.disabled
                  : active
                    ? theme.palette.primary.dark
                    : theme.palette.text.secondary,
                fontWeight: active ? 600 : 500,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                '&:hover': !active && !disabled ? { color: theme.palette.primary.dark } : undefined,
              }}
            >
              {v.label}
              {disabled && <LockOutlinedIcon sx={{ fontSize: 12, opacity: 0.7 }} />}
            </Box>
          )
          return disabled && v.disabledReason
            ? (
              <Tooltip key={v.key} title={v.disabledReason} arrow>
                <span style={{ display: 'inline-flex' }}>{btn}</span>
              </Tooltip>
            )
            : btn
        })}
      </Stack>
    </Box>
  )
}

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
