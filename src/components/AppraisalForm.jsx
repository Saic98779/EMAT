import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Button, CircularProgress, Alert, Paper, Stack, Typography } from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import { alpha, useTheme } from '@mui/material/styles'
import FormRenderer, { fieldError } from './FormRenderer'
import SustainabilityMatrixModal from './SustainabilityMatrixModal'
import SectionStepper from '../pages/gt/workspace/registration/SectionStepper'
import RegistrationFooter from '../pages/gt/workspace/registration/RegistrationFooter'
import { stackedLabelSx } from './workspace/formStyles'
import { appraisalSchema } from '../formSchemas'
import {
  useIA,
  useAllStages,
  useAppraisalByRegistration,
  useBranchesByState,
  useCreateAppraisal,
  useUpdateAppraisal,
  useFilesByRegistration,
} from '../queries'
import {
  toCreatePayload,
  toUpdatePayload,
  toFormValues,
} from '../apis/industryAssociationAppraisals'
import { STAGE } from '../apis/registrationStages'
import { stageIdForStage } from '../apis/stageActions'
import { uploadFilesBatch } from '../apis/files'
import { encodeFilename, FILE_FIELD_LABELS, FILE_FIELD_SEP } from '../fileFieldLabels'
import { useAuth } from '../auth'

// Same validation walk used across all form pages — returns the first
// True if at least one of the "autofetched from parent IA" fields carries
// a real value. Used as a safety net before POSTing a NEW appraisal — if
// none of these are filled, either the seed never ran or the parent IA
// is a matrix-only stub with no In-Principle profile. Either way, POSTing
// would create a garbage row of all-nulls on the backend.
// L1 → appraisal seed: `secretariatStaff` is an array of
// `{ name, contact, email }`. Render as a compact multi-line string so
// the appraisal's single-line "details" field shows something useful
// without dropping data.
function seedSecretariatDetails(staff) {
  if (!Array.isArray(staff) || staff.length === 0) return ''
  return staff
    .filter((r) => r && (r.name || r.contact || r.email))
    .map((r) => [r.name, r.contact, r.email].filter(Boolean).join(' · '))
    .join('\n')
}

function valuesLookHydrated(values) {
  const anchors = [
    'apex_name', 'apex_designation', 'apex_email', 'nodal_name',
    'nodal_email', 'sidbi_branch', 'district', 'pincode', 'ia_name',
  ]
  return anchors.some((k) => {
    const v = values?.[k]
    return typeof v === 'string' ? v.trim() !== '' : v != null && v !== ''
  })
}

// missing-required / bad-pattern field, or null if the form is submittable.
function firstProblem(schema, values) {
  for (const sec of schema.sections) {
    for (const f of sec.fields) {
      if (f.showIf && !f.showIf(values)) continue
      const v = values[f.name]
      const filled = Array.isArray(v)
        ? v.length > 0
        : (typeof v === 'string' ? v.trim() !== '' : v != null && v !== '')
      if (f.required && !filled) return `${sec.title}: “${f.label}” is required`
      const err = fieldError(f, v, values)
      if (err) return `${sec.title}: ${f.label} — ${err}`
    }
  }
  return null
}

// The only fields a Cluster Expert may edit — everything else on the appraisal
// is other roles' work and is shown to them strictly for review.
const CE_EDITABLE = new Set(['cluster_expert_comments', 'cluster_expert_terms_comments'])

