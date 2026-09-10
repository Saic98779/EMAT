import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, CircularProgress, Snackbar, Stack, Typography,
} from '@mui/material'
import {
  categorise, DIMENSIONS, PARAM_KEYS, TIERS,
} from '../../../apis/sustainabilityMatrix'
import { toCreatePayload as toAppraisalCreatePayload } from '../../../apis/industryAssociationAppraisals'
import { STAGE } from '../../../apis/registrationStages'
import { stageIdForStage } from '../../../apis/stageActions'
import { STATUS } from '../../../apis/workflow'
import {
  useAllStages, useAppraisalByRegistration, useCreateAppraisal, useCreateSustainabilityMatrix,
  useSustainabilityMatrixByAppraisal, keys,
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
        msg: 'Sustainability matrix submitted. Opening Detailed Appraisal…',
      })
      setTimeout(() => s.navigate(`${s.basePath}/ias/${s.iaId}/workspace/appraisal`), 900)
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
