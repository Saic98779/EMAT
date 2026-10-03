import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert, Box, Button, Checkbox, CircularProgress, Divider,
  Snackbar, Stack, TextField, Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'

import { useIaWorkspace } from '../../../components/workspace/IaWorkspaceLayout'
import { STAGE } from '../../../apis/registrationStages'
import { STATUS } from '../../../apis/workflow'
import { DECISION, stageIdOf } from '../../../apis/stageActions'
import {
  ACTION_PLAN_ITEMS,
  packActionPlans,
  selectionHasOthers,
  unpackActionPlans,
} from '../../../apis/sustainabilityMatrix'
import {
  useAllStages,
  useAppraisalByRegistration,
  useDecideActionPlan,
  useSubmitActionPlan,
  useSustainabilityMatrixByAppraisal,
} from '../../../queries'

// ActionPlanTab
// ────────────────────────────────────────────────────────────────────────
// Annexure IV — GT ticks the 8 suggested IGAs, optionally adds Others
// details, and submits for Cluster Expert review. CE then either
// approves (unlocks Detailed Appraisal) or reverts with a comment so GT
// can revise. All writes ride on the sustainability-matrix row (backend
// added `actionPlans` + `actionPlanClusterExpertComment` columns there).
//
// Views:
//   • Gate    — sustainability matrix must exist on this IA's appraisal
//   • GT edit — checkboxes + Others textarea + Submit
//   • GT locked (post-submit, pre-CE) — read-only checkboxes + status
//   • GT reverted — banner with CE remarks + editable form
//   • CE review — read-only checkboxes + sticky Approve/Send-back bar
//   • Approved / Rejected banners for the informational states

const OTHERS_KEY = 'others'

export default function ActionPlanTab() {
  const ws = useIaWorkspace()

  // ── Guards ──────────────────────────────────────────────────────────
  if (ws.isNew) {
    return (
      <Notice
        title="Action Plan opens after Sustainability"
        body="Fill the Eligibility Matrix, submit L1, and complete the Sustainability Matrix — the Action Plan tab unlocks after that."
      />
    )
  }
  if (ws.loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={22} />
      </Box>
    )
  }
  if (!ws.ia) {
    return <Notice title="IA not found" body={ws.error?.message || 'This IA could not be loaded.'} />
  }
  return <ActionPlanBody ws={ws} />
}

