import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Button, CircularProgress, Snackbar, Stack, TextField, Typography,
} from '@mui/material'
import {
  categorise, DIMENSIONS, PARAM_KEYS, TIERS,
} from '../../../apis/sustainabilityMatrix'
import { toCreatePayload as toAppraisalCreatePayload } from '../../../apis/industryAssociationAppraisals'
import { STAGE } from '../../../apis/registrationStages'
import { DECISION, stageIdForStage, stageIdOf } from '../../../apis/stageActions'
import { STATUS } from '../../../apis/workflow'
import {
  useAllStages, useAppraisalByRegistration, useCreateAppraisal, useCreateSustainabilityMatrix,
  useDecideActionPlan, useSustainabilityMatrixByAppraisal, keys,
} from '../../../queries'
import { useIaWorkspace } from '../../../components/workspace/IaWorkspaceLayout'
import ParameterGroup from './eligibility/ParameterGroup'
import LiveScorePanel from './eligibility/LiveScorePanel'
import MatrixSubmitBar from './eligibility/MatrixSubmitBar'
import { alpha, useTheme } from '@mui/material/styles'

// SustainabilityTab
// ────────────────────────────────────────────────────────────────────────
// Same scoring-matrix pattern as EligibilityTab — the twenty-two questions
// live in `apis/sustainabilityMatrix.js`. On submit the frontend has to
// materialise an appraisal shell first (matrix FK's to appraisalId, not
// to the IA registration), then post the matrix. If the shell already
// exists (GT started the appraisal), we reuse it.

const INITIAL_ANSWERS = PARAM_KEYS.reduce((acc, k) => ({ ...acc, [k]: null }), {})

