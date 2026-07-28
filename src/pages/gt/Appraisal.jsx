import { useCallback, useEffect, useState } from 'react'
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

// Detailed appraisal (Level 2) — captured by the GT field team after basic
// (L1) approval. If an appraisal already exists for this IA the form is
// prefilled and submit does a PUT; otherwise POST creates a new one.
//
// NOTE: the raw form values are sent as the request body. Once the backend
// exposes an `IndustryAssociationAppraisalCreateRequest` schema, add a
// `toPayload(values)` adapter (like industryAssociations.js does) and wrap
// the calls below.
export default function Appraisal() {
  const navigate = useNavigate()
  const { id } = useParams()   // registrationUuid

  const iaQ = useIA(id)
  const apprQ = useAppraisalByRegistration(id)
  const branchesQ = useBranchesByState(iaQ.data?.state)
  const createM = useCreateAppraisal()
  const updateM = useUpdateAppraisal()

  const [values, setValues] = useState({})
  const [toast, setToast] = useState({ severity: '', msg: '' })
  const setValue = useCallback((name, v) => setValues((p) => ({ ...p, [name]: v })), [])

  // Seed the form once IA + appraisal + branches have loaded. `ia.branch` is
  // stored as a UUID; look up its display name from the branch list.
  useEffect(() => {
    if (iaQ.isLoading || apprQ.isLoading) return
    const ia = iaQ.data
    const branchName = branchesQ.data?.find((b) => b.uuid === ia?.branch)?.branchName ?? ia?.branch
    const seed = ia
      ? { state: ia.state, ia_name: ia.name, sidbi_branch: branchName, district: ia.city, year_incorp: String(ia.est) }
      : {}
    setValues({ ...seed, ...toFormValues(apprQ.data) })
  }, [iaQ.data, iaQ.isLoading, apprQ.data, apprQ.isLoading, branchesQ.data])

  const busy = createM.isPending || updateM.isPending
  const existing = apprQ.data
  const ia = iaQ.data

  const submit = async () => {
    try {
      if (existing?.uuid) {
        await updateM.mutateAsync({ uuid: existing.uuid, body: toUpdatePayload(values, id) })
      } else {
        await createM.mutateAsync(toCreatePayload(values, id))
      }
      setToast({ severity: 'success', msg: 'Detailed appraisal submitted — now at Final Review (L2).' })
      setTimeout(() => navigate(`/gt/ias/${id}`), 1100)
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

  return (
    <Box sx={{ maxWidth: 940, mx: 'auto', pb: 9 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/gt/ias')} sx={{ mb: 2 }}>IA Onboarding</Button>
      <Box textAlign="center" mb={3}>
        <Chip label={existing ? 'Detailed Appraisal · Revising' : 'Detailed Appraisal'}
          sx={{ bgcolor: 'primary.light', color: 'primary.dark', mb: 1.5, fontWeight: 700 }} />
        <Typography variant="h4">Detailed Appraisal</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 640, mx: 'auto' }}>
          {ia ? `${ia.name} · ${ia.id}` : 'Complete the full 15-point appraisal'} — basic proposal approved by SIDBI SDE.
          Complete all points and submit for final approval.
        </Typography>
      </Box>

      <FormRenderer schema={appraisalSchema} accent="primary" values={values} setValue={setValue} />

      <Paper elevation={3} sx={{ position: 'sticky', bottom: 16, mt: 3, p: 1.5, borderRadius: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
        <Button color="inherit" onClick={() => navigate(`/gt/ias/${id}`)} disabled={busy}>Cancel</Button>
        <Button
          variant="contained"
          endIcon={busy ? <CircularProgress size={16} color="inherit" /> : <EastIcon />}
          disabled={busy}
          onClick={submit}
        >
          {busy ? 'Submitting…' : existing ? 'Update & Resubmit' : 'Submit to SDE for Final Approval'}
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
