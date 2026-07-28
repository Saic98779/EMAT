import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Box, Stack, Typography, Button, Snackbar, Alert, Chip, Paper, CircularProgress } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EastIcon from '@mui/icons-material/East'
import FormRenderer from '../../components/FormRenderer'
import { appraisalSchema } from '../../formSchemas'
import {
  useIA,
  useAppraisalByRegistration,
  useBranchesByState,
  useCreateAppraisal,
  useUpdateAppraisal,
} from '../../queries'
import {
  toCreatePayload,
  toUpdatePayload,
  toFormValues,
} from '../../apis/industryAssociationAppraisals'
import { useAuth } from '../../auth'

// Two schema shapes derived from the base appraisalSchema:
//   CLUSTER_EXPERT → everything read-only except cluster_expert_comments.
//   GT / SDE       → drop the Cluster Expert Comments section entirely
//                    (they view CE comments on the ProposalDetail card).
//                    Base schema's readOnly settings are respected —
//                    sections 1–4 stay read-only per spec.
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
  return {
    ...src,
    sections: src.sections.filter((sec) => sec.title !== 'Cluster Expert Comments'),
  }
}

// Detailed appraisal (Level 2) — captured by the GT field team after basic
// (L1) approval. If an appraisal already exists for this IA the form is
// prefilled and submit does a PUT; otherwise POST creates a new one.
//
// NOTE: the raw form values are sent as the request body. Once the backend
// exposes an `IndustryAssociationAppraisalCreateRequest` schema, add a
// `toPayload(values)` adapter (like industryAssociations.js does) and wrap
// the calls below.
export default function Appraisal({ backPath = '/gt/ias' } = {}) {
  const navigate = useNavigate()
  const { id } = useParams()   // registrationUuid
  const { rawRole } = useAuth()
  const isClusterExpert = rawRole === 'CLUSTER_EXPERT'
  const isSde = rawRole === 'SIDBI_SDE'
  const schema = useMemo(() => schemaFor(rawRole), [rawRole])

  const iaQ = useIA(id)
  const apprQ = useAppraisalByRegistration(id)
  const branchesQ = useBranchesByState(iaQ.data?.state)
  const createM = useCreateAppraisal()
  const updateM = useUpdateAppraisal()

  const [values, setValues] = useState({})
  const [toast, setToast] = useState({ severity: '', msg: '' })
  const setValue = useCallback((name, v) => setValues((p) => ({ ...p, [name]: v })), [])

  // Seed the form once IA + appraisal + branches have loaded. The seed comes
  // from the parent IA registration for all "Autofetched from In-Principle"
  // spec fields (identity, address, apex/nodal, cluster, existing infra,
  // basis of selection, grant, envisaged). If an appraisal already exists,
  // its own values win via toFormValues (revise flow).
  useEffect(() => {
    if (iaQ.isLoading || apprQ.isLoading) return
    const ia = iaQ.data
    const r = ia?.raw || {}
    const branchName = branchesQ.data?.find((b) => b.uuid === r.sidbiBranch)?.branchName ?? r.sidbiBranch
    const yn = (b) => (b === true ? 'yes' : b === false ? 'no' : '')
    const YN = (b) => (b === true ? 'Yes' : b === false ? 'No' : '')
    const seed = ia ? {
      // Identity (readonly)
      state: r.state ?? '',
      ia_name: r.industryAssociationName ?? '',
      year_incorp: r.incorporationDate ? String(new Date(r.incorporationDate).getFullYear()) : '',
      ia_profit_type: r.iaType ?? '',
      proof_constitution: r.constitutionType === 'Other'
        ? `Other — ${r.constitutionOther ?? ''}`
        : (r.constitutionType ?? ''),
      district: r.district ?? '',
      pincode: r.pincode ?? '',
      // Apex/Nodal (autofetched + editable)
      apex_name: r.apexHolderName ?? '',
      apex_designation: r.apexHolderDesignation ?? '',
      apex_contact: r.apexHolderMobile ?? '',
      apex_email: r.apexHolderEmail ?? '',
      nodal_name: r.nodalName ?? '',
      nodal_designation: r.nodalDesignation ?? '',
      nodal_contact: r.nodalMobile ?? '',
      nodal_email: r.nodalEmail ?? '',
      // Nearest SIDBI branch (resolved name)
      sidbi_branch: branchName ?? '',
      // Cluster / district (readonly mirrors)
      cluster_mapped: yn(r.mappedWithCluster),
      cluster_which: r.clusterName ?? '',
      district_mapped: yn(r.mappedWithImportantDistrict),
      msme_count: r.msmeCountWithoutTraders ?? '',
      // Existing infra (autofetched + editable)
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
      // Basis of selection + Grant + Envisaged (readonly mirrors)
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
  const ia = iaQ.data

  const submit = async () => {
    try {
      if (existing?.uuid) {
        await updateM.mutateAsync({ uuid: existing.uuid, body: toUpdatePayload(values, id) })
      } else if (!isClusterExpert && !isSde) {
        // Only GT creates the appraisal for the first time; CE / SDE edit an
        // existing one.
        await createM.mutateAsync(toCreatePayload(values, id))
      } else {
        setToast({ severity: 'warning', msg: 'No appraisal exists yet — GT must submit one first.' })
        return
      }
      setToast({
        severity: 'success',
        msg: isClusterExpert
          ? 'Cluster Expert comments saved.'
          : isSde
            ? 'Appraisal updated.'
            : 'Detailed appraisal submitted — now at Final Review (L2).',
      })
      setTimeout(() => navigate(`${backPath}/${id}`), 1100)
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Failed to submit appraisal.' })
    }
  }

  if (iaQ.isLoading || apprQ.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  }
  if (iaQ.error) {
    return (
      <Box sx={{ maxWidth: 940, mx: 'auto' }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/gt/ias')} sx={{ mb: 2 }}>IA Onboarding</Button>
        <Alert severity="error">{iaQ.error.message || 'Failed to load IA'}</Alert>
      </Box>
    )
  }

  const chipLabel = isClusterExpert
    ? 'Cluster Expert · Review'
    : isSde
      ? 'SDE · Edit Appraisal'
      : existing ? 'Detailed Appraisal · Revising' : 'Detailed Appraisal'
  const subtitle = isClusterExpert
    ? 'Reviewing the detailed appraisal. All fields are read-only; add your comments below and save.'
    : isSde
      ? `${ia?.name || ''} — modify any field submitted by GT / Cluster Expert before granting Final (L2) approval.`
      : `${ia?.name || 'Complete the full 15-point appraisal'} — basic proposal approved by SIDBI SDE. Complete all points and submit for final approval.`
  const submitLabel = isClusterExpert
    ? (busy ? 'Saving…' : 'Save Comments')
    : isSde
      ? (busy ? 'Saving…' : 'Save changes')
      : (busy ? 'Submitting…' : existing ? 'Update & Resubmit' : 'Submit to SDE for Final Approval')

  return (
    <Box sx={{ maxWidth: 940, mx: 'auto', pb: 9 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(backPath)} sx={{ mb: 2 }}>Back</Button>
      <Box textAlign="center" mb={3}>
        <Chip label={chipLabel}
          sx={{ bgcolor: 'primary.light', color: 'primary.dark', mb: 1.5, fontWeight: 700 }} />
        <Typography variant="h4">Detailed Appraisal</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 640, mx: 'auto' }}>
          {subtitle}
        </Typography>
      </Box>

      <FormRenderer schema={schema} accent="primary" values={values} setValue={setValue} />

      <Paper elevation={3} sx={{ position: 'sticky', bottom: 16, mt: 3, p: 1.5, borderRadius: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
        <Button color="inherit" onClick={() => navigate(`${backPath}/${id}`)} disabled={busy}>Cancel</Button>
        <Button
          variant="contained"
          endIcon={busy ? <CircularProgress size={16} color="inherit" /> : <EastIcon />}
          disabled={busy || ((isClusterExpert || isSde) && !existing)}
          onClick={submit}
        >
          {submitLabel}
        </Button>
      </Paper>

      <Snackbar
        open={!!toast.msg}
        autoHideDuration={3000}
        onClose={() => setToast({ severity: '', msg: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast.severity || 'info'} variant="filled" onClose={() => setToast({ severity: '', msg: '' })}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}
