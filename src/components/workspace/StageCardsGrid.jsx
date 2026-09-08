import { memo } from 'react'
import {
  Box, Button, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Typography,
} from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import UndoRoundedIcon from '@mui/icons-material/UndoRounded'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import { alpha, useTheme } from '@mui/material/styles'
import { STATUS } from '../../apis/workflow'
import { DECISION } from '../../apis/stageActions'

// StageCardsGrid
// ────────────────────────────────────────────────────────────────────────
// Workflow visualisation — six top-level stage cards in a row, each
// clickable to expand into a sub-stage detail table (matches the design
// mock). Fully controlled: parent passes the derived workflow and the
// currently-expanded stage key.
//
// Props
//   workflow           Result of deriveWorkflow() — { overall, stages }
//   expandedKey        Currently-expanded stage key (or null)
//   onExpandToggle     (stageKey) => void
//   decisionsForRow    Optional (stage, subStage) => decision[] — reviewer
//                      buttons rendered inline on the sub-stage row.
//   onDecision         Optional (stage, subStage, decision) => void — click.
function StageCardsGrid({
  workflow, expandedKey, onExpandToggle,
  decisionsForRow, onDecision,
}) {
  const { overall, stages } = workflow || { overall: { completed: 0, total: 0, percent: 0 }, stages: [] }

  return (
    <Box sx={{ mt: 2.5 }}>
      <OverallProgress overall={overall} />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(6, 1fr)' },
          gap: 1.5,
        }}
      >
        {stages.map((stage) => (
          <StageCard
            key={stage.key}
            stage={stage}
            expanded={stage.key === expandedKey}
            onToggle={() => onExpandToggle?.(stage.key)}
          />
        ))}
      </Box>

      {expandedKey && (
        <StageExpandedPanel
          stage={stages.find((s) => s.key === expandedKey)}
          onCollapse={() => onExpandToggle?.(null)}
          decisionsForRow={decisionsForRow}
          onDecision={onDecision}
        />
      )}
    </Box>
  )
}

export default memo(StageCardsGrid)

// ── Overall progress strip ─────────────────────────────────────────────

function OverallProgress({ overall }) {
  const theme = useTheme()
  const { completed, total, percent } = overall
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={2}
      sx={{
        mb: 2,
        px: 2.25,
        py: 1.5,
        borderRadius: 2,
        border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        background: '#fff',
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="overline"
          sx={{ fontSize: 11, letterSpacing: '0.05em', color: theme.palette.text.disabled, fontWeight: 600 }}
        >
          Overall Progress
        </Typography>
        <Typography sx={{ fontSize: 14, fontWeight: 500, color: theme.palette.text.secondary }}>
          <Box component="span" sx={{ color: 'text.primary', fontWeight: 700, fontSize: 15 }}>
            {completed} / {total}
          </Box>{' '}
          steps completed
        </Typography>
      </Box>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: { md: 260 } }}>
        <Box
          sx={{
            flex: 1,
            height: 6,
            borderRadius: 3,
            background: alpha(theme.palette.text.primary, 0.09),
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              width: `${percent}%`,
              height: '100%',
              background: theme.palette.success.main,
              transition: 'width 240ms ease',
            }}
          />
        </Box>
        <Typography sx={{ fontSize: 14, fontWeight: 700, minWidth: 40, textAlign: 'right' }}>
          {percent}%
        </Typography>
      </Stack>
    </Stack>
  )
}

// ── Individual stage card ──────────────────────────────────────────────

function StageCard({ stage, expanded, onToggle }) {
  const theme = useTheme()
  const visuals = statusVisuals(stage.status, theme)

  return (
    <Box
      component="button"
      type="button"
      onClick={onToggle}
      sx={{
        position: 'relative',
        textAlign: 'left',
        fontFamily: 'inherit',
        border: `${expanded ? 2 : 1}px solid ${expanded ? theme.palette.warning.main : alpha(theme.palette.text.primary, 0.1)}`,
        borderRadius: 2,
        background: '#fff',
        cursor: 'pointer',
        px: 2,
        py: 1.75,
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
        '&:hover': !expanded ? { borderColor: alpha(theme.palette.text.primary, 0.24) } : undefined,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            flexShrink: 0,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            fontSize: 13,
            fontWeight: 700,
            background: visuals.iconBg,
            color: visuals.iconColor,
            border: visuals.iconBorder,
          }}
        >
          {visuals.icon}
        </Box>
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 700,
            color: theme.palette.text.disabled,
            letterSpacing: '0.04em',
          }}
        >
          {stageIndexLabel(stage.key)}
        </Typography>
      </Stack>

      <Typography
        sx={{
          fontSize: 13.5,
          fontWeight: 600,
          lineHeight: 1.3,
          color: theme.palette.text.primary,
          minHeight: 34,
          mb: 1,
          textWrap: 'pretty',
        }}
      >
        {stage.label}
      </Typography>

      <StatusChip status={stage.status} />

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1 }}>
        <Typography sx={{ fontSize: 12, color: theme.palette.text.disabled, fontWeight: 500 }}>
          {stage.progress.completed}/{stage.progress.total}
        </Typography>
        <ExpandMoreRoundedIcon
          sx={{
            fontSize: 20,
            color: theme.palette.text.disabled,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
          }}
        />
      </Stack>
    </Box>
  )
}

