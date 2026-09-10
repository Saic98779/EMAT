import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Snackbar, Stack, Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { categorise, DIMENSIONS, PARAM_KEYS, TIERS } from '../../../apis/eligibilityMatrix'
import { createIndustryAssociation } from '../../../apis/industryAssociations'
import { STAGE } from '../../../apis/registrationStages'
import { stageIdForStage } from '../../../apis/stageActions'
import { useAllStages, useCreateEligibilityMatrix, keys } from '../../../queries'
import { useIaWorkspace } from '../../../components/workspace/IaWorkspaceLayout'
import IdentityFields from './eligibility/IdentityFields'
import ParameterGroup from './eligibility/ParameterGroup'
import LiveScorePanel from './eligibility/LiveScorePanel'
import MatrixSubmitBar from './eligibility/MatrixSubmitBar'
import { FIELDS, LABELS, validateAll } from './eligibility/validation'

// EligibilityTab
// ────────────────────────────────────────────────────────────────────────
// The Eligibility Matrix tab inside the IA workspace.
//
// Two runtime states:
//   • Creation — identity fields on top, 22 parameters below, live score
//                panel on the right. Submit does the two-step create
//                (IA registration → eligibility matrix).
//   • Result   — read-only summary of a previously submitted matrix.
//
// When the workspace context reports `eligibility` is already present,
// we render the ResultView directly; otherwise the creation flow.
//
// All identity fields validate inline (no spaces in PAN / email;
// required checks). Submit is disabled until every field and every
// parameter is answered — the surrounding form never reaches the
// backend in a half-filled state.

const INITIAL_HEADER = { ia_name: '', state: '', pan_no: '', email: '' }
const INITIAL_ANSWERS = PARAM_KEYS.reduce((acc, k) => ({ ...acc, [k]: null }), {})