function ActionPlanBody({ ws }) {
  // All hooks first — React's hook order rule means we can't early-return
  // before the useMemo below. `dto` may be null on the first render;
  // unpackActionPlans handles that (returns empty selection).
  const navigate = useNavigate()
  const apprQ = useAppraisalByRegistration(ws.iaId)
  const appraisalId = apprQ.data?.id ?? null
  const matrixQ = useSustainabilityMatrixByAppraisal(appraisalId)
  const stagesQ = useAllStages()
  const submitM = useSubmitActionPlan()
  const dto = matrixQ.data || null
  const seeded = useMemo(() => unpackActionPlans(dto?.actionPlans), [dto?.actionPlans])

  // ── Workflow-level state on this IA's Action Plan card ──────────────
  // Drive every branch off the stage-level status — deriveWorkflow already
  // collapses the four sub-stage keys (SUBMITTED / APPROVED / REVERTED)
  // into one signal, so we don't need to inspect sub-stage rows here.
  //   • NOT_STARTED → GT has not submitted yet
  //   • IN_PROGRESS → GT submitted, waiting on Cluster Expert
  //   • COMPLETED   → CE approved
  //   • REVERTED    → CE sent back with remarks
  const actionPlanStage = ws.workflow?.stages?.find((s) => s.key === STAGE.ACTION_PLAN)
  const actionPlanStatus = actionPlanStage?.status || STATUS.NOT_STARTED
  const isReverted = actionPlanStatus === STATUS.REVERTED
  const isApproved = actionPlanStatus === STATUS.COMPLETED
  const isAwaitingCe = actionPlanStatus === STATUS.IN_PROGRESS

  // ── Reviewer routing ────────────────────────────────────────────────
  // UAT 2026-10-02 bugfix (mirror of SustainabilityTab fix). Derive CE
  // decisions from THIS track's own sub-stage state, not from
  // `ws.decisionsForCurrent` which is a single-enum lookup on
  // `ia.currentStage`. In the parallel-tracks world, `currentStage`
  // reflects whichever track was most recently written, so the other
  // tab would inherit the wrong decisions and silently fire the wrong
  // sub-stage id through its own endpoint.
  //
  // CE sees the Approve/Revert bar on action plan iff GT has submitted
  // the plan AND no CE decision has been recorded on it yet.
  const isCeViewer = ws.viewerRole === 'CLUSTER_EXPERT'
  const actionPlanSubmissionDone = actionPlanStage?.subStages?.[0]?.status === STATUS.COMPLETED
  const actionPlanCeDone = actionPlanStage?.subStages?.[1]?.status === STATUS.COMPLETED
  const actionPlanNeedsCe = isCeViewer && actionPlanSubmissionDone && !actionPlanCeDone
    && actionPlanStatus !== STATUS.REJECTED
  const decisions = useMemo(() => {
    if (!actionPlanNeedsCe) return []
    const build = (to, kind, label) => {
      const stageId = stageIdOf(stagesQ.data, to)
      return stageId != null ? { kind, to, label, stageId } : null
    }
    return [
      build('CLUSTER_EXPERT_APPROVED', DECISION.APPROVE, 'Approve action plan'),
      build('CLUSTER_EXPERT_REVERTED', DECISION.REVERT,  'Send back to GT'),
    ].filter(Boolean)
  }, [actionPlanNeedsCe, stagesQ.data])
  const isCeReviewer = decisions.length > 0
  // Only GT Field Team ever authors the action plan. Every other role
  // (SDE, CE, HO Maker, GT PMU) sees the read-only checklist regardless
  // of stage status — otherwise CE opening the tab before GT submits
  // would land on an editable form, which they'd then be able to
  // "submit" against the sustainability endpoint they don't own.
  const isGtFieldTeam = ws.viewerRole === 'GT_FIELD_TEAM'

  // Loading gate — need the matrix row before we can read/write action plans.
  if (apprQ.isLoading || matrixQ.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={22} />
      </Box>
    )
  }
  if (!dto) {
    return (
      <Notice
        title="Submit the Sustainability Matrix first"
        body="The Action Plan lives on the same record as the Sustainability Matrix. Head back to the Sustainability tab and submit it — this tab opens right after."
      />
    )
  }

  const matrixId = dto.id
  const reviewerComment = String(dto.actionPlanClusterExpertComment || '').trim()

  // GT editable branch — first-time submit (NOT_STARTED) or revise
  // after CE revert. Restricted to GT Field Team only; other roles
  // (including CE at a non-actionable sub-stage) see the read-only
  // checklist even when the stage happens to be NOT_STARTED / REVERTED.
  const gtCanEdit = isGtFieldTeam
    && !isCeReviewer
    && (actionPlanStatus === STATUS.NOT_STARTED || isReverted)

  return (
    <>
      {isApproved && <StatusBanner tone="success" title="Action Plan approved" body="Cluster Expert has cleared the plan. Detailed Appraisal is now open." />}
      {isReverted && (
        <ReviewerRemarkBanner
          tone="warning"
          title="Sent back for revisions"
          body="The Cluster Expert has asked for changes before the Action Plan can move forward."
          remark={reviewerComment}
        />
      )}
      {isAwaitingCe && !isCeReviewer && (
        <StatusBanner
          tone="info"
          title="Awaiting Cluster Expert review"
          body="The Action Plan has been filed for CE review. The outcome will appear here as soon as it's recorded."
        />
      )}

      {gtCanEdit ? (
        <GtEditForm
          matrixId={matrixId}
          registrationId={ws.iaId}
          dto={dto}
          seeded={seeded}
          allStages={stagesQ.data}
          submitM={submitM}
        />
      ) : (
        <ReadOnlyPlan seeded={seeded} />
      )}

      {isCeReviewer && (
        <CeDecisionBar
          matrixId={matrixId}
          registrationId={ws.iaId}
          dto={dto}
          decisions={decisions}
          // Composite advancement: if sustainability is already
          // CE-approved, an APPROVE here should fire stageId=20 (the
          // SUSTAINABILITY_MATRIX_AND_ACTION_PLAN_COMPLETED composite)
          // instead of the legacy id=8 — so Detailed Appraisal opens in
          // one write. Backend confirmed 2026-09-27 the frontend must
          // send the composite explicitly.
          otherTrackApproved={ws.workflow?.stages?.find((s) => s.key === STAGE.SUSTAINABILITY_MATRIX)?.status === STATUS.COMPLETED}
          compositeStageId={stageIdOf(stagesQ.data, 'SUSTAINABILITY_MATRIX_AND_ACTION_PLAN_COMPLETED')}
        />
      )}

      {/* Shortcut into Detailed Appraisal after CE-approval — GT only.
          CE / SDE / HO Maker viewing an already-approved Action Plan
          don't need this: CE is done with the record, and SDE / HO have
          their own entry points into the L2 review surface. Gating on
          `isGtFieldTeam` prevents the button from bleeding into every
          reviewer role once the stage clears. */}
      {isApproved && isGtFieldTeam && (
        <Box sx={{ mt: 3 }}>
          <Button
            variant="contained"
            disableElevation
            onClick={() => navigate(`${ws.basePath}/ias/${ws.iaId}/workspace/appraisal`)}
          >
            Open Detailed Appraisal
          </Button>
        </Box>
      )}
    </>
  )
}