// ── Expanded sub-stage table ───────────────────────────────────────────

function StageExpandedPanel({ stage, onCollapse, decisionsForRow, onDecision }) {
  const theme = useTheme()
  if (!stage) return null
  const visuals = statusVisuals(stage.status, theme)

  return (
    <Box
      sx={{
        mt: 2,
        borderRadius: 2,
        border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={2}
        sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: alpha(theme.palette.text.primary, 0.09) }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            flexShrink: 0,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            fontSize: 13,
            fontWeight: 700,
            background: visuals.iconBg,
            color: visuals.iconColor,
            border: visuals.iconBorder,
          }}
        >
          {visuals.icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{stage.label}</Typography>
            <StatusChip status={stage.status} />
          </Stack>
          {stage.comment && (
            <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary, mt: 0.5 }}>
              {stage.comment}
            </Typography>
          )}
        </Box>
        <Button
          size="small"
          variant="text"
          onClick={onCollapse}
          startIcon={<ExpandMoreRoundedIcon sx={{ transform: 'rotate(180deg)' }} />}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            color: theme.palette.text.secondary,
          }}
        >
          Hide
        </Button>
      </Stack>

      <SubStageTable
        subStages={stage.subStages}
        stage={stage}
        decisionsForRow={decisionsForRow}
        onDecision={onDecision}
      />
    </Box>
  )
}

function SubStageTable({ subStages, stage, decisionsForRow, onDecision }) {
  const theme = useTheme()
  return (
    <Table
      size="small"
      sx={{ width: '100%', tableLayout: 'fixed', '& td, & th': { border: 0 } }}
    >
      <TableHead>
        <TableRow sx={{ background: alpha(theme.palette.text.primary, 0.02) }}>
          <TableCellHead sx={{ width: 56 }}>#</TableCellHead>
          <TableCellHead sx={{ width: '32%' }}>Sub Status</TableCellHead>
          <TableCellHead sx={{ width: 140 }}>Status</TableCellHead>
          <TableCellHead sx={{ width: 160 }}>Completed On</TableCellHead>
          <TableCellHead>Remarks</TableCellHead>
        </TableRow>
      </TableHead>
      <TableBody>
        {subStages.map((sub) => (
          <SubStageRow
            key={`${stage.key}-${sub.index}`}
            stage={stage}
            sub={sub}
            decisions={typeof decisionsForRow === 'function' ? decisionsForRow(stage, sub) : []}
            onDecision={onDecision}
          />
        ))}
      </TableBody>
    </Table>
  )
}

function SubStageRow({ stage, sub, decisions = [], onDecision }) {
  const theme = useTheme()
  const visuals = statusVisuals(sub.status, theme)
  const idxLabel = `${stageOrdinal(stage.key)}.${sub.index}`

  // Reviewer decisions still surface — inline below the row's remarks —
  // because they're not "View" actions; they're the actual approve/reject
  // controls for the sub-stage. Only render on the in-flight row.
  const hasDecisions = decisions.length > 0 && sub.status === STATUS.IN_PROGRESS

  return (
    <TableRow
      sx={{
        borderBottom: 1,
        borderColor: alpha(theme.palette.text.primary, 0.06),
        '&:last-of-type': { borderBottom: 0 },
      }}
    >
      <TableCell sx={{ color: theme.palette.text.disabled, fontSize: 13, verticalAlign: 'top' }}>{idxLabel}</TableCell>
      <TableCell sx={{ verticalAlign: 'top' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box
            sx={{
              width: 20,
              height: 20,
              flexShrink: 0,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              background: visuals.iconBg,
              color: visuals.iconColor,
              border: visuals.iconBorder,
              fontSize: 12,
            }}
          >
            {visuals.icon}
          </Box>
          <Typography sx={{ fontSize: 13.5 }}>{sub.label}</Typography>
        </Stack>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top' }}><StatusChip status={sub.status} /></TableCell>
      <TableCell sx={{ fontSize: 13, color: theme.palette.text.secondary, verticalAlign: 'top' }}>{formatDate(sub.completedOn) || '—'}</TableCell>
      <TableCell sx={{ fontSize: 13, color: theme.palette.text.secondary, verticalAlign: 'top' }}>
        {sub.remarks || '—'}
        {hasDecisions && (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
            {decisions.map((d) => (
              <Button
                key={d.kind + d.to}
                size="small"
                variant={d.kind === DECISION.APPROVE ? 'contained' : 'outlined'}
                disableElevation
                onClick={() => onDecision?.(stage, sub, d)}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  ...decisionButtonSx(d.kind, theme),
                }}
              >
                {d.label}
              </Button>
            ))}
          </Stack>
        )}
      </TableCell>
    </TableRow>
  )
}

// ── Status chip + visuals ──────────────────────────────────────────────

