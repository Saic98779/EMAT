import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert, Box, Button, CircularProgress, Snackbar, Stack, Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { makeInPrincipleSchema } from '../../../formSchemas'
import FormRenderer, { fieldError } from '../../../components/FormRenderer'
import { useBranchesByState, useFilesByRegistration, useSdesByBranch } from '../../../queries'
import { toFormValues as iaToFormValues } from '../../../apis/industryAssociations'
import { downloadFile } from '../../../apis/files'
import { decodeFilename } from '../../../fileFieldLabels'
import { STAGE } from '../../../apis/registrationStages'
import { STATUS } from '../../../apis/workflow'
import { useIaWorkspace } from '../../../components/workspace/IaWorkspaceLayout'
import { stackedLabelSx } from '../../../components/workspace/formStyles'
import SectionStepper from './registration/SectionStepper'
import RegistrationFooter from './registration/RegistrationFooter'
import SdeL1ReviewView from './registration/SdeL1ReviewView'
import { useRegistrationSubmit } from './registration/useRegistrationSubmit'

// RegistrationTab (L1 · In-Principle Approval)
// ────────────────────────────────────────────────────────────────────────
// The GT-facing form that follows Eligibility Matrix in the IA workspace.
// Renders one section at a time inside the workspace shell:
//
//   ┌────────────────────────┬────────────────────────────────────────────┐
//   │  Section stepper (nav) │  Active section (FormRenderer, 1 section)  │
//   │                        │                                            │
//   └────────────────────────┴────────────────────────────────────────────┘
//   ┌─── Sticky footer: Prev · Section indicator · Save Draft · Continue / Submit ───┐
//
// Data
//   - Seeds from `useIaWorkspace().ia.raw` via `iaToFormValues` (same helper
//     the legacy page uses). Header fields (ia_name / state / pan_no /
//     email) come from the Eligibility Matrix and are rendered read-only.
//   - Branch + SDE dropdowns hydrate from live queries keyed off the
//     selected state / branch (cascade).
//
// Validation
//   - `FormRenderer` handles per-field inline errors (pattern, required,
//     custom validators from the schema).
//   - Section completion is derived from schema validation — no field-level
//     bookkeeping in this component.
//   - Submit gate: every section must pass validation. Otherwise the
//     footer's Submit stays disabled and the incomplete sections light up
//     in the stepper.

// Header fields locked because they're canonical on the eligibility record.
const LOCKED_HEADER_FIELDS = new Set(['ia_name', 'state', 'pan_no', 'email'])

export default function RegistrationTab() {
  const ws = useIaWorkspace()

  // ── Guards ───────────────────────────────────────────────────────────
  if (ws.isNew) {
    return (
      <NoticeBox
        severity="info"
        title="Complete the Eligibility Matrix first"
        body="Registration (L1) unlocks after you submit the Eligibility Matrix. Head back to the Eligibility tab and complete it."
      />
    )
  }
  if (ws.loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }
  if (!ws.ia) {
    return <NoticeBox severity="error" title="IA not found" body={ws.error?.message || 'This IA could not be loaded.'} />
  }

  return <RegistrationForm ws={ws} />
}

// ── Form body (split so the guards above stay lightweight) ──────────────

