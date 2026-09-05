import { memo } from 'react'
import { Box, Stack, Tooltip, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import { alpha, useTheme } from '@mui/material/styles'
import { STAGES, STAGE_STATE } from './workspaceConfig'

// StageTracker
// ────────────────────────────────────────────────────────────────────────
// Horizontal 7-step progress bar shown on every IA workspace tab.
// Steps are visually differentiated by state:
//   done    — green circle + check
//   current — filled ring in primary blue (in-progress on this stage)
//   action  — filled ring in warning amber (needs viewer's action)
//   locked  — hollow gray circle (not reached yet)
// Clicking a step invokes `onStageClick(stage)` when unlocked; ignored
// otherwise. Meant to be a controlled, presentational component.
//
// Props
//   states       Map of stage key → STAGE_STATE.* value (from workspaceConfig)
//   meta         Optional map of stage key → small caption ("Score 72" etc.)
//   onStageClick (stage) => void — invoked when a non-locked step is clicked
function StageTracker({ states = {}, meta = {}, onStageClick }) {
  const theme = useTheme()

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        py: 1.75,
        borderTop: 1,
        borderBottom: 1,
        borderColor: alpha(theme.palette.text.primary, 0.08),
        overflowX: 'auto',
      }}
    >
      <Stack direction="row" alignItems="center" sx={{ minWidth: 'max-content', width: '100%' }}>
        {STAGES.map((stage, idx) => {
          const state = states[stage.key] || STAGE_STATE.LOCKED
          const isLast = idx === STAGES.length - 1
          const clickable = state !== STAGE_STATE.LOCKED && typeof onStageClick === 'function'

          return (
            <Stack
              key={stage.key}
              direction="row"
              alignItems="center"
              sx={{ flex: '1 1 auto' }}
            >
              <StageNode
                stage={stage}
                state={state}
                caption={meta[stage.key]}
                clickable={clickable}
                onClick={clickable ? () => onStageClick(stage) : undefined}
              />
              {!isLast && <StageConnector done={state === STAGE_STATE.DONE} />}
            </Stack>
          )
        })}
      </Stack>
    </Box>
  )
}

export default memo(StageTracker)

// ── Internals ────────────────────────────────────────────────────────────

function StageNode({ stage, state, caption, clickable, onClick }) {
  const theme = useTheme()
  const { dotBg, dotBorder, dotColor, labelColor, labelWeight, captionColor } = nodeColors(state, theme)

  const tip = `${stage.label}${caption ? ` — ${caption}` : ''}${
    state === STAGE_STATE.LOCKED ? ' · not reached yet' : ''
  }`

  return (
    <Tooltip title={tip} arrow placement="top">
      <Box
        component={clickable ? 'button' : 'div'}
        onClick={onClick}
        type={clickable ? 'button' : undefined}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          border: 0,
          background: 'transparent',
          borderRadius: 1,
          px: 0.75,
          py: 0.5,
          mx: -0.75,
          cursor: clickable ? 'pointer' : 'default',
          fontFamily: 'inherit',
          textAlign: 'left',
          '&:hover': clickable ? { background: alpha(theme.palette.primary.main, 0.06) } : undefined,
        }}
      >
        <Box
          sx={{
            width: 22,
            height: 22,
            flexShrink: 0,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            fontSize: 12,
            fontWeight: 700,
            background: dotBg,
            border: `${dotBorder.width}px solid ${dotBorder.color}`,
            color: dotColor,
            boxShadow:
              state === STAGE_STATE.CURRENT || state === STAGE_STATE.ACTION
                ? `0 0 0 3px ${alpha(dotBorder.color, 0.14)}`
                : 'none',
          }}
        >
          {state === STAGE_STATE.DONE ? <CheckIcon sx={{ fontSize: 14 }} /> : null}
        </Box>

        <Box sx={{ lineHeight: 1.2, whiteSpace: 'nowrap' }}>
          <Typography
            component="span"
            sx={{
              display: 'block',
              fontSize: 13,
              color: labelColor,
              fontWeight: labelWeight,
            }}
          >
            {stage.label}
          </Typography>
          {caption && (state === STAGE_STATE.CURRENT || state === STAGE_STATE.ACTION) && (
            <Typography
              component="span"
              sx={{
                display: 'block',
                fontSize: 11,
                color: captionColor,
                opacity: 0.85,
                mt: 0.25,
              }}
            >
              {caption}
            </Typography>
          )}
        </Box>
      </Box>
    </Tooltip>
  )
}

function StageConnector({ done }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        flex: '1 1 auto',
        minWidth: 10,
        height: 1,
        mx: 1.5,
        background: done ? theme.palette.success.light : alpha(theme.palette.text.primary, 0.11),
      }}
    />
  )
}

function nodeColors(state, theme) {
  const neutral = alpha(theme.palette.text.primary, 0.16)
  switch (state) {
    case STAGE_STATE.DONE:
      return {
        dotBg: theme.palette.success.main,
        dotBorder: { width: 0, color: theme.palette.success.main },
        dotColor: '#fff',
        labelColor: theme.palette.text.secondary,
        labelWeight: 500,
        captionColor: theme.palette.success.dark,
      }
    case STAGE_STATE.CURRENT:
      return {
        dotBg: '#fff',
        dotBorder: { width: 2, color: theme.palette.primary.main },
        dotColor: theme.palette.primary.main,
        labelColor: theme.palette.primary.dark,
        labelWeight: 600,
        captionColor: theme.palette.primary.dark,
      }
    case STAGE_STATE.ACTION:
      return {
        dotBg: '#fff',
        dotBorder: { width: 2, color: theme.palette.warning.main },
        dotColor: theme.palette.warning.main,
        labelColor: theme.palette.warning.dark,
        labelWeight: 600,
        captionColor: theme.palette.warning.dark,
      }
    default:
      return {
        dotBg: '#fff',
        dotBorder: { width: 1.5, color: neutral },
        dotColor: 'transparent',
        labelColor: theme.palette.text.disabled,
        labelWeight: 400,
        captionColor: theme.palette.text.disabled,
      }
  }
}