// ── GT editable form ────────────────────────────────────────────────────

function GtEditForm({ matrixId, registrationId, dto, seeded, allStages, submitM }) {
  const [selected, setSelected] = useState(seeded.selectedKeys)
  const [toast, setToast] = useState(null)
  const [dirty, setDirty] = useState(false)

  // "Others" text lives in a ref (+ memoized child owns its own local
  // state). Parent never re-renders on keystrokes — otherwise every
  // ActionRow would re-render 8× per character and MUI's TextareaAutosize
  // measure trips the "input handler >50ms" violation.
  const othersTextRef = useRef(seeded.othersText || '')

  // Re-seed when the DTO changes (only when the user hasn't started
  // editing — otherwise a background refetch would clobber typing).
  useEffect(() => {
    if (dirty) return
    setSelected(seeded.selectedKeys)
    othersTextRef.current = seeded.othersText || ''
  }, [seeded.selectedKeys, seeded.othersText, dirty])

  // Stable toggle — takes the item key so the same handler serves every
  // checkbox. Memoization on ActionRow depends on this staying reference-
  // equal across renders.
  const rowToggle = useCallback((key) => {
    setDirty(true)
    setSelected((prev) => (
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    ))
  }, [])

  // Bulk actions — "Select all" ticks every item EXCEPT Others (Others
  // needs a details textbox, so it's opt-in). Clear resets to empty.
  // Both keep the Others box's existing text intact — only the checkbox
  // state changes, and the textbox is hidden if Others isn't checked.
  const NON_OTHERS_KEYS = useMemo(
    () => ACTION_PLAN_ITEMS.filter((it) => it.key !== OTHERS_KEY).map((it) => it.key),
    [],
  )
  const allNonOthersSelected = useMemo(
    () => NON_OTHERS_KEYS.every((k) => selected.includes(k)),
    [selected, NON_OTHERS_KEYS],
  )
  const selectAllExceptOthers = useCallback(() => {
    setDirty(true)
    setSelected((prev) => {
      const othersOn = prev.includes(OTHERS_KEY)
      return othersOn ? [...NON_OTHERS_KEYS, OTHERS_KEY] : [...NON_OTHERS_KEYS]
    })
  }, [NON_OTHERS_KEYS])
  const clearAll = useCallback(() => {
    setDirty(true)
    setSelected([])
  }, [])

  // Stable "text changed" callback for the Others row. Setting `dirty`
  // to `true` after the first keystroke is a no-op re-render (React
  // skips when the setter is called with the current value) so this
  // stays cheap on subsequent characters.
  const notifyOthers = useCallback((v) => {
    othersTextRef.current = v
    setDirty(true)
  }, [])

  const othersChecked = selectionHasOthers(selected)
  const canSubmit = selected.length > 0 && !submitM.isPending

  const submit = async () => {
    const othersText = othersTextRef.current || ''
    if (!canSubmit) {
      setToast({ severity: 'warning', msg: 'Select at least one action plan item.' })
      return
    }
    if (othersChecked && !othersText.trim()) {
      setToast({ severity: 'warning', msg: 'Add details for "Others" before submitting.' })
      return
    }
    const stageId = stageIdOf(allStages, 'ACTION_PLAN_SUBMITTED')
    if (!stageId) {
      setToast({ severity: 'error', msg: 'Backend stage list is missing ACTION_PLAN_SUBMITTED — reload and try again.' })
      return
    }
    try {
      await submitM.mutateAsync({
        matrixId,
        registrationId,
        dto, // echoed so backend REPLACE-PUT doesn't null the 22 booleans
        actionPlans: packActionPlans(selected, othersText),
        stageId,
        stageComments: 'GT submitting action plan for Cluster Expert review',
      })
      setToast({ severity: 'success', msg: 'Action Plan submitted — now with Cluster Expert.' })
      setDirty(false)
    } catch (err) {
      setToast({ severity: 'error', msg: err?.message || 'Failed to submit the action plan.' })
    }
  }

  return (
    <>
      <ChecklistCard
        title="Suggested Action Plan"
        subtitle="Annexure IV · Income-Generating Activities — tick the plans this IA intends to pursue."
        selectedCount={selected.length}
        toolbar={
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant={allNonOthersSelected ? 'outlined' : 'contained'}
              disableElevation
              onClick={selectAllExceptOthers}
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.25 }}
            >
              Select all (except Others)
            </Button>
            {selected.length > 0 && (
              <Button
                size="small"
                variant="text"
                onClick={clearAll}
                sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
              >
                Clear
              </Button>
            )}
          </Stack>
        }
      >
        {ACTION_PLAN_ITEMS.map((item, i) => {
          const checked = selected.includes(item.key)
          if (item.key === OTHERS_KEY) {
            return (
              <OthersRow
                key={item.key}
                index={i + 1}
                item={item}
                checked={checked}
                onToggle={rowToggle}
                initialText={seeded.othersText}
                onTextChange={notifyOthers}
                last
              />
            )
          }
          return (
            <PlainRow
              key={item.key}
              index={i + 1}
              item={item}
              checked={checked}
              onToggle={rowToggle}
            />
          )
        })}
      </ChecklistCard>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          disableElevation
          onClick={submit}
          disabled={!canSubmit}
          size="large"
          startIcon={submitM.isPending ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ textTransform: 'none', fontWeight: 700, px: 3 }}
        >
          {submitM.isPending ? 'Submitting…' : 'Submit for Cluster Expert review'}
        </Button>
      </Box>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  )
}