function StatusChip({ status }) {
  const theme = useTheme()
  const { chipBg, chipFg, dot, label } = chipVisuals(status, theme)
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        py: 0.375,
        borderRadius: 1,
        background: chipBg,
        color: chipFg,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />
      {label}
    </Box>
  )
}

function statusVisuals(status, theme) {
  const neutralBorder = `1.5px solid ${alpha(theme.palette.text.primary, 0.18)}`
  switch (status) {
    case STATUS.COMPLETED:
      return {
        icon: <CheckCircleRoundedIcon sx={{ fontSize: 20 }} />,
        iconBg: 'transparent',
        iconColor: theme.palette.success.main,
        iconBorder: 'none',
      }
    case STATUS.IN_PROGRESS:
      return {
        icon: <PriorityHighRoundedIcon sx={{ fontSize: 18 }} />,
        iconBg: '#fff',
        iconColor: theme.palette.warning.main,
        iconBorder: `1.5px solid ${theme.palette.warning.main}`,
      }
    case STATUS.REVERTED:
      return {
        icon: <UndoRoundedIcon sx={{ fontSize: 18 }} />,
        iconBg: '#fff',
        iconColor: theme.palette.warning.dark,
        iconBorder: `1.5px solid ${theme.palette.warning.dark}`,
      }
    case STATUS.REJECTED:
      return {
        icon: <BlockRoundedIcon sx={{ fontSize: 18 }} />,
        iconBg: '#fff',
        iconColor: theme.palette.error.main,
        iconBorder: `1.5px solid ${theme.palette.error.main}`,
      }
    default:
      return {
        icon: <LockOutlinedIcon sx={{ fontSize: 16 }} />,
        iconBg: '#fff',
        iconColor: theme.palette.text.disabled,
        iconBorder: neutralBorder,
      }
  }
}

function chipVisuals(status, theme) {
  switch (status) {
    case STATUS.COMPLETED:
      return {
        label: 'Completed',
        chipBg: alpha(theme.palette.success.main, 0.12),
        chipFg: theme.palette.success.dark,
        dot: theme.palette.success.main,
      }
    case STATUS.IN_PROGRESS:
      return {
        label: 'In Progress',
        chipBg: alpha(theme.palette.warning.main, 0.14),
        chipFg: theme.palette.warning.dark,
        dot: theme.palette.warning.main,
      }
    case STATUS.REVERTED:
      return {
        label: 'Reverted',
        chipBg: alpha(theme.palette.warning.dark, 0.14),
        chipFg: theme.palette.warning.dark,
        dot: theme.palette.warning.dark,
      }
    case STATUS.REJECTED:
      return {
        label: 'Rejected',
        chipBg: alpha(theme.palette.error.main, 0.12),
        chipFg: theme.palette.error.dark,
        dot: theme.palette.error.main,
      }
    default:
      return {
        label: 'Not Started',
        chipBg: alpha(theme.palette.text.primary, 0.06),
        chipFg: theme.palette.text.disabled,
        dot: alpha(theme.palette.text.primary, 0.28),
      }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function TableCellHead({ children, sx }) {
  const theme = useTheme()
  return (
    <TableCell
      sx={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: theme.palette.text.disabled,
        py: 1.25,
        px: 2,
        ...sx,
      }}
    >
      {children}
    </TableCell>
  )
}

// Colour palette for the inline decision buttons on sub-stage rows.
// Reject/Revert use outlined variants coloured by tone; Approve stays
// primary-green so the callout draws the eye.
function decisionButtonSx(kind, theme) {
  switch (kind) {
    case DECISION.APPROVE:
      return {
        background: theme.palette.success.main,
        color: '#fff',
        '&:hover': { background: theme.palette.success.dark },
      }
    case DECISION.REJECT:
      return {
        color: theme.palette.error.dark,
        borderColor: alpha(theme.palette.error.main, 0.4),
        '&:hover': { borderColor: theme.palette.error.main, background: alpha(theme.palette.error.main, 0.05) },
      }
    case DECISION.REVERT:
      return {
        color: theme.palette.warning.dark,
        borderColor: alpha(theme.palette.warning.main, 0.4),
        '&:hover': { borderColor: theme.palette.warning.main, background: alpha(theme.palette.warning.main, 0.05) },
      }
    default:
      return {
        color: theme.palette.primary.dark,
        borderColor: alpha(theme.palette.primary.main, 0.4),
      }
  }
}

function formatDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// The mock indexes cards 1..6 and sub-stages 2.1, 2.2… — surface the
// ordinal so both the card badge and the sub-stage row use the same number.
const ORDINALS = {
  ELIGIBILITY_MATRIX: 1,
  IN_PRINCIPLE_APPROVAL_OF_IA: 2,
  SUSTAINABILITY_MATRIX: 3,
  ACTION_PLAN: 4,
  DETAILED_APPRAISAL: 5,
  DOCUMENTATION_OF_IA: 6,
}

function stageOrdinal(stageKey) {
  return ORDINALS[stageKey] ?? '?'
}

function stageIndexLabel(stageKey) {
  return `STAGE ${stageOrdinal(stageKey)}`
}