// Role-shaped schema:
//   CLUSTER_EXPERT → whole application visible, read-only, except its two
//                    comment fields. `required` is dropped from the locked
//                    fields: the CE cannot fix someone else's blank, so
//                    leaving it on would make their own save unreachable.
//   SIDBI_SDE      → base schema, minus Cluster Expert Comments section.
//   GT / default   → base minus Cluster Expert Comments AND Comments on
//                    Due Diligence (SDE-owned).
function schemaFor(role) {
  const src = appraisalSchema
  if (role === 'CLUSTER_EXPERT') {
    return {
      ...src,
      sections: src.sections.map((sec) => ({
        ...sec,
        fields: sec.fields.map((f) => (
          CE_EDITABLE.has(f.name)
            ? f
            : { ...f, readOnly: true, required: false, otp: false }
        )),
      })),
    }
  }
  // Non-CE roles keep the CE fields visible but locked — the terms comment
  // lives in the Terms of Assistance section, which they do own.
  const lockCeFields = (sec) => ({
    ...sec,
    fields: sec.fields.map((f) => (f.ceOnly ? { ...f, readOnly: true, required: false } : f)),
  })
  if (role === 'SIDBI_SDE') {
    return {
      ...src,
      sections: src.sections
        .filter((sec) => sec.title !== 'Cluster Expert Comments')
        .map(lockCeFields),
    }
  }
  // GT flow — collapse the many tiny autofilled sections (1–6, 8–10) into
  // two consolidated sections so the stepper isn't a wall of green dots
  // each hiding a couple of read-only fields. Also drop any Cluster
  // Expert fields entirely (not just lock them) — GT shouldn't even see
  // an empty CE remarks box tucked into their Terms section.
  return {
    ...src,
    sections: consolidateForGt(
      src.sections
        .filter((sec) =>
          sec.title !== 'Cluster Expert Comments' &&
          sec.title !== 'Comments on Due Diligence',
        )
        .map((sec) => ({
          ...sec,
          fields: sec.fields.filter((f) => !f.ceOnly),
        })),
    ),
  }
}

// The identity sections (State, IA, Constitution, Address, Apex, Nodal)
// and the location-block sections (SIDBI Branch, Cluster / District,
// Existing Infra) are all auto-fetched from the parent In-Principle
// registration. Splitting each into its own stepper row makes GT click
// through a dozen 1-field pages of green ticks. Fuse them into two
// well-sized sections instead. Order is preserved; every other section
// (DIA Specific, Terms, Budget, DoP, Recommendation) is untouched.
const IA_SNAPSHOT_TITLES = new Set([
  'State', 'Industry Association (IA)', 'Constitution of IA', 'Address of IA',
  'Apex Office Holder Details of IA', 'Nodal Person Details of IA',
])
const LOCATION_INFRA_TITLES = new Set([
  'Nearest SIDBI Branch Office', 'Cluster / District Details', 'Existing Infra Details',
])

function consolidateForGt(sections) {
  const snapshotFields = []
  const locationFields = []
  const passthrough = []
  for (const sec of sections) {
    if (IA_SNAPSHOT_TITLES.has(sec.title)) {
      // Sub-heading per source-section keeps the fields visually grouped
      // inside the consolidated section without losing context.
      snapshotFields.push({
        name: `_snap_${sec.n}`, label: sec.title, type: 'subheading', span: 12,
      })
      snapshotFields.push(...sec.fields)
      continue
    }
    if (LOCATION_INFRA_TITLES.has(sec.title)) {
      locationFields.push({
        name: `_loc_${sec.n}`, label: sec.title, type: 'subheading', span: 12,
      })
      locationFields.push(...sec.fields)
      continue
    }
    passthrough.push(sec)
  }
  const merged = []
  let nextN = 1
  if (snapshotFields.length) {
    merged.push({
      n: nextN++,
      title: 'IA snapshot',
      desc: 'Auto-fetched from the In-Principle registration. Modifiable where the source section allowed it.',
      fields: snapshotFields,
    })
  }
  if (locationFields.length) {
    merged.push({
      n: nextN++,
      title: 'Location, cluster & infrastructure',
      desc: 'Auto-fetched from the In-Principle registration — modifiable.',
      fields: locationFields,
    })
  }
  for (const sec of passthrough) merged.push({ ...sec, n: nextN++ })
  return merged
}