// Checklist container — card with a two-line header (title/counter row
// on top, optional toolbar with bulk-actions on the right). Rows sit
// inside with hairline dividers. `toolbar` is any React node — kept
// generic so the read-only variant can pass nothing.
function ChecklistCard({ title, subtitle, selectedCount, toolbar, children }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        borderRadius: 2,
        background: '#fff',
        overflow: 'hidden',
        boxShadow: `0 1px 2px ${alpha(theme.palette.text.primary, 0.04)}`,
      }}
    >
      <Box
        sx={{
          px: { xs: 2.5, md: 3 },
          py: 2.25,
          borderBottom: 1,
          borderColor: alpha(theme.palette.text.primary, 0.06),
          background: alpha(theme.palette.text.primary, 0.015),
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 1.5, md: 2 }} alignItems={{ md: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="baseline" spacing={1.5} flexWrap="wrap">
              <Typography sx={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
                {title}
              </Typography>
              <Box
                sx={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  letterSpacing: '0.03em',
                  color: selectedCount > 0 ? theme.palette.primary.dark : theme.palette.text.disabled,
                  background: selectedCount > 0
                    ? alpha(theme.palette.primary.main, 0.12)
                    : alpha(theme.palette.text.primary, 0.05),
                  px: 1,
                  py: 0.25,
                  borderRadius: 0.75,
                }}
              >
                {selectedCount} / {ACTION_PLAN_ITEMS.length}
              </Box>
            </Stack>
            {subtitle && (
              <Typography sx={{ mt: 0.5, fontSize: 13, color: theme.palette.text.secondary, lineHeight: 1.5 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {toolbar && <Box sx={{ flexShrink: 0 }}>{toolbar}</Box>}
        </Stack>
      </Box>
      <Box>{children}</Box>
    </Box>
  )
}

// Row shell shared by PlainRow + OthersRow. Two columns: checkbox column
// (fixed width) + label column (fluid). No third column. Selected rows
// get a subtle primary tint + a left-border accent.
const rowShellSx = (theme, checked) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: { xs: 1.75, md: 2.25 },
  px: { xs: 2, md: 3 },
  py: 2,
  position: 'relative',
  cursor: 'pointer',
  background: checked ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
  transition: 'background 140ms ease',
  '&:hover': {
    background: checked
      ? alpha(theme.palette.primary.main, 0.09)
      : alpha(theme.palette.text.primary, 0.03),
  },
  '&::before': checked ? {
    content: '""',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    background: theme.palette.primary.main,
  } : undefined,
})

// Plain (non-Others) checkbox row. No text input, so props are all
// primitive/stable and memoization actually skips re-renders when the
// user is typing in the Others box below.
const PlainRow = memo(function PlainRow({ index, item, checked, onToggle }) {
  const theme = useTheme()
  const handleRowClick = () => onToggle(item.key)
  return (
    <>
      <Box
        sx={rowShellSx(theme, checked)}
        onClick={handleRowClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleRowClick() } }}
      >
        <Checkbox
          checked={checked}
          onChange={handleRowClick}
          onClick={(e) => e.stopPropagation()}
          size="medium"
          sx={{ p: 0.25, mt: -0.25, flexShrink: 0 }}
        />
        <Typography sx={{ flex: 1, fontSize: 14.5, lineHeight: 1.55, color: theme.palette.text.primary, fontWeight: checked ? 500 : 400 }}>
          {item.label}
        </Typography>
      </Box>
      <Divider sx={{ borderColor: alpha(theme.palette.text.primary, 0.055) }} />
    </>
  )
})

