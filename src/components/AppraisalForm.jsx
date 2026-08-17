import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Button, CircularProgress, Alert, Paper } from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import FormRenderer, { fieldError } from './FormRenderer'
import { appraisalSchema } from '../formSchemas'
import {
  useIA,
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
import { uploadFilesBatch } from '../apis/files'
import { encodeFilename, FILE_FIELD_LABELS, FILE_FIELD_SEP } from '../fileFieldLabels'
import { useAuth } from '../auth'

// Same validation walk used across all form pages — returns the first
// True if at least one of the "autofetched from parent IA" fields carries
// a real value. Used as a safety net before POSTing a NEW appraisal — if
// none of these are filled, either the seed never ran or the parent IA
// is a matrix-only stub with no In-Principle profile. Either way, POSTing
// would create a garbage row of all-nulls on the backend.
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
  return {
    ...src,
    sections: src.sections
      .filter((sec) =>
        sec.title !== 'Cluster Expert Comments' &&
        sec.title !== 'Comments on Due Diligence',
      )
      .map(lockCeFields),
  }
}

// Standalone appraisal form. Handles schema selection, seed from parent IA,
// value editing, file uploads, and PUT/POST.
//
// Props:
//   registrationUuid : the parent IA uuid — required.
//   onSaved(msg, severity) : optional callback after save/upload finish.
//   stickyFooter (default false) : renders the save button in a sticky Paper
//                                  bar (page-mode); when embedded, pass
//                                  false and the button sits inline below.
export default function AppraisalForm({ registrationUuid, onSaved, stickyFooter = false }) {
  const { rawRole } = useAuth()
  const isClusterExpert = rawRole === 'CLUSTER_EXPERT'
  const isSde = rawRole === 'SIDBI_SDE'
  const schema = useMemo(() => schemaFor(rawRole), [rawRole])

  const iaQ = useIA(registrationUuid)
  const apprQ = useAppraisalByRegistration(registrationUuid)
  const branchesQ = useBranchesByState(iaQ.data?.state)
  const filesQ = useFilesByRegistration(registrationUuid)
  const createM = useCreateAppraisal()
  const updateM = useUpdateAppraisal()

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
    const branchName = branchesQ.data?.find((b) => b.uuid === r.sidbiBranch)?.branchName ?? r.sidbiBranch
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
    // `toFormValues` may overlay `sidbi_branch` with the raw UUID stored on
    // the appraisal DTO (backend copies it from the IA at creation). If it
    // still looks like a UUID after merge, swap in the human name from the
    // resolved branches list — otherwise the field renders as a GUID.
    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (typeof merged.sidbi_branch === 'string' && uuidLike.test(merged.sidbi_branch)) {
      const match = branchesQ.data?.find((b) => b.uuid === merged.sidbi_branch)
      if (match?.branchName) merged.sidbi_branch = match.branchName
    }
    setValues({ ...merged, _seeded: true })
  }, [seeded, iaQ.data, iaQ.isLoading, apprQ.data, apprQ.isLoading, branchesQ.data, branchesQ.isLoading, filesQ.data, filesQ.isLoading])

  const busy = createM.isPending || updateM.isPending
  const existing = apprQ.data

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
    if (!existing?.uuid && !valuesLookHydrated(values)) {
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
      if (existing?.uuid) {
        await updateM.mutateAsync({ uuid: existing.uuid, body: toUpdatePayload(values, registrationUuid) })
      } else if (!isClusterExpert && !isSde) {
        await createM.mutateAsync(toCreatePayload(values, registrationUuid))
      } else {
        onSaved?.('No appraisal exists yet — GT must submit one first.', 'warning')
        return
      }

      const files = collectFiles()
      let uploadFailure = null
      if (files.length) {
        const tagged = files.map(({ file, slug }) => encodeFilename(file, slug))
        try {
          await uploadFilesBatch(registrationUuid, tagged)
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

  const canSave = existing?.uuid || (!isClusterExpert && !isSde)
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

  return (
    <>
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

    </>
  )
}
