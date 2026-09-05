import { useCallback, useMemo, useState } from 'react'
import {
  Alert, Box, CircularProgress, IconButton, Stack, Tooltip, Typography,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopyRounded'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { alpha, useTheme } from '@mui/material/styles'
import { Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useIA, useEligibilityMatrixByRegistration } from '../../queries'
import StageTracker from './StageTracker'
import SnapshotBar from './SnapshotBar'
import WorkspaceTabs from './WorkspaceTabs'
import { TABS, deriveStageStates, STAGE_STATE } from './workspaceConfig'

// IaWorkspaceLayout
// ────────────────────────────────────────────────────────────────────────
// The parent route for all IA workspace tabs. Fetches the IA + linked
// eligibility record, derives per-stage state, and renders:
//
//   [ IA title row (name · state · id · turn pill) ]
//   [ Horizontal stage tracker (7 steps)          ]
//   [ Snapshot bar (who / stage / next / progress)]
//   [ Tab rail (Overview · Eligibility · L1 ...)  ]
//   [ <Outlet /> — the active tab renders here    ]
//
// Two runtime modes:
//   • `:id === 'new'`     — brand-new IA (before submit). Only the
//                           Eligibility tab is meaningful; the layout
//                           still renders the shell so users see the
//                           context they're building into.
//   • `:id === <uuid>`    — existing IA. IA + eligibility come from
//                           react-query and drive the tracker.
//
// Child tabs consume the derived context via `useIaWorkspace()`.

const NEW_IA_ID = 'new'

export default function IaWorkspaceLayout() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const theme = useTheme()

  const isNew = id === NEW_IA_ID
  const iaQ = useIA(isNew ? null : id)
  const eligibilityQ = useEligibilityMatrixByRegistration(isNew ? null : id)

  const ia = iaQ.data
  const eligibility = eligibilityQ.data
  // Tab is a nested path segment, not a route param — read it off the URL
  // so the tab rail's active-underline mirrors the current route.
  const activeTab = resolveActiveTab(location.pathname)

  const stageStates = useMemo(
    () =>
      deriveStageStates({
        hasEligibility: !!eligibility,
        hasRegistrationSubmitted: !isNew && !!ia?.raw?.industryAssociationName,
        l1Approved: ia?.raw?.isSidbeApproved === true,
        l1Rejected: ia?.raw?.isSidbeApproved === false,
        hasSustainability: false,
        hasAppraisalSubmitted: !!ia?.appraisal,
        ceDecided: false,
        l2Approved: ia?.appraisal?.isSidbeApproved === true,
        l2Rejected: ia?.appraisal?.isSidbeApproved === false,
        hoApproved: false,
        hoRejected: false,
      }),
    [ia, eligibility, isNew],
  )

  const stageMeta = useMemo(() => {
    const meta = {}
    if (eligibility?.totalScore != null) meta.eligibility = `Score ${eligibility.totalScore}`
    if (ia?.raw?.isSidbeApproved === true) meta.registration = 'Approved'
    if (ia?.raw?.isSidbeApproved === false) meta.registration = 'Changes requested'
    return meta
  }, [ia, eligibility])

  const snapshot = useMemo(
    () => buildSnapshot({ isNew, ia, eligibility, stageStates }),
    [isNew, ia, eligibility, stageStates],
  )

  const onTabChange = useCallback(
    (nextTab) => {
      if (nextTab === activeTab) return
      navigate(`/gt/ias/${id}/workspace/${nextTab}`)
    },
    [activeTab, id, navigate],
  )

  const onStageClick = useCallback(
    (stage) => {
      if (!stage?.tab) return
      navigate(`/gt/ias/${id}/workspace/${stage.tab}`)
    },
    [id, navigate],
  )

  const context = useMemo(
    () => ({
      isNew,
      iaId: isNew ? null : id,
      ia,
      eligibility,
      stageStates,
      loading: !isNew && (iaQ.isLoading || eligibilityQ.isLoading),
      error: iaQ.error || eligibilityQ.error,
    }),
    [isNew, id, ia, eligibility, stageStates, iaQ.isLoading, iaQ.error, eligibilityQ.isLoading, eligibilityQ.error],
  )

  // Existing-IA load spinner. Left deliberately at the shell level so
  // every tab inherits a single loading affordance.
  if (!isNew && iaQ.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }
  if (!isNew && iaQ.error) {
    return (
      <Box sx={{ maxWidth: 940, mx: 'auto', py: 4 }}>
        <Alert severity="error">{iaQ.error?.message || 'Failed to load this IA.'}</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 1360, mx: 'auto', px: { xs: 2, md: 4 }, pt: 4, pb: 12 }}>
      <TitleRow
        title={ia?.name || (isNew ? 'New Industry Association' : '—')}
        stateName={ia?.state}
        subtitle={ia?.raw?.constitutionType || (isNew ? 'New application' : null)}
        iaCode={ia?.uuid ? formatIaCode(ia.uuid) : isNew ? 'IA · draft' : null}
        turn={pickTurnPill(stageStates, isNew, theme)}
      />

      <StageTracker states={stageStates} meta={stageMeta} onStageClick={isNew ? undefined : onStageClick} />
      <SnapshotBar cells={snapshot} />
      <WorkspaceTabs activeKey={activeTab} stageStates={stageStates} onChange={onTabChange} />

      <Box sx={{ pt: 3 }}>
        <Outlet context={context} />
      </Box>
    </Box>
  )
}

// Hook for child tabs to consume the workspace context. Prevents each
// tab from re-fetching or re-deriving what the layout already owns.
export function useIaWorkspace() {
  return useOutletContext()
}