// "Others" row owns its own text state locally. Parent stores the value
// in a ref via `onTextChange` (stable useCallback) — so keystrokes never
// re-render `GtEditForm` or any of the other 7 rows. Seeded once from
// `initialText`; subsequent parent seed changes (background refetch)
// resync via effect, but only when the local field is still empty so we
// never overwrite in-progress typing.
const OthersRow = memo(function OthersRow({ index, item, checked, onToggle, initialText, onTextChange, last }) {
  const theme = useTheme()
  const [text, setText] = useState(initialText || '')
  const seededOnceRef = useRef(false)
  useEffect(() => {
    if (seededOnceRef.current) return
    if (!initialText) return
    seededOnceRef.current = true
    setText(initialText)
  }, [initialText])

  const onInput = (e) => {
    const v = e.target.value.slice(0, 500)
    setText(v)
    onTextChange(v)
  }

  const handleRowClick = () => onToggle(item.key)
  return (
    <>
      <Box
        sx={rowShellSx(theme, checked)}
        onClick={handleRowClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleRowClick() } }}
      >
        <Checkbox
          checked={checked}
          onChange={handleRowClick}
          onClick={(e) => e.stopPropagation()}
          size="medium"
          sx={{ p: 0.25, mt: -0.25, flexShrink: 0 }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 14.5, lineHeight: 1.55, color: theme.palette.text.primary, fontWeight: checked ? 500 : 400 }}>
            {item.label}
          </Typography>
          {checked && (
            <Box
              sx={{ mt: 1.75 }}
              onClick={(e) => e.stopPropagation()}
              // Space + Enter in the textarea bubble up to the row's
              // onKeyDown, which calls preventDefault() to toggle the
              // checkbox — that silently swallowed every space + newline
              // the user typed. Stop propagation at the wrapper so the
              // row shortcut only fires when the row itself has focus.
              onKeyDown={(e) => e.stopPropagation()}
            >
              <TextField
                value={text}
                onChange={onInput}
                placeholder='Describe the "Others" activity — what the IA plans to run, expected outcome, funding pattern.'
                fullWidth
                multiline
                minRows={2}
                maxRows={6}
                // UAT 2026-10-03 — surface the 500-char cap with a live
                // right-aligned counter (red at the cap). The input
                // slice above already enforces it on state writes; the
                // `maxLength` here also stops a native paste past 500.
                inputProps={{ maxLength: 500 }}
                helperText={`${text.length} / 500`}
                FormHelperTextProps={{
                  sx: {
                    textAlign: 'right',
                    color: text.length >= 500 ? 'error.main' : 'text.disabled',
                    m: 0, mt: 0.25, fontSize: 11,
                  },
                }}
                slotProps={{
                  input: {
                    sx: {
                      background: '#fff',
                      borderRadius: 1.5,
                      fontSize: 13.5,
                    },
                  },
                }}
              />
            </Box>
          )}
        </Box>
      </Box>
      {!last && <Divider sx={{ borderColor: alpha(theme.palette.text.primary, 0.055) }} />}
    </>
  )
})

