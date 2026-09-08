import { memo } from 'react'
import { Box, CircularProgress, Stack, Typography } from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import UndoRoundedIcon from '@mui/icons-material/UndoRounded'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded'
import { alpha, useTheme } from '@mui/material/styles'
import { useStageHistory } from '../../../queries'
import { useIaWorkspace } from '../../../components/workspace/IaWorkspaceLayout'
import { STAGE_LABELS } from '../../../apis/registrationStages'

// ActivityTab
// ────────────────────────────────────────────────────────────────────────
// The IA's full audit trail — every stage / sub-stage transition in
// reverse chronological order (most recent first). Data comes from
// `/industry-association-registrations/{id}/stage-history`; each row
// shows who moved the record + when + any comment they left.
//
// Empty state (brand-new IA) surfaces a friendly note. Loading state
// mirrors the workspace's own spinner treatment.
export default function ActivityTab() {
  const ws = useIaWorkspace()
  const historyQ = useStageHistory(ws.iaId)

  if (ws.isNew) {
    return <EmptyState line="Activity kicks in once you submit the Eligibility Matrix." />
  }
  if (historyQ.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={22} />
      </Box>
    )
  }
  const rows = Array.isArray(historyQ.data) ? [...historyQ.data] : []
  if (!rows.length) return <EmptyState line="No activity recorded on this IA yet." />

  // Backend returns ascending time — flip for a most-recent-first read.
  rows.sort((a, b) => (b.time || '').localeCompare(a.time || ''))

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Typography sx={{ fontSize: 15.5, fontWeight: 700, mb: 2 }}>Activity</Typography>
      <Stack spacing={0}>
        {rows.map((row, i) => (
          <TimelineRow
            key={row.id ?? `${row.subStage}-${row.time}`}
            row={row}
            isFirst={i === 0}
            isLast={i === rows.length - 1}
          />
        ))}
      </Stack>
    </Box>
  )
}

// ── Row ────────────────────────────────────────────────────────────────

const TimelineRow = memo(function TimelineRow({ row, isFirst, isLast }) {
  const theme = useTheme()
  const kind = classifyEvent(row.subStage)
  const iconVisuals = eventVisuals(kind, theme)

  return (
    <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ position: 'relative' }}>
      {/* Left rail: dot + connector line */}
      <Box sx={{ position: 'relative', width: 32, flexShrink: 0, alignSelf: 'stretch' }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: iconVisuals.bg,
            color: iconVisuals.fg,
            border: iconVisuals.border,
            zIndex: 1,
            position: 'relative',
          }}
        >
          {iconVisuals.icon}
        </Box>
        {!isLast && (
          <Box
            sx={{
              position: 'absolute',
              left: 15,
              top: 32,
              bottom: -12,
              width: 2,
              background: alpha(theme.palette.text.primary, 0.09),
            }}
          />
        )}
      </Box>

      {/* Right content */}
      <Box sx={{ flex: 1, minWidth: 0, pb: isLast ? 0 : 4, pt: isFirst ? 0 : 0.5 }}>
        <Stack direction="row" alignItems="baseline" spacing={1} flexWrap="wrap">
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: theme.palette.text.primary }}>
            {STAGE_LABELS[row.stage] || row.stage}
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: theme.palette.text.disabled }}>
            {humaniseSubStage(row.subStage)}
          </Typography>
        </Stack>
        <Typography sx={{ fontSize: 12.75, color: theme.palette.text.secondary, mt: 0.25 }}>
          {row.createdBy || 'System'} · {formatDateTime(row.time)}
        </Typography>
        {row.comment && (
          <Box
            sx={{
              mt: 1,
              px: 1.5,
              py: 1,
              borderRadius: 1,
              background: alpha(theme.palette.text.primary, 0.04),
              fontSize: 13,
              color: theme.palette.text.secondary,
            }}
          >
            {row.comment}
          </Box>
        )}
      </Box>
    </Stack>
  )
})

// ── Empty state ────────────────────────────────────────────────────────

function EmptyState({ line }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        maxWidth: 520,
        mx: 'auto',
        mt: 4,
        p: 4,
        border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        borderRadius: 2,
        background: '#fff',
        textAlign: 'center',
      }}
    >
      <Typography sx={{ fontSize: 14, color: theme.palette.text.secondary }}>{line}</Typography>
    </Box>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────

// Classify a sub-stage into an event kind so the row's icon + colour
// visually match its outcome. Names come from the raw backend enum.
function classifyEvent(subStage) {
  const s = String(subStage || '').toUpperCase()
  if (s.includes('REJECTED')) return 'rejected'
  if (s.includes('REVERTED')) return 'reverted'
  if (s.includes('APPROVAL') || s.includes('APPROVED')) return 'approved'
  return 'submitted'
}

function eventVisuals(kind, theme) {
  switch (kind) {
    case 'approved':
      return {
        icon: <CheckCircleRoundedIcon sx={{ fontSize: 18 }} />,
        bg: alpha(theme.palette.success.main, 0.15),
        fg: theme.palette.success.dark,
        border: 'none',
      }
    case 'reverted':
      return {
        icon: <UndoRoundedIcon sx={{ fontSize: 18 }} />,
        bg: alpha(theme.palette.warning.main, 0.15),
        fg: theme.palette.warning.dark,
        border: 'none',
      }
    case 'rejected':
      return {
        icon: <BlockRoundedIcon sx={{ fontSize: 18 }} />,
        bg: alpha(theme.palette.error.main, 0.15),
        fg: theme.palette.error.dark,
        border: 'none',
      }
    default:
      return {
        icon: <AssignmentTurnedInRoundedIcon sx={{ fontSize: 18 }} />,
        bg: alpha(theme.palette.primary.main, 0.14),
        fg: theme.palette.primary.dark,
        border: 'none',
      }
  }
}

// Turn the enum string into a human-friendly sub-stage name.
// E.g. IN_PRINCIPLE_APPROVAL_OF_IA_SUBMITTED → "Submitted".
function humaniseSubStage(subStage) {
  if (!subStage) return ''
  const s = String(subStage)
  const trailing = ['SUBMITTED', 'SDE_APPROVAL', 'SDE_REJECTED', 'SDE_REVERTED',
    'CLUSTER_EXPERT_APPROVED', 'CLUSTER_EXPERT_REVERTED', 'APPROVAL_BY_SDE',
    'REJECTED_BY_SDE', 'REVERTED_BY_SDE', 'CE_COMMENTS_SUBMITTED',
    'APPROVAL_BY_HO_MAKER', 'REJECTED_BY_HO_MAKER', 'REVERTED_BY_HO_MAKER',
    'SUBMITTED_BY_PANEL']
  const found = trailing.find((t) => s.endsWith('_' + t) || s === t)
  const bare = found || s.split('_').slice(-2).join(' ')
  return bare
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}
