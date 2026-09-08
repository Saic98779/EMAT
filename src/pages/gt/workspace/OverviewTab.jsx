import { useMemo } from 'react'
import { Box, Button, Stack, Typography } from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import { alpha, useTheme } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'
import { useIaWorkspace } from '../../../components/workspace/IaWorkspaceLayout'
import { useStageHistory } from '../../../queries'
import { STATUS } from '../../../apis/workflow'
import { STAGE, STAGE_LABELS } from '../../../apis/registrationStages'

// OverviewTab
// ────────────────────────────────────────────────────────────────────────
// The IA's landing card view — three panels stacked on the left, IA
// identity on the right. Consumes the workspace context so it doesn't
// re-fetch what the layout already loaded.
export default function OverviewTab() {
  const ws = useIaWorkspace()
  const navigate = useNavigate()
  const historyQ = useStageHistory(ws.iaId)

  const activeStage = useMemo(
    () => ws.workflow?.stages.find(
      (s) => s.status === STATUS.IN_PROGRESS || s.status === STATUS.REVERTED,
    ) || null,
    [ws.workflow],
  )

  const recentHistory = useMemo(() => {
    const rows = Array.isArray(historyQ.data) ? [...historyQ.data] : []
    rows.sort((a, b) => (b.time || '').localeCompare(a.time || ''))
    return rows.slice(0, 5)
  }, [historyQ.data])

  const goActivity = () => {
    if (!ws.iaId) return
    navigate(`${ws.basePath || '/gt'}/ias/${ws.iaId}/workspace/activity`)
  }

  // "Your turn" CTA — when the current viewer has a decision to make at
  // the live sub-stage, surface a bold banner that routes straight to the
  // tab that owns that stage. Otherwise the reviewer has to guess where
  // to click. `decisionsForCurrent` is set by IaWorkspaceLayout.
  const yourTurn = useMemo(() => {
    if (ws.isNew) return null
    const decisions = ws.decisionsForCurrent || []
    if (!decisions.length) return null
    const stage = ws.workflow?.stages?.find(
      (s) => s.status === STATUS.IN_PROGRESS,
    )
    if (!stage) return null
    return { stage, decisionsCount: decisions.length }
  }, [ws.isNew, ws.decisionsForCurrent, ws.workflow])

  const openStageTab = (stageKey) => {
    const tab = STAGE_TO_TAB[stageKey]
    if (!tab || !ws.iaId) return
    navigate(`${ws.basePath || '/gt'}/ias/${ws.iaId}/workspace/${tab}`)
  }

  if (ws.isNew) {
    return (
      <NoticeCard
        title="This IA is a draft"
        body="Head to the Eligibility Matrix tab to score the association and start the workflow."
      />
    )
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 320px' },
        gap: 3,
        alignItems: 'flex-start',
      }}
    >
      <Stack spacing={2.5}>
        {yourTurn && (
          <YourTurnCard
            stage={yourTurn.stage}
            role={ws.viewerRole}
            onOpen={() => openStageTab(yourTurn.stage.key)}
          />
        )}
        {activeStage && <CurrentStageCard stage={activeStage} onOpen={goActivity} />}
        <RecentActivityCard rows={recentHistory} onSeeAll={goActivity} />
      </Stack>
      <IdentityCard ia={ws.ia} />
    </Box>
  )
}

const STAGE_TO_TAB = {
  [STAGE.ELIGIBILITY_MATRIX]:          'eligibility',
  [STAGE.IN_PRINCIPLE_APPROVAL_OF_IA]: 'l1',
  [STAGE.SUSTAINABILITY_MATRIX]:       'sustainability',
  [STAGE.ACTION_PLAN]:                 'appraisal',
  [STAGE.DETAILED_APPRAISAL]:          'appraisal',
  [STAGE.DOCUMENTATION_OF_IA]:         'documents',
}

function YourTurnCard({ stage, role, onOpen }) {
  const theme = useTheme()
  const tone = theme.palette.warning
  return (
    <Box
      sx={{
        p: { xs: 2.5, md: 3 },
        borderRadius: 2,
        border: 1,
        borderColor: alpha(tone.main, 0.45),
        background: alpha(tone.main, 0.08),
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { sm: 'center' },
        gap: 2,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: tone.dark }}>
          Your turn
        </Typography>
        <Typography sx={{ mt: 0.5, fontSize: 20, fontWeight: 800, letterSpacing: '-0.015em', color: theme.palette.text.primary }}>
          {roleLabel(role)} decision on {stage.label}
        </Typography>
        <Typography sx={{ mt: 0.5, fontSize: 13.5, color: theme.palette.text.secondary }}>
          Open the {stage.label} tab to review the submission and record your decision.
        </Typography>
      </Box>
      <Button
        variant="contained"
        color="warning"
        disableElevation
        endIcon={<ArrowForwardRoundedIcon />}
        onClick={onOpen}
        sx={{ textTransform: 'none', fontWeight: 700, flexShrink: 0 }}
      >
        Review now
      </Button>
    </Box>
  )
}