// ── Read-only view (GT-locked, approved, or CE reviewer) ────────────────

function ReadOnlyPlan({ seeded }) {
  const theme = useTheme()
  const selectedCount = seeded.selectedKeys.length
  return (
    <ChecklistCard
      title="Suggested Action Plan"
      subtitle="Annexure IV · Income-Generating Activities — read-only view."
      selectedCount={selectedCount}
    >
      {ACTION_PLAN_ITEMS.map((item, i) => {
        const checked = seeded.selectedKeys.includes(item.key)
        const isLast = i === ACTION_PLAN_ITEMS.length - 1
        return (
          <Box key={item.key}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '44px 1fr',
                columnGap: 1.5,
                alignItems: 'flex-start',
                px: { xs: 2, md: 2.5 },
                py: 1.75,
                position: 'relative',
                background: checked ? alpha(theme.palette.success.main, 0.04) : 'transparent',
                opacity: checked ? 1 : 0.6,
                '&::before': checked ? {
                  content: '""',
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 3,
                  background: theme.palette.success.main,
                } : undefined,
              }}
            >
              <Checkbox checked={checked} disabled size="small" sx={{ p: 0.5, mt: -0.5 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: theme.palette.text.disabled, letterSpacing: '0.03em', mb: 0.25 }}>
                  {String(i + 1).padStart(2, '0')}
                </Typography>
                <Typography sx={{ fontSize: 14, lineHeight: 1.5, color: theme.palette.text.primary }}>
                  {item.label}
                </Typography>
                {item.key === OTHERS_KEY && checked && seeded.othersText && (
                  <Box
                    sx={{
                      mt: 1.25,
                      border: 1,
                      borderColor: alpha(theme.palette.text.primary, 0.1),
                      borderRadius: 1.25,
                      background: '#fff',
                      px: 1.5,
                      py: 1,
                    }}
                  >
                    <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.palette.text.disabled, mb: 0.25 }}>
                      Details
                    </Typography>
                    <Typography sx={{ fontSize: 13.5, whiteSpace: 'pre-wrap', color: theme.palette.text.primary }}>
                      {seeded.othersText}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
            {!isLast && <Divider sx={{ borderColor: alpha(theme.palette.text.primary, 0.06) }} />}
          </Box>
        )
      })}
    </ChecklistCard>
  )
}

// ── Cluster Expert decision bar ─────────────────────────────────────────
// Same pattern as AppraisalReviewView's DecisionBar — owns its own
// comment state so typing doesn't re-render the checklist above.