// Standalone appraisal form. Handles schema selection, seed from parent IA,
// value editing, file uploads, and PUT/POST.
//
// Props:
//   registrationId : the parent IA id — required.
//   onSaved(msg, severity) : optional callback after save/upload finish.
//   stickyFooter (default false) : renders the save button in a sticky Paper
//                                  bar (page-mode); when embedded, pass
//                                  false and the button sits inline below.
//   stepper (default false) : opts into the workspace L1-style layout —
//                             SectionStepper on the left, one section at a
//                             time on the right, Prev / Continue / Submit
//                             footer at the bottom. Ignored when the
//                             viewer's schema only exposes 1–2 sections
//                             (Cluster Expert), where a single scroll is
//                             lighter than a stepper.
export default function AppraisalForm({ registrationId, onSaved, stickyFooter = false, stepper = false }) {
  const { rawRole } = useAuth()
  const isClusterExpert = rawRole === 'CLUSTER_EXPERT'
  const isSde = rawRole === 'SIDBI_SDE'
  const schema = useMemo(() => schemaFor(rawRole), [rawRole])

  const iaQ = useIA(registrationId)
  const apprQ = useAppraisalByRegistration(registrationId)
  const branchesQ = useBranchesByState(iaQ.data?.state)
  const filesQ = useFilesByRegistration(registrationId)
  const createM = useCreateAppraisal()
  const updateM = useUpdateAppraisal()
  // Master stage list — used to resolve the numeric `stageId` we stamp
  // on the appraisal submit so the backend advances currentStage to
  // DETAILED_APPRAISAL_SUBMITTED and writes an audit row.
  const stagesQ = useAllStages()

  const [values, setValues] = useState({})
  const [showAllErrors, setShowAllErrors] = useState(false)
  const setValue = useCallback((name, v) => setValues((p) => ({ ...p, [name]: v })), [])
  // Once the initial seed has run, background query refetches (react-query
  // stale-time expiry, refetchOnWindowFocus, cache invalidation) must NOT
  // clobber in-progress edits. Without this guard, a failed save that
  // triggers any refetch — or even a re-render that races with a pending
  // fetch — would wipe every field the user just typed.
  const seeded = Boolean(values._seeded)

  // Seed the form once IA + appraisal + branches + files have loaded.
  // Preserves any DD keys already on the appraisal even if the current
  // role's schema hides them, so GT re-saves don't wipe SDE's DD data.
  useEffect(() => {
    if (seeded) return
    if (iaQ.isLoading || apprQ.isLoading) return
    if (filesQ.isLoading) return
    // Branches load after IA (they're keyed on the IA's state). If we seed
    // before the branch list is available, the UUID → name lookup below
    // falls back to the raw UUID and the user sees a GUID in the SIDBI
    // Branch field. `isLoading` alone isn't reliable: react-query returns
    // false during the brief window between "enabled=true" and the fetch
    // actually starting. Explicit `data` check is the sturdy version.
    if (iaQ.data?.state && !branchesQ.data) return
    const ia = iaQ.data
    const r = ia?.raw || {}
    const branchName = branchesQ.data?.find((b) => b.id === r.sidbiBranch)?.branchName ?? r.sidbiBranch
    const yn = (b) => (b === true ? 'yes' : b === false ? 'no' : '')
    const YN = (b) => (b === true ? 'Yes' : b === false ? 'No' : '')
    const seed = ia ? {
      // Non-visible marker used by date validators — CIBIL/SMART report dates
      // must fall on or after the parent In-Principle's creation timestamp.
      _ia_created_at: r.createdAt ?? ia?.submitted ?? '',
      state: r.state ?? '',
      ia_name: r.industryAssociationName ?? '',
      year_incorp: r.incorporationDate ? String(new Date(r.incorporationDate).getFullYear()) : '',
      ia_profit_type: r.iaType ?? '',
      proof_constitution: r.constitutionType === 'Other'
        ? `Other — ${r.constitutionOther ?? ''}`
        : (r.constitutionType ?? ''),
      district: r.district ?? '',
      pincode: r.pincode ?? '',
      apex_name: r.apexHolderName ?? '',
      apex_designation: r.apexHolderDesignation ?? '',
      apex_contact: r.apexHolderMobile ?? '',
      apex_email: r.apexHolderEmail ?? '',
      nodal_name: r.nodalName ?? '',
      nodal_designation: r.nodalDesignation ?? '',
      nodal_contact: r.nodalMobile ?? '',
      nodal_email: r.nodalEmail ?? '',
      sidbi_branch: branchName ?? '',
      cluster_mapped: yn(r.mappedWithCluster),
      cluster_which: r.clusterName ?? '',
      district_mapped: yn(r.mappedWithImportantDistrict),
      msme_count: r.msmeCountWithoutTraders ?? '',
      members_gt200: YN(r.activeMembersAbove200),
      active_members: r.activeMembersCount ?? '',
      members_justification: r.justification ?? '',
      own_building: r.buildingType ? 'yes' : '',
      own_building_details: r.buildingType ?? '',
      it_infra: yn(r.itInfrastructureAvailable),
      it_infra_details: r.infrastructureType ?? '',
      secretariat_staff: yn(r.secretariatStaffAvailable),
      // L1 stores staff as an array of {name, contact, email}. The
      // appraisal has a single free-text "details" field, so join the
      // array entries into a readable one-per-line summary. Falls back
      // to whatever was already saved on the appraisal itself.
      secretariat_details: seedSecretariatDetails(r.secretariatStaff),
      website: yn(r.websiteAvailable),
      paid_services: yn(r.paidServicesAvailable),
      paid_services_details: r.paidServicesDetails ?? '',
      basis_of_selection: Array.isArray(r.selectionCriteria) ? r.selectionCriteria : [],
      grant_proposed: r.grantProposed ?? '',
      grant_details: r.grantDetails ?? '',
      envisaged_output: r.envisagedOutput ?? '',
      envisaged_outcome: r.envisagedOutcome ?? '',
      envisaged_impact: r.envisagedImpact ?? '',
    } : {}
    // Group already-uploaded files under their slot slug so the appraisal
    // form shows chips for what's on the server, not an empty picker.
    const filesBySlot = {}
    for (const f of filesQ.data || []) {
      const fname = f?.filename
      if (typeof fname !== 'string') continue
      const idx = fname.indexOf(FILE_FIELD_SEP)
      if (idx <= 0) continue
      const slug = fname.slice(0, idx)
      if (!(slug in FILE_FIELD_LABELS)) continue
      if (!filesBySlot[slug]) filesBySlot[slug] = []
      filesBySlot[slug].push(fname)
    }
    const merged = { ...seed, ...toFormValues(apprQ.data), ...filesBySlot }
    // `toFormValues` may overlay `sidbi_branch` with the raw id stored on
    // the appraisal DTO (backend copies it from the IA at creation). If it
    // hasn't been swapped for a name yet, resolve it against the branches
    // list so the field doesn't render as a bare id.
    if (merged.sidbi_branch != null && merged.sidbi_branch !== '') {
      const match = branchesQ.data?.find((b) => String(b.id) === String(merged.sidbi_branch))
      if (match?.branchName) merged.sidbi_branch = match.branchName
    }
    setValues({ ...merged, _seeded: true })
  }, [seeded, iaQ.data, iaQ.isLoading, apprQ.data, apprQ.isLoading, branchesQ.data, branchesQ.isLoading, filesQ.data, filesQ.isLoading])

  const busy = createM.isPending || updateM.isPending
  const existing = apprQ.data
  const [sustainOpen, setSustainOpen] = useState(false)

  const collectFiles = () => {
    const out = []
    for (const [name, v] of Object.entries(values)) {
      if (!Array.isArray(v)) continue
      for (const item of v) if (item instanceof File) out.push({ file: item, slug: name })
    }
    return out
  }

  const submit = async () => {
    // Bail out if the form hasn't finished hydrating from the parent IA
    // + prior appraisal + branches + files. Without this guard, a Save
    // click during load fires with `values = {}`, and every mapped field
    // lands on the backend as null — including the autofilled apex /
    // nodal / cluster / branch fields that are supposed to round-trip
    // from the IA record.
    if (!seeded) {
      onSaved?.('Form is still loading — please wait a moment before saving.', 'warning')
      return
    }
    // Additional guard: refuse to POST an appraisal that has none of its
    // autofilled-from-IA context. Almost always means the parent IA is a
    // matrix-only stub (In-Principle profile wasn't filled) — sending a
    // null-only appraisal would create a garbage row on the backend.
    if (!existing?.id && !valuesLookHydrated(values)) {
      onSaved?.(
        'The parent IA is missing its In-Principle profile — complete it before submitting the appraisal.',
        'warning',
      )
      return
    }
    const problem = firstProblem(schema, values)
    if (problem) {
      setShowAllErrors(true)
      onSaved?.('Please fix the highlighted fields.', 'warning')
      return
    }
    try {
      // Stamp the destination sub-stage so the backend advances the
      // workflow to DETAILED_APPRAISAL_SUBMITTED (id 10) when GT submits.
      // Updates go without a stageId — reviewer transitions ride the
      // approve endpoint (useApproveAppraisal), not the plain PUT.
      const submitStageId = stageIdForStage(
        stagesQ.data,
        STAGE.DETAILED_APPRAISAL,
        'DETAILED_APPRAISAL_SUBMITTED',
      )
      const withStage = { ...values, stageId: submitStageId }
      if (existing?.id) {
        await updateM.mutateAsync({ id: existing.id, body: toUpdatePayload(values, registrationId) })
      } else if (!isClusterExpert && !isSde) {
        await createM.mutateAsync(toCreatePayload(withStage, registrationId))
      } else {
        onSaved?.('No appraisal exists yet — GT must submit one first.', 'warning')
        return
      }

      const files = collectFiles()
      let uploadFailure = null
      if (files.length) {
        const tagged = files.map(({ file, slug }) => encodeFilename(file, slug))
        try {
          await uploadFilesBatch(registrationId, tagged)
        } catch (err) {
          uploadFailure = `${files.length} file${files.length === 1 ? '' : 's'} failed to upload (${err.message || 'unknown error'})`
        }
      }

      if (uploadFailure) {
        onSaved?.(`Appraisal saved. ${uploadFailure}.`, 'warning')
      } else {
        onSaved?.(
          isClusterExpert
            ? 'Cluster Expert comments saved.'
            : isSde
              ? 'Appraisal updated.'
              : 'Detailed appraisal submitted — now at Final Review (L2).',
          'success',
        )
      }
    } catch (err) {
      onSaved?.(err.message || 'Failed to submit appraisal.', 'error')
    }
  }

  if (iaQ.isLoading || apprQ.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
  }
  if (iaQ.error) {
    return <Alert severity="error">{iaQ.error.message || 'Failed to load IA'}</Alert>
  }

  const canSave = existing?.id || (!isClusterExpert && !isSde)
  const submitLabel = isClusterExpert
    ? (busy ? 'Saving…' : 'Save Comments')
    : isSde
      ? (busy ? 'Saving…' : 'Save changes')
      : (busy ? 'Submitting…' : existing ? 'Update & Resubmit' : 'Submit to SDE for Final Approval')

  const saveButton = (
    <Button
      variant="contained"
      startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
      disabled={busy || !canSave || !seeded}
      onClick={submit}
    >
      {submitLabel}
    </Button>
  )

  // Sustainability matrix is FK'd to the appraisal, so only offer the view
  // once an appraisal record actually exists (id resolved).
  const viewSustainability = (
    <Button
      variant="outlined"
      startIcon={<AssessmentOutlinedIcon />}
      onClick={() => setSustainOpen(true)}
      disabled={!existing?.id}
    >
      View Sustainability Matrix
    </Button>
  )

  if (stepper && schema.sections.length > 2) {
    return (
      <StepperLayout
        schema={schema}
        values={values}
        setValue={setValue}
        showAllErrors={showAllErrors}
        submit={submit}
        busy={busy}
        canSave={canSave}
        submitLabel={submitLabel}
        viewSustainability={viewSustainability}
        sustainOpen={sustainOpen}
        setSustainOpen={setSustainOpen}
        existing={existing}
        registrationId={registrationId}
      />
    )
  }

  return (
    <>
      {/* Top-right entry point for the read-only sustainability viewer.
          Sits above the form so it's reachable without scrolling to the
          sticky footer — reviewers usually want this context first. */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
        {viewSustainability}
      </Box>

      <FormRenderer schema={schema} accent="primary" values={values} setValue={setValue} showAllErrors={showAllErrors} />

      {stickyFooter ? (
        <Paper elevation={3} sx={{ position: 'sticky', bottom: 16, mt: 3, p: 1.5, borderRadius: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
          {saveButton}
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          {saveButton}
        </Box>
      )}

      <SustainabilityMatrixModal
        open={sustainOpen}
        onClose={() => setSustainOpen(false)}
        appraisalId={existing?.id}
        registrationId={registrationId}
      />
    </>
  )
}

// ── Workspace-style stepper layout ──────────────────────────────────────
// Mirrors the RegistrationTab UX: left-rail SectionStepper + one active
// section rendered via FormRenderer(chrome="minimal") + sticky footer
// with Prev / Continue / Submit. Keeps the workspace visually consistent
// across L1 and L2 forms.
function StepperLayout({
  schema, values, setValue, showAllErrors, submit, busy, canSave, submitLabel,
  viewSustainability, sustainOpen, setSustainOpen, existing, registrationId,
}) {
  const theme = useTheme()
  const sections = schema.sections
  const [activeIndex, setActiveIndex] = useState(0)
  const clampedActive = Math.min(activeIndex, sections.length - 1)
  const activeSection = sections[clampedActive]

  // Per-section completion. Cheap enough to recompute on every render —
  // no useDeferredValue plumbing yet; add if we see input jank.
  const completion = useMemo(() => {
    const map = {}
    for (const sec of sections) map[sec.n] = sectionState(sec, values)
    return map
  }, [sections, values])
  const completedCount = useMemo(
    () => Object.values(completion).filter((s) => s === 'done').length,
    [completion],
  )
  const canSubmit = canSave && !busy && completedCount === sections.length

  // Single-section schema — reuses the exact FormRenderer pipeline the
  // L1 form uses, just narrowed to the active section.
  const sectionSchema = useMemo(
    () => ({ ...schema, sections: [activeSection] }),
    [schema, activeSection],
  )

  const goPrev = useCallback(() => setActiveIndex((i) => Math.max(0, i - 1)), [])
  const goNext = useCallback(() => setActiveIndex((i) => Math.min(sections.length - 1, i + 1)), [sections.length])
  const goTo = useCallback((i) => setActiveIndex(i), [])
  const onSubmit = useCallback(() => {
    if (!canSubmit) {
      const firstBad = sections.findIndex((s) => completion[s.n] !== 'done')
      if (firstBad >= 0) setActiveIndex(firstBad)
    }
    submit()
  }, [canSubmit, sections, completion, submit])

  return (
    <>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Box sx={{ flex: 1 }} />
        {viewSustainability}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '260px 1fr' },
          columnGap: 4,
          rowGap: 3,
          alignItems: 'flex-start',
        }}
      >
        <Box sx={{ position: { md: 'sticky' }, top: { md: 96 } }}>
          <SectionStepper
            sections={sections}
            activeIndex={clampedActive}
            completion={completion}
            completedCount={completedCount}
            onSelect={goTo}
          />
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ mb: 3, pb: 2, borderBottom: 1, borderColor: alpha(theme.palette.text.primary, 0.08) }}>
            <Stack direction="row" alignItems="baseline" spacing={1.25} flexWrap="wrap">
              <Typography sx={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.015em' }}>
                {activeSection?.title || 'Section'}
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: theme.palette.text.disabled, fontWeight: 500 }}>
                Section {clampedActive + 1} of {sections.length}
              </Typography>
            </Stack>
            {activeSection?.desc && (
              <Typography sx={{ mt: 0.75, fontSize: 13.5, color: theme.palette.text.secondary }}>
                {activeSection.desc}
              </Typography>
            )}
          </Box>

          <Box sx={stackedLabelSx}>
            <FormRenderer
              schema={sectionSchema}
              accent="primary"
              values={values}
              setValue={setValue}
              showAllErrors={showAllErrors}
              chrome="minimal"
            />
          </Box>
        </Box>
      </Box>

      <RegistrationFooter
        activeIndex={clampedActive}
        sectionCount={sections.length}
        sectionName={activeSection?.title || ''}
        canSubmit={canSubmit}
        submitting={busy}
        completedCount={completedCount}
        onPrev={goPrev}
        onNext={goNext}
        onSubmit={onSubmit}
      />

      <SustainabilityMatrixModal
        open={sustainOpen}
        onClose={() => setSustainOpen(false)}
        appraisalId={existing?.id}
        registrationId={registrationId}
      />
    </>
  )
}

// Section-level state for the stepper — same three buckets the L1
// stepper uses.
function sectionState(sec, values) {
  const visible = (sec.fields || []).filter((f) => {
    if (['subheading', 'computed', 'coordinates_capture'].includes(f.type)) return false
    if (typeof f.showIf === 'function' && !f.showIf(values)) return false
    return true
  })
  if (visible.length === 0) return 'done'
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
