import { memo, useCallback } from 'react'
import { Box, Collapse, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import { alpha, useTheme } from '@mui/material/styles'

// ParameterGroup
// ────────────────────────────────────────────────────────────────────────
// One dimension of the Eligibility Matrix — a collapsible section with a
// header (name · count · unanswered badge) and a list of Yes/No rows
// with hover tooltips. Fully controlled: the parent owns the expanded
// map and the answers map.
//
// Props
//   title       Dimension title
//   params      [{ key, label, reason?, guide? }]
//   answers     Map of paramKey → true | false | null
//   expanded    Boolean — is this group open
//   onToggle    () => void
//   onAnswer    (paramKey, nextValue) => void   nextValue is true | false | null
function ParameterGroup({ title, params, answers, expanded, onToggle, onAnswer }) {
  const theme = useTheme()
  const unanswered = params.filter((p) => answers[p.key] !== true && answers[p.key] !== false).length

  return (
    <Box sx={{ mt: 3 }}>
      <Box
        component="button"
        type="button"
        onClick={onToggle}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          width: '100%',
          border: 0,
          background: 'transparent',
          fontFamily: 'inherit',
          padding: '0 0 10px',
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
            transform: expanded ? 'none' : 'rotate(-90deg)',
            transition: 'transform 150ms ease',
          }}
        />
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{title}</Typography>
        <Typography sx={{ fontSize: 12, color: theme.palette.text.disabled }}>
          {params.length} parameters
        </Typography>
        <Box sx={{ flex: 1 }} />
        {unanswered > 0 && (
          <Box
            sx={{
              fontSize: 11.5,
              fontWeight: 600,
              color: theme.palette.warning.dark,
              background: theme.palette.warning.light,
              px: 1,
              py: 0.375,
              borderRadius: 0.75,
            }}
          >
            {unanswered} unanswered
          </Box>
        )}
      </Box>

      <Collapse in={expanded} unmountOnExit>
        <Stack>
          {params.map((param) => (
            <ParameterRow
              key={param.key}
              param={param}
              value={answers[param.key]}
              onAnswer={onAnswer}
            />
          ))}
        </Stack>
      </Collapse>
    </Box>
  )
}

export default memo(ParameterGroup)

function ParameterRow({ param, value, onAnswer }) {
  const theme = useTheme()

  const toggle = useCallback(
    (next) => () => {
      // Second click on the current answer clears it — matches design's
      // "cleared" behaviour so users can undo without touching the other.
      onAnswer(param.key, value === next ? null : next)
    },
    [param.key, value, onAnswer],
  )

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
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13.5, textWrap: 'pretty' }}>{param.label}</Typography>
        {(param.reason || param.guide) && (
          <Tooltip title={param.reason || param.guide} arrow placement="top">
            <IconButton size="small" tabIndex={-1} sx={{ p: 0.25, color: theme.palette.text.disabled, cursor: 'help' }}>
              <HelpOutlineIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      <Stack
        direction="row"
        sx={{
          flexShrink: 0,
          border: 1,
          borderColor: alpha(theme.palette.text.primary, 0.14),
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <ToggleChip
          selected={value === true}
          tone="yes"
          onClick={toggle(true)}
          label="Yes"
        />
        <ToggleChip
          selected={value === false}
          tone="no"
          onClick={toggle(false)}
          label="No"
        />
      </Stack>
    </Stack>
  )
}

function ToggleChip({ selected, tone, onClick, label }) {
  const theme = useTheme()
  const activeBg = tone === 'yes' ? theme.palette.success.main : theme.palette.error.main
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        border: 0,
        px: 2,
        py: 0.875,
        fontFamily: 'inherit',
        fontSize: 12.75,
        fontWeight: 600,
        cursor: 'pointer',
        background: selected ? activeBg : theme.palette.background.paper,
        color: selected ? '#fff' : theme.palette.text.disabled,
        transition: 'background 120ms ease, color 120ms ease',
        '&:hover': selected ? {} : { background: alpha(theme.palette.text.primary, 0.04) },
      }}
    >
      {label}
    </Box>
  )
}