const CeDecisionBar = memo(function CeDecisionBar({ matrixId, registrationId, dto, decisions, otherTrackApproved, compositeStageId }) {
  const theme = useTheme()
  const decideM = useDecideActionPlan()
  const [comment, setComment] = useState('')
  const [busyKind, setBusyKind] = useState(null)
  const [toast, setToast] = useState(null)

  // Deps include `dto` so CE always echoes the latest matrix snapshot
  // (post-GT-submit) — otherwise CE's PUT could ship a stale DTO from
  // before GT submitted the action plan.
  const decide = useCallback(async (d) => {
    const trimmed = comment.trim()
    if (d.kind === DECISION.REVERT && !trimmed) {
      setToast({ severity: 'warning', msg: 'Please add a comment telling GT what to change.' })
      return
    }
    // Composite advancement: if sustainability is already CE-approved
    // and this decision is an APPROVE, fire the composite stageId (20)
    // instead of the legacy CLUSTER_EXPERT_APPROVED (8) — Detailed
    // Appraisal unlocks in one write. Backend does not auto-advance;
    // frontend has to send this explicitly.
    const shouldComposite = d.kind === DECISION.APPROVE && otherTrackApproved && compositeStageId != null
    const stageId = shouldComposite ? compositeStageId : d.stageId
    if (stageId == null) {
      setToast({ severity: 'error', msg: 'Missing destination stage id — reload and try again.' })
      return
    }
    setBusyKind(d.kind)
    try {
      await decideM.mutateAsync({
        matrixId,
        registrationId,
        dto, // echoed so REPLACE-PUT doesn't null booleans or GT's actionPlans
        actionPlanClusterExpertComment: trimmed || null,
        stageId,
        stageComments: trimmed || (
          shouldComposite ? 'Both tracks approved by Cluster Expert · Detailed Appraisal unlocked'
          : d.kind === DECISION.APPROVE ? 'Action Plan approved by Cluster Expert'
          : 'Action Plan sent back to GT for revisions'
        ),
      })
      setToast({ severity: 'success', msg: `${d.label} · recorded.` })
      setComment('')
    } catch (err) {
      setToast({ severity: 'error', msg: err?.message || 'Failed to record decision.' })
    } finally {
      setBusyKind(null)
    }
  }, [comment, matrixId, registrationId, dto, decideM, otherTrackApproved, compositeStageId])

  return (
    <>
      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          mt: 3,
          mx: { xs: -1, md: -1.5 },
          background: theme.palette.background.paper,
          borderTop: 1,
          borderColor: alpha(theme.palette.text.primary, 0.09),
          px: { xs: 2.5, md: 4 },
          py: 2.25,
          zIndex: 10,
          boxShadow: '0 -6px 20px rgba(0,0,0,0.06)',
        }}
      >
        {/* UAT 2026-10-02 item 63 — same composite warning as the
            SustainabilityTab's decision bar. When the sustainability
            matrix is already CE-approved, approving the Action Plan
            fires the composite stageId → both tracks complete and the
            IA moves to Detailed Appraisal in one write. Surface a clear
            info strip so this isn't a silent cascade from the CE's
            point of view. */}
        {otherTrackApproved && compositeStageId != null && (
          <Box
            sx={{
              mb: 1.5, px: 1.5, py: 1, borderRadius: 1,
              bgcolor: alpha(theme.palette.info.main, 0.08),
              border: 1, borderColor: alpha(theme.palette.info.main, 0.3),
              color: theme.palette.info.dark,
              fontSize: 12.5, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 0.75,
            }}
          >
            <Box component="span" sx={{ fontSize: 10 }}>●</Box>
            Sustainability Matrix has already been approved. Approving the Action Plan now will mark both tracks complete and advance this IA to Detailed Appraisal.
          </Box>
        )}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 1.5, md: 3 }} alignItems={{ md: 'center' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.palette.text.disabled, mb: 0.5 }}>
              Cluster Expert comment
            </Typography>
            {/* Same 500-char cap + counter as SustainabilityTab for the
                same backend `stageComments` column. */}
            <TextField
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 500))}
              placeholder="Required if sending back to GT · optional on approval"
              fullWidth
              size="small"
              multiline
              minRows={1}
              maxRows={4}
              inputProps={{ maxLength: 500 }}
              helperText={`${comment.length} / 500`}
              FormHelperTextProps={{
                sx: {
                  textAlign: 'right',
                  color: comment.length >= 500 ? 'error.main' : 'text.disabled',
                  m: 0, mt: 0.25, fontSize: 11,
                },
              }}
            />
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0, alignSelf: { xs: 'flex-end', md: 'auto' } }}>
            {decisions.map((d) => {
              const busy = busyKind === d.kind
              const disabled = busyKind !== null
              const variant = d.kind === DECISION.APPROVE ? 'contained' : 'outlined'
              const color = d.kind === DECISION.APPROVE ? 'success' : 'warning'
              const willFireComposite = d.kind === DECISION.APPROVE && otherTrackApproved && compositeStageId != null
              const label = busy
                ? 'Recording…'
                : (willFireComposite ? 'Approve & advance to Detailed Appraisal' : d.label)
              return (
                <Button
                  key={d.kind + d.to}
                  onClick={() => decide(d)}
                  disabled={disabled}
                  variant={variant}
                  color={color}
                  disableElevation
                  startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
                  sx={{ textTransform: 'none', fontWeight: 700, minWidth: willFireComposite ? 268 : 148, py: 1, borderRadius: 1.5 }}
                >
                  {label}
                </Button>
              )
            })}
          </Stack>
        </Stack>
      </Box>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  )
})