export default function EligibilityTab() {
  const ws = useIaWorkspace()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const createMatrix = useCreateEligibilityMatrix()
  // Master stage list — used to translate the ELIGIBILITY_MATRIX stage
  // enum into the numeric `stageId` the backend expects on the POST.
  // Without this the backend saves `stageId: null` and stage-history
  // stays empty, which breaks the workflow timeline downstream.
  const stagesQ = useAllStages()

  // Result mode is entered as soon as the workspace tells us this IA has
  // a saved eligibility record. New IAs land in creation mode.
  const showResult = !!ws.eligibility

  // ── Header (identity) state ──────────────────────────────────────────
  const [header, setHeader] = useState(() => seedHeaderFromIa(ws.ia) || INITIAL_HEADER)
  const [headerErrors, setHeaderErrors] = useState({})
  const [touched, setTouched] = useState({})

  // Keep header in sync if IA data arrives after mount (edit flow).
  useEffect(() => {
    if (!ws.ia) return
    const seeded = seedHeaderFromIa(ws.ia)
    if (seeded) setHeader((prev) => ({ ...seeded, ...prev }))
  }, [ws.ia])

  const setHeaderField = useCallback((name, value) => {
    setHeader((prev) => (prev[name] === value ? prev : { ...prev, [name]: value }))
    // Clear the error the moment the user starts fixing it — the blur
    // handler will re-validate.
    setHeaderErrors((prev) => (prev[name] ? { ...prev, [name]: '' } : prev))
  }, [])

  const setBlur = useCallback((name, error) => {
    setTouched((prev) => (prev[name] ? prev : { ...prev, [name]: true }))
    setHeaderErrors((prev) => ({ ...prev, [name]: error }))
  }, [])

  // ── Parameter answers ────────────────────────────────────────────────
  const [answers, setAnswers] = useState(INITIAL_ANSWERS)
  const [expanded, setExpanded] = useState(
    () => DIMENSIONS.reduce((acc, d) => ({ ...acc, [d.title]: true }), {}),
  )

  const onAnswer = useCallback((paramKey, next) => {
    setAnswers((prev) => (prev[paramKey] === next ? prev : { ...prev, [paramKey]: next }))
  }, [])

  // Pre-bake one toggle handler per dimension so ParameterGroup receives
  // referentially stable `onToggle` props and skips re-render on unrelated
  // state changes (identity-field typing, live score updates, etc.).
  const toggleHandlers = useMemo(
    () => DIMENSIONS.reduce((acc, d) => {
      acc[d.title] = () => setExpanded((prev) => ({ ...prev, [d.title]: !prev[d.title] }))
      return acc
    }, {}),
    [],
  )

  // ── Derived state ────────────────────────────────────────────────────
  const { score, tier } = useMemo(() => categorise(answers), [answers])
  const answered = useMemo(
    () => PARAM_KEYS.filter((k) => answers[k] === true || answers[k] === false).length,
    [answers],
  )
  const allAnswered = answered === PARAM_KEYS.length

  // Submit gate: all header fields valid + every param answered.
  const canSubmit = useMemo(() => {
    if (!allAnswered) return false
    const errors = validateAll(header)
    return Object.keys(errors).length === 0
  }, [allAnswered, header])

  // ── Submit ──────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)
  const [createdIaId, setCreatedIaId] = useState(null)
  const [toast, setToast] = useState(null)

  // Keep every value the submit closure needs in a ref so `submit` itself
  // stays referentially stable across keystrokes. Otherwise `header` in the
  // deps would rebuild `submit` on every character and force LiveScorePanel
  // + MatrixSubmitBar to re-render on each input event.
  const submitStateRef = useRef({
    header, allAnswered, createdIaId, iaId: ws.iaId, createMatrix, answers, qc, navigate,
    allStages: stagesQ.data, basePath: ws.basePath || '/gt',
  })
  submitStateRef.current = {
    header, allAnswered, createdIaId, iaId: ws.iaId, createMatrix, answers, qc, navigate,
    allStages: stagesQ.data, basePath: ws.basePath || '/gt',
  }

  const submit = useCallback(async () => {
    const s = submitStateRef.current
    // Force full validation + touched so any pending errors surface.
    const errors = validateAll(s.header)
    setHeaderErrors(errors)
    setTouched(FIELDS.reduce((acc, f) => ({ ...acc, [f]: true }), {}))
    if (Object.keys(errors).length) {
      setToast({ severity: 'warning', msg: 'Please fix the highlighted fields.' })
      return
    }
    if (!s.allAnswered) {
      setToast({ severity: 'warning', msg: 'Answer every parameter before submitting.' })
      return
    }

    setSubmitting(true)
    try {
      // Two-step create: IA record first (identity fields), then the
      // eligibility record linked to the returned registrationId. If
      // step 2 fails, remember the created IA id so retry doesn't
      // duplicate the parent record.
      // Two stage ids — separate audit rows for the two backend writes:
      //   • `iaStageId` — base ELIGIBILITY_MATRIX row (IA registration).
      //   • `matrixStageId` — the *_SUBMITTED sub-stage (matrix filed).
      // If the backend only exposes one row for the stage, the fallback
      // in `stageIdForStage` returns the same id for both, which is fine.
      const iaStageId = stageIdForStage(s.allStages, STAGE.ELIGIBILITY_MATRIX)
      const matrixStageId = stageIdForStage(s.allStages, STAGE.ELIGIBILITY_MATRIX, 'ELIGIBILITY_MATRIX_SUBMITTED')

      let regId = s.createdIaId || s.iaId
      if (!regId) {
        const resp = await createIndustryAssociation({
          state: s.header.state.trim(),
          ia_name: s.header.ia_name.trim(),
          pan_no: s.header.pan_no.trim(),
          email: s.header.email.trim(),
          stageId: iaStageId,
        })
        regId = resp?.id || resp?.uuid
        if (!regId) throw new Error('IA created but the response was missing an id.')
        setCreatedIaId(regId)
      }

      await s.createMatrix.mutateAsync({
        ...s.answers,
        registrationId: regId,
        stageId: matrixStageId,
      })
      s.qc.invalidateQueries({ queryKey: keys.ias.all, refetchType: 'all' })
      s.qc.invalidateQueries({ queryKey: keys.ias.stageHistory(regId) })

      setToast({
        severity: 'success',
        msg: 'Eligibility matrix submitted. Opening the Registration form…',
      })
      setTimeout(() => s.navigate(`${s.basePath}/ias/${regId}/workspace/l1`), 900)
    } catch (err) {
      const stage = submitStateRef.current.createdIaId ? 'eligibility save' : 'IA creation'
      setToast({ severity: 'error', msg: err?.message || `Failed during ${stage}.` })
    } finally {
      setSubmitting(false)
    }
  }, [])

  const onContinueFromResult = useCallback(() => {
    if (!ws.iaId) return
    navigate(`${ws.basePath || '/gt'}/ias/${ws.iaId}/workspace/l1`)
  }, [navigate, ws.iaId])

  // ── Render ──────────────────────────────────────────────────────────
  if (showResult) {
    // Derive the tier from the PERSISTED score, not from the local
    // (post-submit-reset) answers state. Otherwise every submitted
    // matrix would render as "Weak" because local answers are all
    // null after submit → local score is 0 → local tier is Weak.
    const persistedScore = ws.eligibility.totalScore ?? score
    const persistedTier = TIERS.find((t) => persistedScore >= t.min) || TIERS[TIERS.length - 1]
    return (
      <>
        <ReadOnlyMatrix
          title="Eligibility Matrix"
          score={persistedScore}
          tier={persistedTier}
          tiers={TIERS}
          dimensions={DIMENSIONS}
          answers={ws.eligibility}
          submittedBy={ws.eligibility.createdBy || ws.ia?.createdBy}
          submittedAt={ws.eligibility.createdAt || ws.ia?.submitted}
        />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    )
  }

  return (
    <>
      {/* CSS grid: questions on the left, sticky score panel on the right.
          `alignItems: start` keeps the right column from stretching to
          match the questions column height — the panel sits at its own
          intrinsic size and the workspace's white background fills the
          rest, so there's no visible dead-space rectangle. */}
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
          <Section title="Association details">
            <IdentityFields
              values={header}
              errors={headerErrors}
              touched={touched}
              onChange={setHeaderField}
              onBlur={setBlur}
              disabled={submitting}
            />
          </Section>

          <Section
            title="Eligibility parameters"
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

      {/* Sticky footer echoes the Submit action so it's reachable no
          matter which section the user is scrolled to on mobile. */}
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

// ── Local helpers ───────────────────────────────────────────────────────

// Read-only view of a submitted matrix (Eligibility or Sustainability).
// Same ParameterGroup checklist the user filled during entry, in
// read-only mode. Compact score header at the top for context.
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

function seedHeaderFromIa(ia) {
  if (!ia?.raw) return null
  const r = ia.raw
  return {
    ia_name: r.industryAssociationName || '',
    state: r.state || '',
    pan_no: r.panNo || r.pan || '',
    email: r.email || r.apexHolderEmail || '',
  }
}

// Silence the unused-import complaint for LABELS — kept in the module so
// downstream test files can import it from this barrel-adjacent location.
void LABELS
