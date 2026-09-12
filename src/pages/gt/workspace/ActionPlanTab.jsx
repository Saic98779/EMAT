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
  // Only surface the CE decision bar when there's actually a live CE
  // decision available at the current sub-stage. This mirrors the L2
  // pattern in AppraisalTab.
  const decisions = (ws.decisionsForCurrent || []).filter(
    (d) => d.kind === DECISION.APPROVE || d.kind === DECISION.REVERT,
  )
  const isCeReviewer = decisions.length > 0

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
  // after CE revert. Anyone else (CE reviewing at ACTION_PLAN_SUBMITTED,
  // downstream roles after approval) sees a read-only checklist.
  const gtCanEdit = !isCeReviewer && (actionPlanStatus === STATUS.NOT_STARTED || isReverted)

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
        />
      )}

      {/* If GT is here after CE-approval, offer a shortcut into Appraisal. */}
      {isApproved && !isCeReviewer && (
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
  const theme = useTheme()
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

// Checklist container — subtle card with a header strip that also acts as
// the selection counter. Rows sit inside with hairline dividers.
function ChecklistCard({ title, subtitle, selectedCount, children }) {
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
          px: { xs: 2.25, md: 3 },
          py: 2,
          borderBottom: 1,
          borderColor: alpha(theme.palette.text.primary, 0.06),
          background: alpha(theme.palette.text.primary, 0.015),
        }}
      >
        <Stack direction="row" alignItems="baseline" spacing={1.5} flexWrap="wrap">
          <Typography sx={{ fontSize: 15.5, fontWeight: 700, letterSpacing: '-0.01em' }}>
            {title}
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: theme.palette.text.disabled, fontWeight: 500 }}>
            {selectedCount} of {ACTION_PLAN_ITEMS.length} selected
          </Typography>
        </Stack>
        {subtitle && (
          <Typography sx={{ mt: 0.5, fontSize: 13, color: theme.palette.text.secondary }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      <Box>{children}</Box>
    </Box>
  )
}

// Row shell shared by PlainRow + OthersRow. Two columns: checkbox column
// (fixed width) + label column (fluid). No third column. Selected rows
// get a subtle primary tint + a left-border accent.
const rowShellSx = (theme, checked) => ({
  display: 'grid',
  gridTemplateColumns: '44px 1fr',
  alignItems: 'flex-start',
  columnGap: 1.5,
  px: { xs: 2, md: 2.5 },
  py: 1.75,
  position: 'relative',
  background: checked ? alpha(theme.palette.primary.main, 0.045) : 'transparent',
  transition: 'background 120ms ease',
  '&:hover': {
    background: checked
      ? alpha(theme.palette.primary.main, 0.06)
      : alpha(theme.palette.text.primary, 0.02),
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
  return (
    <>
      <Box sx={rowShellSx(theme, checked)}>
        <Checkbox
          checked={checked}
          onChange={() => onToggle(item.key)}
          size="small"
          sx={{ p: 0.5, mt: -0.5 }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: theme.palette.text.disabled, letterSpacing: '0.03em', mb: 0.25 }}>
            {String(index).padStart(2, '0')}
          </Typography>
          <Typography sx={{ fontSize: 14, lineHeight: 1.5, color: theme.palette.text.primary }}>
            {item.label}
          </Typography>
        </Box>
      </Box>
      <Divider sx={{ borderColor: alpha(theme.palette.text.primary, 0.06) }} />
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

  return (
    <>
      <Box sx={rowShellSx(theme, checked)}>
        <Checkbox
          checked={checked}
          onChange={() => onToggle(item.key)}
          size="small"
          sx={{ p: 0.5, mt: -0.5 }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: theme.palette.text.disabled, letterSpacing: '0.03em', mb: 0.25 }}>
            {String(index).padStart(2, '0')}
          </Typography>
          <Typography sx={{ fontSize: 14, lineHeight: 1.5, color: theme.palette.text.primary }}>
            {item.label}
          </Typography>
          {checked && (
            <Box sx={{ mt: 1.5 }}>
              <TextField
                value={text}
                onChange={onInput}
                placeholder='Describe the "Others" activity — what the IA plans to run, expected outcome, funding pattern.'
                fullWidth
                multiline
                minRows={2}
                maxRows={6}
                size="small"
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
      {!last && <Divider sx={{ borderColor: alpha(theme.palette.text.primary, 0.06) }} />}
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

const CeDecisionBar = memo(function CeDecisionBar({ matrixId, registrationId, dto, decisions }) {
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
    if (d.stageId == null) {
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
        stageId: d.stageId,
        stageComments: trimmed || (d.kind === DECISION.APPROVE
          ? 'Action Plan approved by Cluster Expert'
          : 'Action Plan sent back to GT for revisions'),
      })
      setToast({ severity: 'success', msg: `${d.label} · recorded.` })
      setComment('')
    } catch (err) {
      setToast({ severity: 'error', msg: err?.message || 'Failed to record decision.' })
    } finally {
      setBusyKind(null)
    }
  }, [comment, matrixId, registrationId, dto, decideM])

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
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 1.5, md: 3 }} alignItems={{ md: 'center' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.palette.text.disabled, mb: 0.5 }}>
              Cluster Expert comment
            </Typography>
            <TextField
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 1000))}
              placeholder="Required if sending back to GT · optional on approval"
              fullWidth
              size="small"
              multiline
              minRows={1}
              maxRows={4}
            />
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0, alignSelf: { xs: 'flex-end', md: 'auto' } }}>
            {decisions.map((d) => {
              const busy = busyKind === d.kind
              const disabled = busyKind !== null
              const variant = d.kind === DECISION.APPROVE ? 'contained' : 'outlined'
              const color = d.kind === DECISION.APPROVE ? 'success' : 'warning'
              return (
                <Button
                  key={d.kind + d.to}
                  onClick={() => decide(d)}
                  disabled={disabled}
                  variant={variant}
                  color={color}
                  disableElevation
                  startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
                  sx={{ textTransform: 'none', fontWeight: 700, minWidth: 148, py: 1, borderRadius: 1.5 }}
                >
                  {busy ? 'Recording…' : d.label}
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
      autoHideDuration={4200}
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