// ── Small local components ──────────────────────────────────────────────

function StatusBanner({ tone, title, body }) {
  const theme = useTheme()
  const palette = theme.palette[tone] || theme.palette.info
  return (
    <Box
      sx={{
        mt: 2,
        mb: 2,
        borderRadius: 2,
        border: 1,
        borderColor: alpha(palette.main, 0.35),
        background: alpha(palette.main, 0.07),
        px: { xs: 3, md: 4 },
        py: { xs: 2, md: 2.5 },
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        {tone === 'success' && <CheckCircleRoundedIcon sx={{ color: palette.dark, fontSize: 24 }} />}
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: palette.dark, letterSpacing: '-0.01em' }}>
            {title}
          </Typography>
          <Typography sx={{ mt: 0.25, fontSize: 13.5, color: theme.palette.text.secondary }}>
            {body}
          </Typography>
        </Box>
      </Stack>
    </Box>
  )
}

function ReviewerRemarkBanner({ tone, title, body, remark }) {
  const theme = useTheme()
  const palette = theme.palette[tone] || theme.palette.warning
  return (
    <Box
      sx={{
        mt: 2,
        mb: 2,
        borderRadius: 2,
        border: 1,
        borderColor: alpha(palette.main, 0.4),
        background: alpha(palette.main, 0.08),
        px: { xs: 3, md: 4 },
        py: { xs: 2, md: 2.5 },
      }}
    >
      <Typography
        sx={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: palette.dark,
        }}
      >
        {title}
      </Typography>
      <Typography sx={{ mt: 0.5, fontSize: 15, fontWeight: 700, color: theme.palette.text.primary, letterSpacing: '-0.01em' }}>
        {body}
      </Typography>
      {remark ? (
        <Box
          sx={{
            mt: 1.5,
            borderRadius: 1.25,
            border: 1,
            borderColor: alpha(palette.main, 0.3),
            background: '#fff',
            px: 1.75,
            py: 1.25,
          }}
        >
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: palette.dark, mb: 0.25 }}>
            Reviewer remarks
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: theme.palette.text.primary, whiteSpace: 'pre-wrap' }}>
            {remark}
          </Typography>
        </Box>
      ) : (
        <Typography sx={{ mt: 0.75, fontSize: 13, color: theme.palette.text.secondary }}>
          No specific remarks were left — reach out to the Cluster Expert for guidance.
        </Typography>
      )}
    </Box>
  )
}

function Notice({ title, body }) {
  return (
    <Box sx={{ maxWidth: 540, mx: 'auto', mt: 4, p: 4, border: 1, borderColor: 'divider', borderRadius: 2, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{title}</Typography>
      <Typography sx={{ fontSize: 13.5, color: 'text.secondary', mt: 1 }}>{body}</Typography>
    </Box>
  )
}

function Toast({ toast, onClose }) {
  return (
    <Snackbar
      open={!!toast}
      autoHideDuration={7000}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      {toast ? (
        <Alert severity={toast.severity} variant="filled" onClose={onClose}>
          {toast.msg}
        </Alert>
      ) : undefined}
    </Snackbar>
  )
}