export default function SustainabilityTab() {
  const ws = useIaWorkspace()
  const navigate = useNavigate()
  const qc = useQueryClient()

  // Fetch appraisal (may be null pre-shell) and any existing matrix on it.
  const apprQ = useAppraisalByRegistration(ws.iaId)
  const appraisalId = apprQ.data?.id ?? null
  const existingMatrixQ = useSustainabilityMatrixByAppraisal(appraisalId)

  const createAppraisal = useCreateAppraisal()
  const createMatrix = useCreateSustainabilityMatrix()
  // Master stage list → resolves the numeric `stageId` for the POST so the
  // backend can write a stage-history row. Otherwise stageId ships as null.
  const stagesQ = useAllStages()

  const [answers, setAnswers] = useState(INITIAL_ANSWERS)
  const [expanded, setExpanded] = useState(() =>
    DIMENSIONS.reduce((acc, d) => ({ ...acc, [d.title]: true }), {}),
  )
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  const onAnswer = useCallback((key, next) => {
    setAnswers((prev) => (prev[key] === next ? prev : { ...prev, [key]: next }))
  }, [])
  // Pre-bake one toggle handler per dimension so ParameterGroup receives
  // stable `onToggle` props and skips re-render on unrelated state changes.
  const toggleHandlers = useMemo(
    () => DIMENSIONS.reduce((acc, d) => {
      acc[d.title] = () => setExpanded((prev) => ({ ...prev, [d.title]: !prev[d.title] }))
      return acc
    }, {}),
    [],
  )

  const { score, tier } = useMemo(() => categorise(answers), [answers])
  const answered = useMemo(
    () => PARAM_KEYS.filter((k) => answers[k] === true || answers[k] === false).length,
    [answers],
  )
  const allAnswered = answered === PARAM_KEYS.length
  const canSubmit = allAnswered && !submitting && !ws.isNew

  const showResult = !!existingMatrixQ.data
  const onContinueFromResult = useCallback(() => {
    if (!ws.iaId) return
    navigate(`${ws.basePath || '/gt'}/ias/${ws.iaId}/workspace/appraisal`)
  }, [navigate, ws.iaId, ws.basePath])

  // Ref-mirror the changing dependencies so `submit` itself stays stable —
  // otherwise the memoized LiveScorePanel + MatrixSubmitBar re-render on
  // every answer change because their onSubmit prop is a fresh function.
  const submitStateRef = useRef({
    allAnswered, appraisalId, createAppraisal, createMatrix, answers,
    iaId: ws.iaId, qc, navigate, allStages: stagesQ.data,
    basePath: ws.basePath || '/gt',
  })
  submitStateRef.current = {
    allAnswered, appraisalId, createAppraisal, createMatrix, answers,
    iaId: ws.iaId, qc, navigate, allStages: stagesQ.data,
    basePath: ws.basePath || '/gt',
  }

  const submit = useCallback(async () => {
    const s = submitStateRef.current
    if (!s.allAnswered) {
      setToast({ severity: 'warning', msg: 'Answer every parameter before submitting.' })
      return
    }
    setSubmitting(true)
    try {
      let apprId = s.appraisalId
      if (!apprId) {
        const shell = await s.createAppraisal.mutateAsync(toAppraisalCreatePayload({}, s.iaId))
        apprId = shell?.id
        if (!apprId) throw new Error('Appraisal shell created but response was missing an id.')
      }

      // Resolve the numeric stageId for the audit row. Prefer the explicit
      // SUSTAINABILITY_MATRIX_SUBMITTED sub-stage; fall back to any row for
      // the stage so a backend enum rename can't silently drop us to null.
      const stageId = stageIdForStage(s.allStages, STAGE.SUSTAINABILITY_MATRIX, 'SUSTAINABILITY_MATRIX_SUBMITTED')
      await s.createMatrix.mutateAsync({
        ...s.answers,
        appraisalId: apprId,
        stageId,
      })
      s.qc.invalidateQueries({ queryKey: keys.ias.all, refetchType: 'all' })
      s.qc.invalidateQueries({ queryKey: keys.ias.stageHistory(s.iaId) })

      setToast({
        severity: 'success',
        msg: 'Sustainability matrix submitted. Opening Action Plan…',
      })
      setTimeout(() => s.navigate(`${s.basePath}/ias/${s.iaId}/workspace/action-plan`), 900)
    } catch (err) {
      const label = submitStateRef.current.appraisalId ? 'matrix save' : 'appraisal shell / matrix save'
      setToast({ severity: 'error', msg: err?.message || `Failed during ${label}.` })
    } finally {
      setSubmitting(false)
    }
  }, [])

  // ── Render ──────────────────────────────────────────────────────────
  if (ws.isNew) {
    return <Notice title="Complete Eligibility Matrix first" body="Sustainability opens after L1 is approved." />
  }
  // Gate: Sustainability opens only once the In-Principle Approval (L1)
  // stage is fully approved. Rendering it earlier lets GT submit against
  // an IA that reviewers haven't cleared yet — which the backend then
  // rejects on the appraisal shell create, but the UX should stop us
  // long before that.
  const l1Stage = ws.workflow?.stages?.find((s) => s.key === STAGE.IN_PRINCIPLE_APPROVAL_OF_IA)
  const l1Approved = l1Stage?.status === STATUS.COMPLETED
  if (!l1Approved) {
    const heading = l1Stage?.status === STATUS.IN_PROGRESS
      ? 'In-Principle Approval is still under review'
      : 'Complete In-Principle Approval (L1) first'
    const body = l1Stage?.status === STATUS.IN_PROGRESS
      ? 'The SDE hasn’t signed off on L1 yet. Sustainability opens once that approval is on record.'
      : 'Finish the In-Principle form and get it approved — Sustainability opens after that.'
    return <Notice title={heading} body={body} />
  }
  if (apprQ.isLoading || existingMatrixQ.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={22} />
      </Box>
    )
  }

  if (showResult) {
    const dto = existingMatrixQ.data || {}
    // Derive tier from the PERSISTED score, not from the local (empty)
    // answers state — otherwise every submitted matrix would read as
    // "Weak" because local answers reset to null after submit.
    const persistedScore = dto.totalScore ?? score
    const persistedTier = TIERS.find((t) => persistedScore >= t.min) || TIERS[TIERS.length - 1]
    // CE decision affordance — UAT 2026-10-02 bugfix.
    //
    // Why we don't use `ws.decisionsForCurrent` here anymore: that lookup
    // reads from `ia.currentStage`, which is a SINGLE enum value. In the
    // parallel sustainability + action-plan tracks, `currentStage`
    // reflects whichever sub-stage was most recently written. When both
    // tracks are submitted, only ONE track has decisions available, and
    // the OTHER tab was inheriting those decisions by kind — meaning
    // clicking "Approve" on Sustainability could actually fire the
    // Action Plan sub-stage transition. Classic UAT item 63 cause.
    //
    // Fix: derive CE decisions from THIS track's own sub-stage state
    // (via the workflow helper), independent of `currentStage`. CE sees
    // the Approve/Revert/Reject bar on sustainability if and only if GT
    // has submitted the sustainability matrix AND no CE decision has
    // been recorded on it yet.
    const isCeViewer = ws.viewerRole === 'CLUSTER_EXPERT'
    const sustainabilityStage = ws.workflow?.stages?.find((x) => x.key === STAGE.SUSTAINABILITY_MATRIX)
    const sustainabilitySubmissionDone = sustainabilityStage?.subStages?.[0]?.status === STATUS.COMPLETED
    const sustainabilityCeDone = sustainabilityStage?.subStages?.[1]?.status === STATUS.COMPLETED
    const sustainabilityNeedsCe = isCeViewer && sustainabilitySubmissionDone && !sustainabilityCeDone
      && sustainabilityStage?.status !== STATUS.REJECTED
    const ceDecisions = useMemo(() => {
      if (!sustainabilityNeedsCe) return []
      const build = (to, kind, label) => {
        const stageId = stageIdOf(stagesQ.data, to)
        return stageId != null ? { kind, to, label, stageId } : null
      }
      return [
        build('SUSTAINABILITY_MATRIX_APPROVED', DECISION.APPROVE, 'Approve sustainability'),
        build('SUSTAINABILITY_MATRIX_REVERTED', DECISION.REVERT,  'Send back to GT'),
        build('SUSTAINABILITY_MATRIX_REJECTED', DECISION.REJECT,  'Reject'),
      ].filter(Boolean)
    }, [sustainabilityNeedsCe, stagesQ.data])
    const isCeReviewer = ceDecisions.length > 0
    // Composite completion — if action plan is already CE-approved,
    // this sustainability approve should advance the IA all the way to
    // Detailed Appraisal via stageId 20 (SUSTAINABILITY_MATRIX_AND_ACTION_PLAN_COMPLETED).
    // Backend doesn't auto-advance; frontend has to send the composite
    // stageId explicitly on the "last" approval (confirmed by Sameer 2026-09-27).
    const actionPlanStage = ws.workflow?.stages?.find((x) => x.key === STAGE.ACTION_PLAN)
    const actionPlanApproved = actionPlanStage?.status === STATUS.COMPLETED
    const compositeStageId = stageIdOf(stagesQ.data, 'SUSTAINABILITY_MATRIX_AND_ACTION_PLAN_COMPLETED')
    return (
      <>
        <ReadOnlyMatrix
          title="Sustainability Matrix"
          score={persistedScore}
          tier={persistedTier}
          tiers={TIERS}
          dimensions={DIMENSIONS}
          answers={dto}
          submittedBy={dto.createdBy || ws.ia?.createdBy}
          submittedAt={dto.createdAt}
        />
        {isCeReviewer && (
          <CeSustainabilityDecisionBar
            matrixId={dto.id}
            registrationId={ws.iaId}
            dto={dto}
            decisions={ceDecisions}
            otherTrackApproved={actionPlanApproved}
            compositeStageId={compositeStageId}
          />
        )}
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    )
  }

  return (
    <>
      {/* Questions on the left, sticky score on the right (see
          EligibilityTab for the layout rationale). */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 320px' },
          columnGap: { xs: 3, md: 5 },
          rowGap: 4,
          alignItems: 'start',
        }}
      >
        <Stack spacing={5} sx={{ minWidth: 0 }}>
          <Section
            title="Sustainability parameters"
            subtitle={`${answered} of ${PARAM_KEYS.length} answered`}
          >
            {DIMENSIONS.map((dim) => (
              <ParameterGroup
                key={dim.title}
                title={dim.title}
                params={dim.params}
                answers={answers}
                expanded={!!expanded[dim.title]}
                onToggle={toggleHandlers[dim.title]}
                onAnswer={onAnswer}
              />
            ))}
          </Section>
        </Stack>

        <LiveScorePanel
          score={score}
          tier={tier}
          tiers={TIERS}
          answered={answered}
          total={PARAM_KEYS.length}
          canSubmit={canSubmit}
          submitting={submitting}
          onSubmit={submit}
        />
      </Box>

      <MatrixSubmitBar
        answered={answered}
        total={PARAM_KEYS.length}
        canSubmit={canSubmit}
        submitting={submitting}
        onSubmit={submit}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  )
}

