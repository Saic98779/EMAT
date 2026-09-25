import { useCallback, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Box, Button, CircularProgress, Snackbar, Alert, Stack, Typography } from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import { alpha, useTheme } from '@mui/material/styles'
import FormRenderer from '../../../../components/FormRenderer'
import { stackedLabelSx } from '../../../../components/workspace/formStyles'
import { keys, useUpdateIA, useApproveIA, useFilesByIa } from '../../../../queries'
import { uploadFilesBatch } from '../../../../apis/files'
import { toFormValues as iaToFormValues } from '../../../../apis/industryAssociations'
import { encodeFilename, FILE_FIELD_LABELS, FILE_FIELD_SEP } from '../../../../fileFieldLabels'
import { DECISION } from '../../../../apis/stageActions'
import { useAuth } from '../../../../auth'
import SectionStepper from './SectionStepper'
import { DecisionBar } from './SdeL1ReviewView'

// SdeL1EditableView
// ────────────────────────────────────────────────────────────────────────
// The In-Principle spec (client 2026-09-25) marks almost every L1 field
// as "modifiable by SDE". This view is the SDE's editable counterpart to
// SdeL1ReviewView — same section stepper GT sees, editable FormRenderer,
// plus a footer that combines:
//   • Save changes            — PUT edits without changing the workflow
//   • Approve / Revert / Reject — records the decision (with remarks),
//                                  auto-saving pending edits first
//
// The parent RegistrationTab picks between this and SdeL1ReviewView based
// on the viewer's role. The header fields locked by the eligibility
// matrix stay locked here too (canonical on that record).

const LOCKED_HEADER_FIELDS = new Set(['ia_name', 'state', 'pan_no', 'email'])

export default function SdeL1EditableView({
  iaId, iaName, dto, schema, decisions = [], onDone,
}) {
  const theme = useTheme()
  const qc = useQueryClient()
  const { user } = useAuth()
  const updateM = useUpdateIA()
  const approveM = useApproveIA()

  // Files, seeded into the form so file fields show what's already
  // attached. Same slot-grouping trick RegistrationTab uses for GT.
  const filesQ = useFilesByIa(iaId)
  const filesBySlot = useMemo(() => {
    const out = {}
    for (const f of filesQ.data || []) {
      const fname = f?.filename
      if (typeof fname !== 'string') continue
      const idx = fname.indexOf(FILE_FIELD_SEP)
      if (idx <= 0) continue
      const slug = fname.slice(0, idx)
      if (!(slug in FILE_FIELD_LABELS)) continue
      if (!out[slug]) out[slug] = []
      out[slug].push(fname)
    }
    return out
  }, [filesQ.data])

  // Values seeded once. Later edits live in local state; save handler
  // pushes them via PUT (same shape the GT-side useRegistrationSubmit
  // uses, minus the stage-advance).
  const [values, setValues] = useState(() => ({ ...iaToFormValues(dto), ...filesBySlot }))
  // Re-seed when files hydrate so file fields don't stay empty on first paint.
  const seededRef = useRef(false)
  if (!seededRef.current && !filesQ.isLoading) {
    seededRef.current = true
    setValues((prev) => ({ ...iaToFormValues(dto), ...filesBySlot, ...pickUserEdits(prev) }))
  }

  const setValue = useCallback((name, next) => {
    if (LOCKED_HEADER_FIELDS.has(name)) return
    setValues((prev) => {
      if (prev[name] === next) return prev
      if (name === 'state') return { ...prev, state: next, sidbi_branch: '', select_sde: '' }
      if (name === 'sidbi_branch') return { ...prev, sidbi_branch: next, select_sde: '' }
      return { ...prev, [name]: next }
    })
  }, [])

  // Track "dirty" so the Save button only lights up when the SDE has
  // actually changed something. Uses the last-persisted snapshot as the
  // baseline (moves after a successful save).
  const baselineRef = useRef(values)
  const dirty = !shallowEqual(baselineRef.current, values)

  // Sections — the schema passed in is already editable (RegistrationTab
  // will now skip the locking step when the reviewer is SDE). Locked
  // header fields carry their `readOnly: true` from that same builder.
  const sections = schema?.sections || []
  const [activeIndex, setActiveIndex] = useState(0)
  const activeSection = sections[Math.min(activeIndex, sections.length - 1)]
  const sectionSchema = useMemo(
    () => ({ ...schema, sections: activeSection ? [activeSection] : [] }),
    [schema, activeSection],
  )

  const [savingKind, setSavingKind] = useState(null) // 'save' | DECISION.*
  const [showAllErrors, setShowAllErrors] = useState(false)

  // Bare save: PUT current values without touching the stage.
  const persistEdits = useCallback(async () => {
    const files = collectFiles(values)
    await updateM.mutateAsync({
      id: iaId,
      values,
      extra: { updatedBy: user?.username },
    })
    if (files.length) {
      const tagged = files.map(({ file, slug }) => encodeFilename(file, slug))
      try { await uploadFilesBatch(iaId, 'registration', iaId, tagged) } catch { /* non-blocking */ }
    }
    baselineRef.current = values
    qc.invalidateQueries({ queryKey: keys.ias.detail(iaId), refetchType: 'all' })
    qc.invalidateQueries({ queryKey: keys.ias.lists() })
  }, [values, updateM, iaId, user?.username, qc])

  const onSaveOnly = useCallback(async () => {
    if (!dirty) return
    setSavingKind('save')
    try {
      await persistEdits()
      onDone?.({ severity: 'success', msg: 'Changes saved. Decision still pending.' })
    } catch (err) {
      onDone?.({ severity: 'error', msg: err?.message || 'Failed to save changes.' })
    } finally {
      setSavingKind(null)
    }
  }, [dirty, persistEdits, onDone])

  // Decision handler wired into the shared DecisionBar. Saves any
  // pending edits first, then records the approval decision using the
  // same endpoint the read-only view calls.
  const onDecide = useCallback(async (d, commentsText) => {
    if (!iaId || !d?.stageId) {
      onDone?.({ severity: 'error', msg: 'Missing IA id or destination stage.' })
      throw new Error('missing-stage')
    }
    setSavingKind(d.kind)
    try {
      if (dirty) await persistEdits()
      await approveM.mutateAsync({
        id: iaId,
        isSidbeApproved: d.kind === DECISION.APPROVE,
        stageId: d.stageId,
        stageComments: commentsText || undefined,
      })
      onDone?.({ severity: 'success', msg: `${d.label} · recorded.` })
    } catch (err) {
      onDone?.({ severity: 'error', msg: err?.message || 'Failed to record decision.' })
      throw err
    } finally {
      setSavingKind(null)
    }
  }, [iaId, dirty, persistEdits, approveM, onDone])

  const savingSave = savingKind === 'save'
  const savingDecision = savingKind && savingKind !== 'save'

  return (
    <>
      <ReviewerHeader
        iaName={iaName}
        submittedBy={dto?.updatedBy || dto?.createdBy}
        submittedOn={dto?.updatedAt || dto?.createdAt}
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '240px 1fr' },
          columnGap: 4,
          rowGap: 3,
          alignItems: 'flex-start',
          mt: 2.5,
        }}
      >
        <Box sx={{ position: { md: 'sticky' }, top: { md: 96 } }}>
          <SectionStepper
            sections={sections}
            activeIndex={Math.min(activeIndex, sections.length - 1)}
            completion={{}}
            completedCount={0}
            onSelect={setActiveIndex}
          />
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="baseline" spacing={1.5} sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: 15.5, fontWeight: 700 }}>
              {activeSection?.title}
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: theme.palette.text.disabled }}>
              Step {Math.min(activeIndex, sections.length - 1) + 1} of {sections.length}
            </Typography>
            {dirty && (
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: theme.palette.warning.dark, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                · Unsaved edits
              </Typography>
            )}
          </Stack>
          <Box sx={stackedLabelSx}>
            <FormRenderer
              schema={sectionSchema}
              values={values}
              setValue={setValue}
              showAllErrors={showAllErrors}
              chrome="minimal"
            />
          </Box>

          <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 3 }}>
            <Button
              onClick={onSaveOnly}
              disabled={!dirty || savingKind !== null}
              startIcon={savingSave ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
              variant="outlined"
              disableElevation
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {savingSave ? 'Saving…' : 'Save changes'}
            </Button>
          </Stack>
        </Box>
      </Box>

      {/* Spacer so the sticky decision bar doesn't cover the last row. */}
      <Box sx={{ height: 112 }} />

      <DecisionBar
        decisions={decisions}
        iaName={iaName}
        onDecide={onDecide}
        onValidationFail={onDone}
      />
    </>
  )
}

