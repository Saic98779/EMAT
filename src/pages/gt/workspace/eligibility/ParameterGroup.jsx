import { memo, useCallback, useRef } from 'react'
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
function ParameterGroup({ title, params, answers, expanded, onToggle, onAnswer, readOnly = false }) {
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
              readOnly={readOnly}
            />
          ))}
        </Stack>
      </Collapse>
    </Box>
  )
}

export default memo(ParameterGroup)

const ParameterRow = memo(function ParameterRow({ param, value, onAnswer, readOnly = false }) {
  const theme = useTheme()

  // Hold the latest value in a ref so the click handlers stay referentially
  // stable across value changes — otherwise every answer toggle would
  // invalidate ToggleChip's memoisation and force 44 re-renders per click.
  const valueRef = useRef(value)
  valueRef.current = value

  const handleYes = useCallback(() => {
    if (readOnly) return
    onAnswer(param.key, valueRef.current === true ? null : true)
  }, [param.key, onAnswer, readOnly])

  const handleNo = useCallback(() => {
    if (readOnly) return
    onAnswer(param.key, valueRef.current === false ? null : false)
  }, [param.key, onAnswer, readOnly])

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
          onClick={handleYes}
          label="Yes"
          readOnly={readOnly}
        />
        <ToggleChip
          selected={value === false}
          tone="no"
          onClick={handleNo}
          label="No"
          readOnly={readOnly}
        />
      </Stack>
    </Stack>
  )
})

const ToggleChip = memo(function ToggleChip({ selected, tone, onClick, label, readOnly = false }) {
  const theme = useTheme()
  const activeBg = tone === 'yes' ? theme.palette.success.main : theme.palette.error.main
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      disabled={readOnly}
      sx={{
        border: 0,
        px: 2,
        py: 0.875,
        fontFamily: 'inherit',
        fontSize: 12.75,
        fontWeight: 600,
        cursor: readOnly ? 'default' : 'pointer',
        background: selected ? activeBg : theme.palette.background.paper,
        color: selected ? '#fff' : theme.palette.text.disabled,
        transition: 'background 120ms ease, color 120ms ease',
        opacity: readOnly && !selected ? 0.5 : 1,
        '&:hover': (selected || readOnly) ? {} : { background: alpha(theme.palette.text.primary, 0.04) },
      }}
    >
      {label}
    </Box>
  )
})