function RegistrationForm({ ws }) {
  const dto = ws.ia.raw

  // ── Seed the form once, then track edits locally ─────────────────────
  const [values, setValues] = useState(() => iaToFormValues(dto))
  const seededRef = useRef(!!dto)
  useEffect(() => {
    if (seededRef.current) return
    if (!dto) return
    setValues(iaToFormValues(dto))
    seededRef.current = true
  }, [dto])

  const setValue = useCallback((name, next) => {
    // Header fields are read-only in the workspace — silently drop writes.
    if (LOCKED_HEADER_FIELDS.has(name)) return
    setValues((prev) => {
      if (prev[name] === next) return prev
      // Cascade: clear dependent dropdowns when their parent changes so
      // stale UUIDs don't leak into a submit.
      if (name === 'state') return { ...prev, state: next, sidbi_branch: '', select_sde: '' }
      if (name === 'sidbi_branch') return { ...prev, sidbi_branch: next, select_sde: '' }
      return { ...prev, [name]: next }
    })
  }, [])

  // ── Live dropdowns for the branch / SDE cascade ─────────────────────
  const branchesQ = useBranchesByState(values.state)
  const sdesQ = useSdesByBranch(values.sidbi_branch)

  const branchOptions = useMemo(
    () => (branchesQ.data || []).map((b) => ({ value: b.id, label: b.branchName })),
    [branchesQ.data],
  )
  const sdeOptions = useMemo(
    () => (sdesQ.data || []).map((s) => ({ value: s.id, label: s.name })),
    [sdesQ.data],
  )

  const branchHelp = !values.state
    ? 'Pick a state first'
    : branchesQ.isFetching
      ? 'Loading branches…'
      : branchOptions.length === 0
        ? 'No SIDBI branches configured for this state yet.'
        : undefined
  const sdeHelp = !values.sidbi_branch
    ? 'Pick a SIDBI branch first'
    : sdesQ.isFetching
      ? 'Loading SDEs…'
      : sdeOptions.length === 0
        ? 'No SDEs posted at this branch yet.'
        : undefined

  // Lock the L1 form only once GT has actually SUBMITTED it. The parent
  // In-Principle stage flips to IN_PROGRESS the moment the IA record
  // exists (the derived "In Principle Registration" sub-row is done),
  // so the stage-level status is too coarse — it would lock the form
  // before GT ever gets to fill it. Check the specific "Submission"
  // sub-stage (or a later positive sub-stage like SDE Approval) instead.
  const l1Stage = ws.workflow?.stages?.find((s) => s.key === STAGE.IN_PRINCIPLE_APPROVAL_OF_IA)
  const l1Status = l1Stage?.status
  const submissionDone = (l1Stage?.subStages || []).some((s) => {
    const label = s.label || ''
    if (label === 'In Principle Registration') return false // derived-existence row
    return s.status === STATUS.COMPLETED || s.status === STATUS.IN_PROGRESS
  })
  const isLocked = submissionDone

  // ── Schema derivation ────────────────────────────────────────────────
  // Base schema locks the header fields as read-only. This matches the
  // "captured on eligibility, edit-locked here" contract shown in the UI.
  const fullSchema = useMemo(() => {
    const base = makeInPrincipleSchema({ branchOptions, sdeOptions, branchHelp, sdeHelp })
    return {
      ...base,
      sections: base.sections.map((sec) => ({
        ...sec,
        fields: sec.fields.map((f) => {
          // Locked view — every field becomes a read-only record cell.
          if (isLocked) return { ...f, readOnly: true, required: false }
          if (LOCKED_HEADER_FIELDS.has(f.name)) {
            return { ...f, readOnly: true, required: false, help: 'Captured on the Eligibility Matrix — read-only here.' }
          }
          return f
        }),
      })),
    }
  }, [branchOptions, sdeOptions, branchHelp, sdeHelp, isLocked])

  const sections = fullSchema.sections
  const [activeIndex, setActiveIndex] = useState(0)
  const activeSection = sections[activeIndex]
  const activeIndexClamped = Math.min(activeIndex, sections.length - 1)

  // Per-section completion. `useDeferredValue` keeps typing snappy —
  // completion recomputes off the deferred snapshot instead of every
  // keystroke. Non-visible fields (showIf false) don't count.
  const deferredValues = useDeferredValue(values)
  const completion = useMemo(() => {
    const map = {}
    for (const sec of sections) map[sec.n] = sectionState(sec, deferredValues)
    return map
  }, [sections, deferredValues])

  const completedCount = useMemo(
    () => Object.values(completion).filter((s) => s === 'done').length,
    [completion],
  )
  const canSubmit = completedCount === sections.length

  // Turn on inline error flags across all fields once the user tries to
  // submit — before that, the form is friendlier (only touched fields
  // show errors via FormRenderer's own logic).
  const [showAllErrors, setShowAllErrors] = useState(false)

  // Single-section render trick: pass a schema slice with only the active
  // section. FormRenderer keeps its full sectioned layout, headers, and
  // validation logic — we're just narrowing the visible surface.
  const sectionSchema = useMemo(
    () => ({ ...fullSchema, sections: [activeSection] }),
    [fullSchema, activeSection],
  )

  // ── Submit ───────────────────────────────────────────────────────────
  const { submit, submitting, toast, clearToast } = useRegistrationSubmit({ iaId: ws.iaId, basePath: ws.basePath })
  // Reviewer decision toast — separate from GT's submit toast so a
  // reviewer's Approve/Reject feedback surfaces even when the tab isn't
  // in submit-mode. Same Snackbar renders both.
  const [reviewerToast, setReviewerToast] = useState(null)
  const activeToast = toast || reviewerToast
  const closeToast = useCallback(() => {
    if (toast) clearToast()
    if (reviewerToast) setReviewerToast(null)
  }, [toast, clearToast, reviewerToast])

  // Ref-mirror everything the submit closure needs so `onSubmit` stays
  // referentially stable — otherwise it rebuilds on every keystroke because
  // `values`/`completion` are in the deps, and the memoized RegistrationFooter
  // re-renders on each input event.
  const onSubmitRef = useRef({ canSubmit, completion, sections, submit, values })
  onSubmitRef.current = { canSubmit, completion, sections, submit, values }

  const onSubmit = useCallback(() => {
    const s = onSubmitRef.current
    setShowAllErrors(true)
    if (!s.canSubmit) {
      const firstBad = s.sections.findIndex((sec) => s.completion[sec.n] !== 'done')
      if (firstBad >= 0) setActiveIndex(firstBad)
      return
    }
    s.submit(s.values)
  }, [])

  const goPrev = useCallback(() => setActiveIndex((i) => Math.max(0, i - 1)), [])
  const goNext = useCallback(() => setActiveIndex((i) => Math.min(sections.length - 1, i + 1)), [sections.length])
  const goTo = useCallback((i) => setActiveIndex(i), [])

  // Reviewer decisions live in workspace context — the SDE (or CE / HO)
  // gets a set of Approve / Reject / Send-back buttons when it's their
  // turn at the current sub-stage. Non-reviewers get an empty array.
  const decisions = ws.decisionsForCurrent || []
  const isReviewer = decisions.length > 0

  // Reviewer branch — SDE opens the L1 tab on a submitted IA. Full
  // review surface (fields + docs + Approve/Reject bar). GT / other
  // non-reviewers fall through to the read-only-form branch below.
  if (isLocked && isReviewer) {
    return (
      <>
        <SdeL1ReviewView
          iaId={ws.iaId}
          iaName={ws.ia?.name}
          dto={dto}
          schema={fullSchema}
          decisions={decisions}
          onDone={(result) => result && setReviewerToast(result)}
        />
        <Snackbar
          open={!!activeToast}
          autoHideDuration={4200}
          onClose={closeToast}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          {activeToast ? (
            <Alert severity={activeToast.severity} variant="filled" onClose={closeToast}>
              {activeToast.msg}
            </Alert>
          ) : undefined}
        </Snackbar>
      </>
    )
  }

  return (
    <>
      {/* CSS grid layout so the stepper (left) and form area (right) stay
          side-by-side reliably — MUI Grid v1/v2 mixing was causing them
          to stack vertically. */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '240px 1fr' },
          columnGap: 4,
          rowGap: 3,
          alignItems: 'flex-start',
        }}
      >
        <Box sx={{ position: { md: 'sticky' }, top: { md: 96 } }}>
          <SectionStepper
            sections={sections}
            activeIndex={activeIndexClamped}
            completion={completion}
            completedCount={completedCount}
            onSelect={goTo}
          />
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <SectionHeader
            title={activeSection?.title}
            description={activeSection?.desc}
            stepIndex={activeIndexClamped + 1}
            stepCount={sections.length}
          />
          <Box sx={stackedLabelSx}>
            <FormRenderer
              schema={sectionSchema}
              values={values}
              setValue={setValue}
              showAllErrors={showAllErrors}
              chrome="minimal"
            />
          </Box>

          {/* Uploaded documents — surfaced only in read-only mode so GT
              can see what they filed alongside their form values. The
              editable path already has per-field Uploader inputs. */}
          {isLocked && ws.iaId && (
            <UploadedDocumentsPanel iaId={ws.iaId} />
          )}
        </Box>
      </Box>

      {!isLocked && (
        <RegistrationFooter
          activeIndex={activeIndexClamped}
          sectionCount={sections.length}
          sectionName={activeSection?.title || ''}
          canSubmit={canSubmit && !submitting}
          submitting={submitting}
          completedCount={completedCount}
          onPrev={goPrev}
          onNext={goNext}
          onSubmit={onSubmit}
        />
      )}

      <Snackbar
        open={!!toast}
        autoHideDuration={4200}
        onClose={clearToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert severity={toast.severity} variant="filled" onClose={clearToast}>
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  )
}

