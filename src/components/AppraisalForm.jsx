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
} from '../queries'
import {
  toCreatePayload,
  toUpdatePayload,
  toFormValues,
} from '../apis/industryAssociationAppraisals'
import { uploadFile } from '../apis/files'
import { encodeFilename } from '../fileFieldLabels'
import { useAuth } from '../auth'

// Same validation walk used across all form pages — returns the first
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

// Role-shaped schema:
//   CLUSTER_EXPERT → everything read-only except cluster_expert_comments.
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
        fields: sec.fields.map((f) =>
          f.name === 'cluster_expert_comments' ? f : { ...f, readOnly: true },
        ),
      })),
    }
  }
  if (role === 'SIDBI_SDE') {
    return { ...src, sections: src.sections.filter((sec) => sec.title !== 'Cluster Expert Comments') }
  }
  return {
    ...src,
    sections: src.sections.filter((sec) =>
      sec.title !== 'Cluster Expert Comments' &&
      sec.title !== 'Comments on Due Diligence',
    ),
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
  const createM = useCreateAppraisal()
  const updateM = useUpdateAppraisal()

  const [values, setValues] = useState({})
  const [showAllErrors, setShowAllErrors] = useState(false)
  const setValue = useCallback((name, v) => setValues((p) => ({ ...p, [name]: v })), [])

  // Seed the form once IA + appraisal + branches have loaded. Preserves any
  // DD keys already on the appraisal even if the current role's schema hides
  // them, so GT re-saves don't wipe SDE's DD data.
  useEffect(() => {
    if (iaQ.isLoading || apprQ.isLoading) return
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
      basis_of_selection: Array.isArray(r.selectionCriteria) ? r.selectionCriteria : [],
      grant_proposed: r.grantProposed ?? '',
      grant_details: r.grantDetails ?? '',
      envisaged_output: r.envisagedOutput ?? '',
      envisaged_outcome: r.envisagedOutcome ?? '',
      envisaged_impact: r.envisagedImpact ?? '',
    } : {}
    setValues({ ...seed, ...toFormValues(apprQ.data) })
  }, [iaQ.data, iaQ.isLoading, apprQ.data, apprQ.isLoading, branchesQ.data])

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
        const failures = []
        for (const { file, slug } of files) {
          const tagged = encodeFilename(file, slug)
          try { await uploadFile(registrationUuid, tagged) }
          catch (err) { failures.push({ name: file.name, msg: err.message || 'unknown error' }) }
        }
        if (failures.length) {
          const first = failures[0]
          uploadFailure = `${failures.length} of ${files.length} file${files.length === 1 ? '' : 's'} failed (e.g. "${first.name}": ${first.msg})`
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
      disabled={busy || !canSave}
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
