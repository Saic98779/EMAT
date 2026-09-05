import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Grid, Snackbar, Stack, Typography,
} from '@mui/material'
import { categorise, DIMENSIONS, PARAM_KEYS } from '../../../apis/eligibilityMatrix'
import { createIndustryAssociation } from '../../../apis/industryAssociations'
import { useCreateEligibilityMatrix, keys } from '../../../queries'
import { useIaWorkspace } from '../../../components/workspace/IaWorkspaceLayout'
import IdentityFields from './eligibility/IdentityFields'
import ParameterGroup from './eligibility/ParameterGroup'
import LiveScorePanel from './eligibility/LiveScorePanel'
import ResultView from './eligibility/ResultView'
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

const INITIAL_HEADER = { industryAssociationName: '', state: '', pan: '', emailId: '' }
const INITIAL_ANSWERS = PARAM_KEYS.reduce((acc, k) => ({ ...acc, [k]: null }), {})

export default function EligibilityTab() {
  const ws = useIaWorkspace()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const createMatrix = useCreateEligibilityMatrix()

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

  const onToggleGroup = useCallback((title) => () => {
    setExpanded((prev) => ({ ...prev, [title]: !prev[title] }))
  }, [])

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

  const submit = useCallback(async () => {
    // Force full validation + touched so any pending errors surface.
    const errors = validateAll(header)
    setHeaderErrors(errors)
    setTouched(FIELDS.reduce((acc, f) => ({ ...acc, [f]: true }), {}))
    if (Object.keys(errors).length) {
      setToast({ severity: 'warning', msg: 'Please fix the highlighted fields.' })
      return
    }
    if (!allAnswered) {
      setToast({ severity: 'warning', msg: 'Answer every parameter before submitting.' })
      return
    }

    setSubmitting(true)
    try {
      // Two-step create: IA record first (identity fields), then the
      // eligibility record linked to the returned registrationId. If
      // step 2 fails, remember the created IA id so retry doesn't
      // duplicate the parent record.
      let regId = createdIaId || ws.iaId
      if (!regId) {
        const resp = await createIndustryAssociation({
          state: header.state.trim(),
          industryAssociationName: header.industryAssociationName.trim(),
          pan: header.pan.trim(),
          emailId: header.emailId.trim(),
        })
        regId = resp?.id || resp?.uuid
        if (!regId) throw new Error('IA created but the response was missing an id.')
        setCreatedIaId(regId)
      }

      await createMatrix.mutateAsync({ ...answers, registrationId: regId })
      qc.invalidateQueries({ queryKey: keys.ias.all, refetchType: 'all' })

      setToast({
        severity: 'success',
        msg: 'Eligibility matrix submitted. Opening the Registration form…',
      })
      setTimeout(() => navigate(`/gt/ias/${regId}/workspace/l1`), 900)
    } catch (err) {
      const stage = createdIaId ? 'eligibility save' : 'IA creation'
      setToast({ severity: 'error', msg: err?.message || `Failed during ${stage}.` })
    } finally {
      setSubmitting(false)
    }
  }, [header, allAnswered, createdIaId, ws.iaId, createMatrix, qc, navigate, answers])

  const onSaveDraft = useCallback(() => {
    // Save-draft support depends on a backend column we don't have yet.
    // Kept as a real button so the interaction stays discoverable; when
    // the endpoint ships we swap this handler with the real one.
    setToast({
      severity: 'info',
      msg: 'Save-draft support will land alongside the backend endpoint. Values stay in this session for now.',
    })
  }, [])

  const onContinueFromResult = useCallback(() => {
    if (!ws.iaId) return
    navigate(`/gt/ias/${ws.iaId}/workspace/l1`)
  }, [navigate, ws.iaId])

  // ── Render ──────────────────────────────────────────────────────────
  if (showResult) {
    return (
      <>
        <ResultView
          score={ws.eligibility.totalScore ?? score}
          tier={tier}
          answers={ws.eligibility}
          submittedBy={ws.ia?.createdBy}
          submittedAt={ws.ia?.submitted}
          onContinue={onContinueFromResult}
        />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    )
  }

  return (
    <>
      <Grid container spacing={{ xs: 4, md: 6 }} alignItems="flex-start">
        <Grid item xs={12} md={8}>
          <Stack spacing={5}>
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
                  onToggle={onToggleGroup(dim.title)}
                  onAnswer={onAnswer}
                />
              ))}
            </Section>
          </Stack>
        </Grid>

        <Grid item xs={12} md={4}>
          <LiveScorePanel
            score={score}
            tier={tier}
            answered={answered}
            total={PARAM_KEYS.length}
            canSubmit={canSubmit}
            submitting={submitting}
            onSubmit={submit}
            onSaveDraft={onSaveDraft}
          />
        </Grid>
      </Grid>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  )
}

// ── Local helpers ───────────────────────────────────────────────────────

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
    industryAssociationName: r.industryAssociationName || '',
    state: r.state || '',
    pan: r.pan || '',
    emailId: r.emailId || r.apexHolderEmail || '',
  }
}

// Silence the unused-import complaint for LABELS — kept in the module so
// downstream test files can import it from this barrel-adjacent location.
void LABELS