// SubmittedBanner
// ────────────────────────────────────────────────────────────────────────
// Header card that replaces the sticky "Submit for L1 review" footer once
// the form is locked. Communicates two states:
//   • approved === false → "Submitted for review" (info tone, SDE reviewing)
//   • approved === true  → "L1 approved" (success tone)
// The stepper + read-only fields render underneath so GT can still browse
// what was filed on each section.
function SubmittedBanner({ approved, submittedOn, submittedBy }) {
  const theme = useTheme()
  const tone = approved ? theme.palette.success : theme.palette.info
  const title = approved ? 'In-Principle Approval granted' : 'Submitted for L1 review'
  const body = approved
    ? 'The SDE has cleared this application. Head to the Sustainability tab to continue.'
    : 'This application is now with the SDE for review. You’ll see the outcome here as soon as it’s recorded.'

  return (
    <Box
      sx={{
        mt: 2,
        borderRadius: 2,
        border: 1,
        borderColor: alpha(tone.main, 0.35),
        background: alpha(tone.main, 0.07),
        px: { xs: 3, md: 5 },
        py: { xs: 4, md: 6 },
        textAlign: 'center',
      }}
    >
      <Typography
        sx={{
          fontSize: { xs: 24, md: 32 },
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: tone.dark,
          lineHeight: 1.15,
        }}
      >
        {title}
      </Typography>
      <Typography
        sx={{
          mt: 1.5,
          fontSize: { xs: 14, md: 15.5 },
          color: theme.palette.text.secondary,
          maxWidth: 640,
          mx: 'auto',
        }}
      >
        {body}
      </Typography>
      {(submittedBy || submittedOn) && (
        <Typography
          sx={{
            mt: 3,
            fontSize: 12.5,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: theme.palette.text.disabled,
          }}
        >
          {submittedBy ? `Filed by ${submittedBy}` : ''}
          {submittedBy && submittedOn ? ' · ' : ''}
          {submittedOn ? formatDate(submittedOn) : ''}
        </Typography>
      )}
    </Box>
  )
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.valueOf())) return ''
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// Lightweight section header — sits above the fields grid. Matches the
// design's "Title · Section N of M" + optional description subtitle.
function SectionHeader({ title, description, stepIndex, stepCount }) {
  const theme = useTheme()
  return (
    <Box sx={{ mb: 3, pb: 2, borderBottom: 1, borderColor: alpha(theme.palette.text.primary, 0.08) }}>
      <Stack direction="row" alignItems="baseline" spacing={1.25} flexWrap="wrap">
        <Typography sx={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.015em' }}>
          {title || 'Section'}
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: theme.palette.text.disabled, fontWeight: 500 }}>
          Section {stepIndex} of {stepCount}
        </Typography>
      </Stack>
      {description && (
        <Typography sx={{ mt: 0.75, fontSize: 13.5, color: theme.palette.text.secondary }}>
          {description}
        </Typography>
      )}
    </Box>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────

// Compute a section's completion signal from its fields. Handles showIf,
// skips subheadings + computed cells, and uses the shared fieldError logic
// so this stays consistent with what FormRenderer renders inline.
function sectionState(sec, values) {
  const visible = sec.fields.filter((f) => {
    if (['subheading', 'computed', 'coordinates_capture'].includes(f.type)) return false
    if (typeof f.showIf === 'function' && !f.showIf(values)) return false
    return true
  })
  if (visible.length === 0) return 'done' // no visible required work → treat as done

  let hasError = false
  let hasFilled = false
  let hasMissing = false

  for (const f of visible) {
    const v = values[f.name]
    const filled = Array.isArray(v)
      ? v.length > 0
      : typeof v === 'string' ? v.trim() !== '' : v != null && v !== ''
    if (filled) hasFilled = true

    if (f.required && !filled) { hasMissing = true; continue }
    const err = fieldError(f, v, values)
    if (err) hasError = true
  }

  if (hasError || hasMissing) return hasFilled ? 'error' : 'empty'
  return 'done'
}

// Lightweight notice card used for the "no id" / "loading" / "error" states.
function NoticeBox({ severity, title, body }) {
  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', mt: 4 }}>
      <Alert severity={severity} sx={{ borderRadius: 1.5 }}>
        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{title}</Typography>
        <Typography sx={{ fontSize: 13.5 }}>{body}</Typography>
      </Alert>
    </Box>
  )
}