// ── Local components ────────────────────────────────────────────────────

function TitleRow({ title, stateName, subtitle, iaCode, turn }) {
  const theme = useTheme()
  const [copied, setCopied] = useState(false)

  const copy = () => {
    if (!iaCode) return
    navigator.clipboard?.writeText(iaCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'flex-start' }} spacing={2} flexWrap="wrap">
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography component="h1" sx={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
          {title}
        </Typography>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          flexWrap="wrap"
          sx={{ mt: 1.25, fontSize: 13.5, color: theme.palette.text.secondary }}
        >
          {stateName && <span>{stateName}</span>}
          {stateName && subtitle && <Divider inline />}
          {subtitle && <span>{subtitle}</span>}
          {subtitle && iaCode && <Divider inline />}
          {iaCode && (
            <>
              <Box component="span" sx={{ fontFamily: 'ui-monospace, "Roboto Mono", monospace', fontSize: 12.5 }}>
                {iaCode}
              </Box>
              <Tooltip title={copied ? 'Copied' : 'Copy IA ID'} arrow>
                <IconButton size="small" onClick={copy} sx={{ p: 0.5, color: theme.palette.text.disabled }}>
                  {copied ? <CheckCircleIcon sx={{ fontSize: 15, color: theme.palette.success.main }} /> : <ContentCopyIcon sx={{ fontSize: 15 }} />}
                </IconButton>
              </Tooltip>
            </>
          )}
        </Stack>
      </Box>
      {turn && (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            fontSize: 12.5,
            fontWeight: 600,
            color: turn.color,
            background: turn.bg,
            px: 1.5,
            py: 0.75,
            borderRadius: 1,
            whiteSpace: 'nowrap',
            mt: { xs: 0, sm: 0.5 },
          }}
        >
          <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', background: turn.dot }} />
          {turn.label}
        </Box>
      )}
    </Stack>
  )
}

function Divider({ inline }) {
  return inline ? <Box component="span" sx={{ color: 'divider' }}>·</Box> : null
}

// ── Helpers ─────────────────────────────────────────────────────────────

function resolveActiveTab(pathname) {
  // Match against the tail segments so we pick the deepest tab even if
  // extra path pieces appear later (e.g. nested sub-tabs on a stage).
  const segments = String(pathname || '').split('/').filter(Boolean)
  for (let i = segments.length - 1; i >= 0; i--) {
    const match = TABS.find((t) => t.key === segments[i])
    if (match) return match.key
  }
  return 'overview'
}

function formatIaCode(uuid) {
  // Present the raw UUID as a short display code. Backend hasn't shipped
  // a human ID yet — swap this out the moment it does.
  return `IA · ${String(uuid).slice(0, 8).toUpperCase()}`
}

function pickTurnPill(stageStates, isNew, theme) {
  if (isNew) {
    return {
      label: 'Draft · in progress',
      color: theme.palette.info.dark,
      bg: theme.palette.info.light,
      dot: theme.palette.info.main,
    }
  }
  const hasAction = Object.values(stageStates).some((s) => s === STAGE_STATE.ACTION)
  if (hasAction) {
    return {
      label: 'Your turn',
      color: theme.palette.warning.dark,
      bg: alpha(theme.palette.warning.main, 0.14),
      dot: theme.palette.warning.main,
    }
  }
  return null
}

function buildSnapshot({ isNew, ia, eligibility, stageStates }) {
  if (isNew) {
    return [
      { label: 'Who has it', value: 'You · Draft', tone: 'primary' },
      { label: 'Stage', value: 'Eligibility Matrix' },
      { label: 'Next required', value: 'Answer all 22 parameters', tone: 'warning' },
      { label: 'Progress', value: 'Not started' },
    ]
  }

  const nextRequired = pickNextRequired(stageStates)

  return [
    { label: 'Who has it', value: ia?.owner || 'You', tone: 'primary' },
    { label: 'Stage', value: pickCurrentStageLabel(stageStates) },
    { label: 'Next required', value: nextRequired, tone: nextRequired === 'Nothing pending' ? 'success' : 'warning' },
    {
      label: 'Score',
      value: eligibility?.totalScore != null ? `${eligibility.totalScore}% · Eligibility` : '—',
    },
  ]
}

function pickCurrentStageLabel(states) {
  const currentKey = Object.entries(states).find(([, v]) => v === STAGE_STATE.CURRENT)?.[0]
  const actionKey = Object.entries(states).find(([, v]) => v === STAGE_STATE.ACTION)?.[0]
  const key = currentKey || actionKey
  if (!key) return 'Complete'
  const labels = {
    eligibility: 'Eligibility Matrix',
    registration: 'Registration (L1)',
    sustainability: 'Sustainability Matrix',
    appraisal: 'Detailed Appraisal',
    ceReview: 'Cluster Expert Review',
    sdeL2: 'SDE L2',
    hoFinal: 'HO Final',
  }
  return labels[key] || '—'
}

function pickNextRequired(states) {
  const actionKey = Object.entries(states).find(([, v]) => v === STAGE_STATE.ACTION)?.[0]
  const labels = {
    eligibility: 'Complete the matrix',
    registration: 'Fill the L1 form',
    sustainability: 'Complete the sustainability matrix',
    appraisal: 'Fill the detailed appraisal',
    sdeL2: 'Revise for SDE',
    hoFinal: 'Revise for HO',
  }
  return actionKey ? labels[actionKey] || 'Action required' : 'Nothing pending'
}
