import { useCallback, useMemo, useState } from 'react'
import {
  Alert, Box, CircularProgress, IconButton, Snackbar, Stack, Tooltip, Typography,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopyRounded'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { alpha, useTheme } from '@mui/material/styles'
import { Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import {
  useIA, useEligibilityMatrixByRegistration, useAllStages, useStageHistory,
} from '../../queries'
import { STAGE } from '../../apis/registrationStages'
import { deriveWorkflow, STATUS } from '../../apis/workflow'
import { decisionsFor, stageIdOf } from '../../apis/stageActions'
import { useAuth } from '../../auth'
import SnapshotBar from './SnapshotBar'
import StageCardsGrid from './StageCardsGrid'
import DecisionDialog from './DecisionDialog'
import { TABS } from './workspaceConfig'

// IaWorkspaceLayout
// ────────────────────────────────────────────────────────────────────────
// Parent route for every IA workspace tab. Loads:
//
//   • the IA record (`useIA`)
//   • the linked Eligibility Matrix (`useEligibilityMatrixByRegistration`)
//   • the master stages list (`useAllStages`) — cached, ~forever
//   • the per-IA stage history (`useStageHistory`)
//
// then folds them into a derived workflow tree (`deriveWorkflow`) that the
// StageCardsGrid + snapshot bar render off of.
//
// The active tab is derived from the URL — `Outlet` picks up the child
// route ({eligibility, l1, sustainability, …}). Child tabs consume the
// workspace context via `useIaWorkspace()`.

const NEW_IA_ID = 'new'

export default function IaWorkspaceLayout() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const theme = useTheme()
  const { role, rawRole } = useAuth()

  // Base path — GT and SDE share this layout but their URLs live under
  // different prefixes. Reading from the current location keeps navigation
  // inside whichever workspace the viewer entered from.
  const basePath = location.pathname.startsWith('/sde') ? '/sde' : '/gt'
  // Viewer role is what unlocks decision affordances on stage sub-rows.
  // Kept as a plain uppercase string so the pure workflow helpers can
  // switch on it without dragging useAuth into their imports.
  const viewerRole = String(rawRole || '').toUpperCase()

  const isNew = id === NEW_IA_ID
  const iaQ = useIA(isNew ? null : id)
  const eligibilityQ = useEligibilityMatrixByRegistration(isNew ? null : id)
  const stagesQ = useAllStages()
  const historyQ = useStageHistory(isNew ? null : id)

  const ia = iaQ.data
  const eligibility = eligibilityQ.data
  const activeTab = resolveActiveTab(location.pathname)

  // Derive the six-stage workflow tree once per data change. `raw` is the
  // canonical DTO — that's where `currentStage`, `isEligibleMatricsAdded`,
  // `id`, `createdAt`, `createdBy` all live.
  const workflow = useMemo(
    () => deriveWorkflow({
      ia: ia?.raw,
      allStages: stagesQ.data,
      history: historyQ.data,
      // Pass the fetched matrix so its presence alone can mark the
      // Eligibility card done — the backend sometimes omits the
      // `isEligibleMatricsAdded` flag on the IA DTO after creation.
      eligibility,
    }),
    [ia, stagesQ.data, historyQ.data, eligibility],
  )

  const [expandedStageKey, setExpandedStageKey] = useState(() => defaultExpandedStage(workflow))
  const onStageExpandToggle = useCallback(
    (key) => setExpandedStageKey((prev) => (prev === key ? null : key)),
    [],
  )

  // ── Reviewer decisions (SDE / CE / HO Maker) ────────────────────────
  // The decisions map tells us which buttons a viewer sees on which
  // sub-stage row. It's driven by the master `stageActions` table +
  // the live `useAllStages()` list (so the numeric `stageId` sent to
  // the approve endpoint is always in sync with the backend).
  const decisionsForRow = useCallback(
    (stage, sub) => {
      if (isNew) return []
      // Only offer decisions on the in-progress sub-stage — reviewer
      // shouldn't be able to act on a completed row retroactively.
      if (sub.status !== STATUS.IN_PROGRESS) return []
      // Use the normalised bare sub-stage key from the mapped `ia`
      // shape — not `ia.raw.currentStage`, which can be in the dotted
      // "STAGE.SUB_STAGE" form that the transitions table doesn't match.
      const currentSubStage = ia?.currentStage
      if (!currentSubStage) return []
      return decisionsFor(currentSubStage, viewerRole).map((d) => ({
        ...d,
        stageId: stageIdOf(stagesQ.data, d.to),
      }))
    },
    [isNew, ia, viewerRole, stagesQ.data],
  )

  const [pendingDecision, setPendingDecision] = useState(null) // { stage, sub, decision }
  const [toast, setToast] = useState(null)

  const onDecision = useCallback((stage, sub, decision) => {
    setPendingDecision({ stage, sub, decision })
  }, [])

  const closeDialog = useCallback(() => setPendingDecision(null), [])

  const onDialogDone = useCallback((result) => {
    if (result) setToast(result)
  }, [])

  // Workspace tabs surfaced in the header. Stage tabs (L1 / Sustainability
  // / Appraisal) unlock progressively so viewers can't jump ahead into a
  // form that isn't ready yet.
  //   • L1           — needs the eligibility matrix on record
  //   • Sustainability — needs L1 fully approved (stage 2 COMPLETED)
  //   • Appraisal    — needs Sustainability submitted (stage 3 COMPLETED)
  const views = useMemo(() => {
    const stagesByKey = new Map((workflow?.stages || []).map((s) => [s.key, s]))
    const eligibilityDone = stagesByKey.get(STAGE.ELIGIBILITY_MATRIX)?.status === STATUS.COMPLETED
    const l1Done = stagesByKey.get(STAGE.IN_PRINCIPLE_APPROVAL_OF_IA)?.status === STATUS.COMPLETED
    const sustainabilityDone = stagesByKey.get(STAGE.SUSTAINABILITY_MATRIX)?.status === STATUS.COMPLETED

    const disabledFor = (key) => {
      if (isNew) return key !== 'overview' && key !== 'l1' // draft mode: nothing else exists
      if (key === 'l1') return !eligibilityDone
      if (key === 'sustainability') return !l1Done
      if (key === 'appraisal') return !sustainabilityDone
      return false
    }
    const disabledReason = (key) => {
      if (key === 'l1') return 'Complete the Eligibility Matrix first.'
      if (key === 'sustainability') return 'Opens once In-Principle Approval (L1) is granted.'
      if (key === 'appraisal') return 'Opens once the Sustainability Matrix is submitted.'
      return ''
    }

    return [
      { key: 'overview',       label: 'Overview' },
      { key: 'l1',             label: 'Registration (L1)' },
      { key: 'sustainability', label: 'Sustainability' },
      { key: 'appraisal',      label: 'Detailed Appraisal' },
      { key: 'documents',      label: 'Documents' },
      { key: 'activity',       label: 'Activity' },
    ].map((v) => {
      const disabled = disabledFor(v.key)
      return {
        ...v,
        disabled,
        disabledReason: disabled ? disabledReason(v.key) : '',
        onClick: () => {
          if (disabled || v.key === activeTab || isNew) return
          navigate(`${basePath}/ias/${id}/workspace/${v.key}`)
        },
      }
    })
  }, [workflow, activeTab, basePath, id, isNew, navigate])

  const snapshot = useMemo(
    () => buildSnapshot({ isNew, ia, eligibility, workflow }),
    [isNew, ia, eligibility, workflow],
  )

  const turn = useMemo(() => pickTurnPill(workflow, isNew, theme), [workflow, isNew, theme])

  // Decisions available at whatever sub-stage the IA is currently sitting
  // at, from *this viewer's* perspective. Tabs (RegistrationTab etc.) use
  // this to render an inline SDE / CE / HO review panel when it's the
  // reviewer's turn.
  const decisionsForCurrent = useMemo(() => {
    if (isNew) return []
    const currentSubStage = ia?.currentStage
    if (!currentSubStage) return []
    return decisionsFor(currentSubStage, viewerRole).map((d) => ({
      ...d,
      stageId: stageIdOf(stagesQ.data, d.to),
    }))
  }, [isNew, ia, viewerRole, stagesQ.data])

  const context = useMemo(
    () => ({
      isNew,
      iaId: isNew ? null : id,
      ia,
      eligibility,
      workflow,
      // Role + workspace context — tabs use these to gate edit affordances
      // vs. read-only views, and to route inside the correct workspace.
      basePath,
      role,
      viewerRole,
      // Reviewer plumbing — lets a tab render its own decision buttons
      // (Approve / Reject / Send back) alongside the record it's showing.
      decisionsForCurrent,
      onDecision,
      loading: !isNew && (iaQ.isLoading || eligibilityQ.isLoading),
      error: iaQ.error || eligibilityQ.error,
    }),
    [isNew, id, ia, eligibility, workflow, basePath, role, viewerRole,
     decisionsForCurrent, onDecision,
     iaQ.isLoading, iaQ.error, eligibilityQ.isLoading, eligibilityQ.error],
  )

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
    <Box sx={{ maxWidth: 1360, mx: 'auto', pt: 1, pb: 8 }}>
      <TitleRow
        title={ia?.name || (isNew ? 'New Industry Association' : '—')}
        stateName={ia?.state}
        subtitle={ia?.raw?.constitutionType || (isNew ? 'New application' : null)}
        iaCode={ia?.uuid ? formatIaCode(ia.uuid) : isNew ? 'IA · draft' : null}
        turn={turn}
      />

      {!isNew && (
        <StageCardsGrid
          workflow={workflow}
          expandedKey={expandedStageKey}
          onExpandToggle={onStageExpandToggle}
          decisionsForRow={decisionsForRow}
          onDecision={onDecision}
        />
      )}

      <SnapshotBar cells={snapshot} views={isNew ? [] : views} activeViewKey={activeTab} />

      <Box sx={{ pt: 3 }}>
        <Outlet context={context} />
      </Box>

      <DecisionDialog
        open={!!pendingDecision}
        onClose={closeDialog}
        iaId={isNew ? null : id}
        decision={pendingDecision?.decision || null}
        stageLabel={pendingDecision?.stage?.label}
        onDone={onDialogDone}
      />
      <Snackbar
        open={!!toast}
        autoHideDuration={4200}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert severity={toast.severity} variant="filled" onClose={() => setToast(null)}>
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
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
          {stateName && subtitle && <InlineDivider />}
          {subtitle && <span>{subtitle}</span>}
          {subtitle && iaCode && <InlineDivider />}
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

function InlineDivider() {
  return <Box component="span" sx={{ color: 'divider' }}>·</Box>
}

// ── Helpers ─────────────────────────────────────────────────────────────

function resolveActiveTab(pathname) {
  // Match against the tail segments so we pick the deepest tab even if
  // extra path pieces appear later.
  const segments = String(pathname || '').split('/').filter(Boolean)
  for (let i = segments.length - 1; i >= 0; i--) {
    const match = TABS.find((t) => t.key === segments[i])
    if (match) return match.key
  }
  return 'overview'
}

function formatIaCode(uuid) {
  return `IA · ${String(uuid).slice(0, 8).toUpperCase()}`
}

// Which stage card should auto-expand on first render — the first stage
// that's actively in progress (or needs action). Prevents a blank workspace
// when the user opens the page.
function defaultExpandedStage(workflow) {
  const inFlight = workflow.stages.find(
    (s) => s.status === STATUS.IN_PROGRESS || s.status === STATUS.REVERTED,
  )
  return inFlight?.key || null
}

// Turn pill in the title row.
function pickTurnPill(workflow, isNew, theme) {
  if (isNew) {
    return {
      label: 'Draft · in progress',
      color: theme.palette.info.dark,
      bg: theme.palette.info.light,
      dot: theme.palette.info.main,
    }
  }
  const actionable = workflow.stages.find(
    (s) => s.status === STATUS.IN_PROGRESS || s.status === STATUS.REVERTED,
  )
  if (actionable) {
    return {
      label: 'Your turn',
      color: theme.palette.warning.dark,
      bg: alpha(theme.palette.warning.main, 0.14),
      dot: theme.palette.warning.main,
    }
  }
  return null
}

// Snapshot cells — mirrors what the stage cards already show but presents
// it as a compact strip for viewers who don't want to expand a card.
function buildSnapshot({ isNew, ia, eligibility, workflow }) {
  if (isNew) {
    return [
      { label: 'Who has it', value: 'You · Draft', tone: 'primary' },
      { label: 'Stage', value: 'Eligibility Matrix' },
      { label: 'Next required', value: 'Complete the eligibility form', tone: 'warning' },
      { label: 'Progress', value: 'Not started' },
    ]
  }

  const active = workflow.stages.find(
    (s) => s.status === STATUS.IN_PROGRESS || s.status === STATUS.REVERTED,
  )
  const stageLabel = active?.label
    || workflow.stages.slice().reverse().find((s) => s.status === STATUS.COMPLETED)?.label
    || 'Not started'

  const { completed, total, percent } = workflow.overall

  return [
    { label: 'Who has it', value: ia?.owner || 'You', tone: 'primary' },
    { label: 'Stage', value: stageLabel },
    {
      label: 'Next required',
      value: pickNextAction(active),
      tone: active ? 'warning' : 'success',
    },
    {
      label: 'Progress',
      value: `${completed} / ${total} steps · ${percent}%`,
      tone: percent === 100 ? 'success' : undefined,
    },
    // Eligibility score is a bonus fifth cell — visible when we have one.
    ...(eligibility?.totalScore != null
      ? [{ label: 'Score', value: `${eligibility.totalScore}% · Eligibility` }]
      : []),
  ]
}

function pickNextAction(activeStage) {
  if (!activeStage) return 'Nothing pending'
  if (activeStage.status === STATUS.REVERTED) return `Revise ${activeStage.label}`
  const pending = activeStage.subStages.find((s) => s.status === STATUS.IN_PROGRESS || s.status === STATUS.NOT_STARTED)
  if (pending) return pending.label
  return activeStage.label
}