// Documents panel shown at the bottom of the read-only L1 view. Lists
// every file uploaded against this IA (grouped by original slot label)
// with a click-to-download action.
function UploadedDocumentsPanel({ iaId }) {
  const filesQ = useFilesByRegistration(iaId)
  const files = filesQ.data || []
  const [busy, setBusy] = useState(null)
  const theme = useTheme()

  const onDownload = async (filename) => {
    setBusy(filename)
    try { await downloadFile(iaId, filename) } finally { setBusy(null) }
  }

  return (
    <Box
      sx={{
        mt: 4,
        p: 2.5,
        borderRadius: 2,
        border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        background: '#fff',
      }}
    >
      <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.palette.text.secondary, mb: 1.5 }}>
        Uploaded documents · {files.length}
      </Typography>
      {filesQ.isLoading && files.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: theme.palette.text.disabled }}>Loading…</Typography>
      ) : files.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: theme.palette.text.disabled }}>No files were uploaded with this submission.</Typography>
      ) : (
        <Stack spacing={1}>
          {files.map((f) => {
            const filename = f.filename || f.name
            const decoded = decodeFilename(filename)
            const label = decoded.label || decoded.name
            const size = f.size ? formatFileSize(f.size) : ''
            const ext = (decoded.name.split('.').pop() || '').toUpperCase().slice(0, 4)
            const rowBusy = busy === filename
            return (
              <Stack
                key={filename}
                direction="row"
                alignItems="center"
                spacing={1.5}
                sx={{ py: 0.75, borderBottom: 1, borderColor: alpha(theme.palette.text.primary, 0.06), '&:last-of-type': { borderBottom: 0 } }}
              >
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1,
                    flexShrink: 0,
                    display: 'grid',
                    placeItems: 'center',
                    background: alpha(theme.palette.primary.main, 0.09),
                    color: theme.palette.primary.dark,
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {ext || 'FILE'}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: theme.palette.text.primary,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={label}
                  >
                    {label}
                  </Typography>
                  {size && (
                    <Typography sx={{ fontSize: 11.5, color: theme.palette.text.disabled }}>
                      {size}
                    </Typography>
                  )}
                </Box>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => onDownload(filename)}
                  disabled={rowBusy}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  {rowBusy ? 'Downloading…' : 'Download'}
                </Button>
              </Stack>
            )
          })}
        </Stack>
      )}
    </Box>
  )
}

function formatFileSize(bytes) {
  if (!bytes || bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