// ── Small local components ──────────────────────────────────────────────

// Read-only view of the submitted matrix — same ParameterGroup checklist
// GT used, in read-only mode. Compact score header for context.
function ReadOnlyMatrix({ title, score, tier, tiers = [], dimensions = [], answers = {}, submittedBy, submittedAt }) {
  const theme = useTheme()
  const activeTier = tier || tiers[tiers.length - 1] || { label: '—', color: 'info' }
  const tierPalette = theme.palette[activeTier.color] || theme.palette.info
  const noop = useCallback(() => {}, [])
  return (
    <Box>
      <Box
        sx={{
          mt: 1,
          mb: 3,
          px: 2.5,
          py: 2,
          borderRadius: 2,
          border: 1,
          borderColor: alpha(theme.palette.text.primary, 0.09),
          background: '#fff',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
          <Typography sx={{ fontSize: 15.5, fontWeight: 700 }}>{title}</Typography>
          <Box
            sx={{
              fontSize: 12.5,
              fontWeight: 600,
              px: 1.25,
              py: 0.375,
              borderRadius: 0.75,
              background: alpha(tierPalette.main, 0.16),
              color: tierPalette.dark,
            }}
          >
            {score}% · {activeTier.label}
          </Box>
          <Box sx={{ flex: 1 }} />
          {(submittedBy || submittedAt) && (
            <Typography sx={{ fontSize: 12.5, color: theme.palette.text.disabled }}>
              {submittedBy ? `Submitted by ${submittedBy}` : ''}
              {submittedBy && submittedAt ? ' · ' : ''}
              {submittedAt ? formatSubmitted(submittedAt) : ''}
            </Typography>
          )}
        </Stack>
      </Box>

      <Stack spacing={2.5}>
        {dimensions.map((dim) => (
          <ParameterGroup
            key={dim.title}
            title={dim.title}
            params={dim.params}
            answers={answers}
            expanded
            onToggle={noop}
            onAnswer={noop}
            readOnly
          />
        ))}
      </Stack>
    </Box>
  )
}

function formatSubmitted(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.valueOf())) return String(iso)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function Section({ title, subtitle, children }) {
  return (
    <Box component="section">
      <Stack direction="row" alignItems="baseline" spacing={1.5}>
        <Typography sx={{ fontSize: 15.5, fontWeight: 700 }}>{title}</Typography>
        {subtitle && (
          <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>{subtitle}</Typography>
        )}
      </Stack>
      <Box sx={{ mt: 2 }}>{children}</Box>
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
      autoHideDuration={5000}
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

// ── CE decision bar (sustainability matrix) ─────────────────────────────
// Mirrors the ActionPlanTab's CeDecisionBar. Reuses `useDecideActionPlan`
// under the hood because that hook already handles the REPLACE-PUT dance
// (echoes every existing matrix boolean + preserves actionPlans / CE
// comment) and just passes `stageId` + `stageComments` through untouched.
// For sustainability we pass NO actionPlans and NO actionPlanCE comment
// — only the destination stageId (22 approve / 21 revert / 23 reject)
// and CE's remark as stageComments.
const CeSustainabilityDecisionBar = memo(function CeSustainabilityDecisionBar({ matrixId, registrationId, dto, decisions, otherTrackApproved, compositeStageId }) {
  const theme = useTheme()
  const decideM = useDecideActionPlan()
  const [comment, setComment] = useState('')
  const [busyKind, setBusyKind] = useState(null)
  const [toast, setToast] = useState(null)

  const decide = useCallback(async (d) => {
    const trimmed = comment.trim()
    if ((d.kind === DECISION.REVERT || d.kind === DECISION.REJECT) && !trimmed) {
      setToast({ severity: 'warning', msg: 'Please add a comment explaining the decision.' })
      return
    }
    // Composite advancement: if the OTHER track (action plan) is already
    // CE-approved and this decision is an APPROVE, send the composite
    // stageId instead of the individual sustainability APPROVED id — so
    // the IA jumps straight to Detailed Appraisal in one write. Backend
    // does not auto-advance; the frontend must fire the composite.
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
        dto, // echoed so the REPLACE-PUT preserves every matrix boolean
        stageId,
        stageComments: trimmed || (
          shouldComposite ? 'Both tracks approved by Cluster Expert · Detailed Appraisal unlocked'
          : d.kind === DECISION.APPROVE ? 'Sustainability matrix approved by Cluster Expert'
          : d.kind === DECISION.REVERT ? 'Sustainability matrix sent back to GT'
          : 'Sustainability matrix rejected by Cluster Expert'
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
        {/* UAT 2026-10-02 item 63 — when CE approves this (Stage 3)
            and Action Plan (Stage 4) is already CE-approved, the APPROVE
            path sends the composite stageId that marks BOTH stages done
            and advances the IA straight to Detailed Appraisal. Earlier
            this happened silently and read as "Stage 4 auto-approved
            without CE action". Surface a clear info strip so the CE
            knows what the click actually does. */}
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
            Action Plan has already been approved. Approving the Sustainability Matrix now will mark both tracks complete and advance this IA to Detailed Appraisal.
          </Box>
        )}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 1.5, md: 3 }} alignItems={{ md: 'center' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.palette.text.disabled, mb: 0.5 }}>
              Cluster Expert comment
            </Typography>
            {/* UAT 2026-10-02 item 64 — backend's `stageComments` column
                caps at 500 chars. Earlier the input accepted up to 1000
                with no counter, so users wrote long comments and were
                greeted with the "field too long" error on submit. Cap
                the slice to 500 AND show a live counter (red once over). */}
            <TextField
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 500))}
              placeholder="Required to revert or reject · optional on approval"
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
              const color   = d.kind === DECISION.APPROVE ? 'success'
                            : d.kind === DECISION.REJECT  ? 'error'
                            : 'warning'
              // Rename the APPROVE button when the composite path is live
              // so the CE knows the click doesn't just approve this stage.
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