function roleLabel(role) {
  switch (role) {
    case 'SIDBI_SDE':      return 'SDE'
    case 'CLUSTER_EXPERT': return 'Cluster Expert'
    case 'SIDBI_HO_MAKER': return 'HO Maker'
    default:               return 'Reviewer'
  }
}

// ── Cards ──────────────────────────────────────────────────────────────

function CurrentStageCard({ stage, onOpen }) {
  const theme = useTheme()
  const tone = stage.status === STATUS.REVERTED ? theme.palette.warning : theme.palette.primary
  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: 2,
        border: 1,
        borderColor: alpha(tone.main, 0.35),
        background: alpha(tone.main, 0.04),
      }}
    >
      <Typography
        variant="overline"
        sx={{ fontSize: 11, letterSpacing: '0.05em', color: tone.dark, fontWeight: 700 }}
      >
        Current stage
      </Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 700, mt: 0.25 }}>{stage.label}</Typography>
      {stage.comment && (
        <Typography sx={{ fontSize: 13.5, color: theme.palette.text.secondary, mt: 1 }}>
          {stage.comment}
        </Typography>
      )}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 1.5 }}>
        <Typography sx={{ fontSize: 12.5, color: theme.palette.text.disabled }}>
          {stage.progress.completed} of {stage.progress.total} sub-stages complete
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" endIcon={<ArrowForwardRoundedIcon />} onClick={onOpen} sx={{ fontWeight: 600 }}>
          View activity
        </Button>
      </Stack>
    </Box>
  )
}

function RecentActivityCard({ rows, onSeeAll }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: 2,
        border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        background: '#fff',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography sx={{ fontSize: 14.5, fontWeight: 700 }}>Recent activity</Typography>
        <Button size="small" onClick={onSeeAll} sx={{ fontWeight: 600 }}>
          See all
        </Button>
      </Stack>
      {rows.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary }}>
          Nothing recorded yet.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {rows.map((r, i) => (
            <Stack key={r.id ?? i} direction="row" spacing={1.5} alignItems="flex-start">
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  mt: '7px',
                  borderRadius: '50%',
                  background: dotFor(r.subStage, theme),
                }}
              />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 13, color: theme.palette.text.primary }}>
                  <Box component="span" sx={{ fontWeight: 600 }}>
                    {STAGE_LABELS[r.stage] || r.stage}
                  </Box>{' '}
                  · {r.createdBy || 'System'}
                </Typography>
                <Typography sx={{ fontSize: 12, color: theme.palette.text.disabled }}>
                  {formatShort(r.time)}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  )
}

function IdentityCard({ ia }) {
  const theme = useTheme()
  const raw = ia?.raw || {}
  const rows = [
    ['State', ia?.state],
    ['District', raw.district],
    ['PAN', raw.panNo],
    ['Constitution', raw.constitutionType],
    ['IA type', raw.iaType],
    ['Apex contact', raw.apexHolderName],
    ['Nodal contact', raw.nodalName],
    ['Primary email', raw.email],
  ]
  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: 2,
        border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        background: '#fff',
        position: { md: 'sticky' },
        top: { md: 96 },
      }}
    >
      <Typography sx={{ fontSize: 14.5, fontWeight: 700, mb: 1.5 }}>Identity</Typography>
      <Stack spacing={1.25}>
        {rows.map(([label, value]) => (
          <Box key={label}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: theme.palette.text.disabled, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {label}
            </Typography>
            <Typography sx={{ fontSize: 13.5, color: value ? theme.palette.text.primary : theme.palette.text.disabled }}>
              {value || '—'}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}

function NoticeCard({ title, body }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        maxWidth: 540,
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
      <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{title}</Typography>
      <Typography sx={{ fontSize: 13.5, color: 'text.secondary', mt: 1 }}>{body}</Typography>
    </Box>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────

function dotFor(subStage, theme) {
  const s = String(subStage || '').toUpperCase()
  if (s.includes('REJECTED')) return theme.palette.error.main
  if (s.includes('REVERTED')) return theme.palette.warning.main
  if (s.includes('APPROVAL') || s.includes('APPROVED')) return theme.palette.success.main
  return theme.palette.primary.main
}

function formatShort(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
}