function ReviewerHeader({ iaName, submittedBy, submittedOn }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        mt: 2,
        borderRadius: 2,
        border: 1,
        borderColor: alpha(theme.palette.info.main, 0.35),
        background: alpha(theme.palette.info.main, 0.06),
        px: { xs: 3, md: 4 },
        py: { xs: 2.25, md: 2.75 },
      }}
    >
      <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.palette.info.dark }}>
        Awaiting your L1 decision · you may edit any field first
      </Typography>
      <Typography sx={{ mt: 0.5, fontSize: { xs: 20, md: 22 }, fontWeight: 800, color: theme.palette.text.primary, letterSpacing: '-0.02em' }}>
        {iaName ? `Review & edit ${iaName}` : 'Review & edit the L1 submission'}
      </Typography>
      <Typography sx={{ mt: 0.75, fontSize: 13, color: theme.palette.text.secondary }}>
        Filed by <b>{submittedBy || '—'}</b> · received{' '}
        <b>{submittedOn ? new Date(submittedOn).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</b>
      </Typography>
    </Box>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────

function collectFiles(values) {
  const out = []
  for (const [name, v] of Object.entries(values || {})) {
    if (!Array.isArray(v)) continue
    for (const item of v) if (item instanceof File) out.push({ file: item, slug: name })
  }
  return out
}

// Shallow-equal used for the dirty check. Enough for our value tree
// because every editable field lands as a scalar or an array of scalars
// on the values map — no nested objects the SDE can mutate through the
// form.
function shallowEqual(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  const ak = Object.keys(a); const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  for (const k of ak) {
    const av = a[k]; const bv = b[k]
    if (av === bv) continue
    if (Array.isArray(av) && Array.isArray(bv)) {
      if (av.length !== bv.length) return false
      for (let i = 0; i < av.length; i++) if (av[i] !== bv[i]) return false
      continue
    }
    return false
  }
  return true
}

// When we re-seed from a late-arriving file list, preserve fields the
// SDE has already started editing. Only the file slot arrays should be
// overridden by the fresh seed.
function pickUserEdits(prev) {
  const out = {}
  for (const [k, v] of Object.entries(prev || {})) {
    // Files are seeded from the query — anything else the user may have
    // touched is worth preserving on re-seed.
    if (Array.isArray(v) && v.some((x) => x instanceof File)) out[k] = v
  }
  return out
}
