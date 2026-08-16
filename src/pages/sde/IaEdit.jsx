import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Box, Typography, Button, Snackbar, Alert, Chip, Paper, CircularProgress, Stack } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import EligibilityMatrixModal from '../../components/EligibilityMatrixModal'
import FormRenderer, { fieldError } from '../../components/FormRenderer'
import { makeInPrincipleSchema } from '../../formSchemas'
import { toFormValues } from '../../apis/industryAssociations'
import { useIA, useUpdateIA, useBranchesByState, useSdesByBranch, useFilesByRegistration } from '../../queries'
import { FILE_FIELD_LABELS, FILE_FIELD_SEP } from '../../fileFieldLabels'
import { useAuth } from '../../auth'

// SDE edit for the In-Principle registration. Reuses the same schema and
// FormRenderer as the create page (`InPrincipleApproval.jsx`) so field names
// / validations stay in one place. Prefill comes from useIA → toFormValues.
function firstProblem(schema, values) {
  for (const sec of schema.sections) {
    for (const f of sec.fields) {
      if (f.showIf && !f.showIf(values)) continue
      const v = values[f.name]
      const filled = Array.isArray(v) ? v.length > 0 : v != null && v !== ''
      if (f.required && !filled) return `${sec.title}: “${f.label}” is required`
      const err = fieldError(f, v, values)
      if (err) return `${sec.title}: ${f.label} — ${err}`
    }
  }
  return null
}

export default function IaEdit() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user } = useAuth()

  const iaQ = useIA(id)
  const updateM = useUpdateIA()
  const filesQ = useFilesByRegistration(id)

  const [values, setValues] = useState({})
  const [toast, setToast] = useState({ severity: '', msg: '' })
  const [showAllErrors, setShowAllErrors] = useState(false)
  const [matrixOpen, setMatrixOpen] = useState(false)
  const seeded = Boolean(values._seeded)

  // Cascade behaviour — mirrors InPrincipleApproval.
  const setValue = useCallback((name, v) => {
    setValues((prev) => {
      if (name === 'state') return { ...prev, state: v, sidbi_branch: '', select_sde: '' }
      if (name === 'sidbi_branch') return { ...prev, sidbi_branch: v, select_sde: '' }
      return { ...prev, [name]: v }
    })
  }, [])

  // Seed from the loaded IA once — wait until both the IA record AND the
  // file list have returned so the initial values include already-uploaded
  // documents. (We still let the form render before files load; we just
  // don't stamp the _seeded marker until we can seed files.)
  useEffect(() => {
    if (!iaQ.data?.raw || seeded) return
    if (filesQ.isLoading) return
    // Group backend files by their slot slug so each `type: 'file'` field
    // starts populated with the list of already-uploaded filenames.
    const bySlot = {}
    for (const f of filesQ.data || []) {
      const fname = f?.filename
      if (typeof fname !== 'string') continue
      const idx = fname.indexOf(FILE_FIELD_SEP)
      if (idx <= 0) continue
      const slug = fname.slice(0, idx)
      if (!(slug in FILE_FIELD_LABELS)) continue
      if (!bySlot[slug]) bySlot[slug] = []
      bySlot[slug].push(fname)
    }
    setValues({ ...toFormValues(iaQ.data.raw), ...bySlot, _seeded: true })
  }, [iaQ.data, filesQ.data, filesQ.isLoading, seeded])

  // Cascading dropdowns.
  const branchesQ = useBranchesByState(values.state)
  const sdesQ = useSdesByBranch(values.sidbi_branch)

  const branchOptions = useMemo(
    () => (branchesQ.data || []).map((b) => ({ value: b.uuid, label: b.branchName })),
    [branchesQ.data],
  )
  const sdeOptions = useMemo(
    () => (sdesQ.data || []).map((s) => ({ value: s.uuid, label: s.name })),
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

  const schema = useMemo(
    () => makeInPrincipleSchema({ branchOptions, sdeOptions, branchHelp, sdeHelp }),
    [branchOptions, sdeOptions, branchHelp, sdeHelp],
  )

  const busy = updateM.isPending

  const submit = async () => {
    if (busy) return
    const problem = firstProblem(schema, values)
    if (problem) {
      setShowAllErrors(true)
      setToast({ severity: 'warning', msg: 'Please fix the highlighted fields.' })
      return
    }
    try {
      await updateM.mutateAsync({
        uuid: id,
        values,
        extra: { updatedBy: user?.username },
      })
      setToast({ severity: 'success', msg: 'Registration updated.' })
      setTimeout(() => navigate(`/sde/ias/${id}`), 900)
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Failed to save.' })
    }
  }

  if (iaQ.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  }
  if (iaQ.error) {
    return (
      <Box sx={{ maxWidth: 940, mx: 'auto' }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/sde/ias')} sx={{ mb: 2 }}>Back</Button>
        <Alert severity="error">{iaQ.error.message || 'Failed to load IA'}</Alert>
      </Box>
    )
  }
  const ia = iaQ.data

  return (
    <Box sx={{ maxWidth: 940, mx: 'auto', pb: 9 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/sde/ias/${id}`)}>Back to review</Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AssessmentOutlinedIcon />}
          onClick={() => setMatrixOpen(true)}
          sx={{ textTransform: 'none' }}
        >
          View Eligibility Matrix
        </Button>
      </Stack>
      <Box textAlign="center" mb={3}>
        <Chip label="SDE · Edit Registration" sx={{ bgcolor: 'primary.light', color: 'primary.dark', mb: 1.5, fontWeight: 700 }} />
        <Typography variant="h4">Edit In-Principle Registration</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 620, mx: 'auto' }}>
          {ia?.name} — modify any field submitted by the GT field team before granting L1 approval.
          State and IA name were captured up-front on the eligibility matrix.
        </Typography>
      </Box>

      <FormRenderer schema={schema} accent="primary" values={values} setValue={setValue} showAllErrors={showAllErrors} />

      <EligibilityMatrixModal
        open={matrixOpen}
        onClose={() => setMatrixOpen(false)}
        registrationUuid={id}
      />

      <Paper elevation={3} sx={{ position: 'sticky', bottom: 16, mt: 3, p: 1.5, borderRadius: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
        <Button color="inherit" onClick={() => navigate(`/sde/ias/${id}`)} disabled={busy}>Cancel</Button>
        <Button
          variant="contained"
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={submit}
          disabled={busy}
        >
          {busy ? 'Saving…' : 'Save changes'}
        </Button>
      </Paper>

      <Snackbar
        open={!!toast.msg}
        autoHideDuration={3500}
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
