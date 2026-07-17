import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Stack, Typography, Button, Snackbar, Alert, Chip, Paper } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EastIcon from '@mui/icons-material/East'
import FormRenderer, { fieldError } from '../../components/FormRenderer'
import { inPrincipleSchema } from '../../formSchemas'
import { useData } from '../../store'

// First unmet requirement (missing required field or a validation error), if any.
function firstProblem(values) {
  for (const sec of inPrincipleSchema.sections) {
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

export default function InPrincipleApproval() {
  const navigate = useNavigate()
  const { addIA } = useData()
  const [values, setValues] = useState({})
  const [toast, setToast] = useState('')
  const setValue = (name, v) => setValues((p) => ({ ...p, [name]: v }))

  const submit = () => {
    const problem = firstProblem(values)
    if (problem) { setToast(problem); return }
    const id = addIA(values)
    setToast('done')
    setTimeout(() => navigate(`/gt/ias/${id}`), 1100)
  }

  return (
    <Box sx={{ maxWidth: 940, mx: 'auto', pb: 9 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/gt/ias')} sx={{ mb: 2 }}>IA Onboarding</Button>
      <Box textAlign="center" mb={3}>
        <Chip label="Level 1 · In-Principle Approval" sx={{ bgcolor: 'primary.light', color: 'primary.dark', mb: 1.5, fontWeight: 700 }} />
        <Typography variant="h4">In-Principle Approval</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 620, mx: 'auto' }}>
          Capture the Industry Association profile. On submit, it enters the pipeline and goes to the SIDBI SDE for review.
        </Typography>
      </Box>

      <FormRenderer schema={inPrincipleSchema} accent="primary" values={values} setValue={setValue} />

      <Paper elevation={3} sx={{ position: 'sticky', bottom: 16, mt: 3, p: 1.5, borderRadius: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
        <Button color="inherit" onClick={() => navigate('/gt/ias')}>Cancel</Button>
        <Button variant="contained" endIcon={<EastIcon />} onClick={submit}>Submit for Review</Button>
      </Paper>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={toast === 'done' ? 'success' : 'warning'} variant="filled">
          {toast === 'done' ? `${values.ia_name || 'New IA'} added to the onboarding pipeline.` : toast}
        </Alert>
      </Snackbar>
    </Box>
  )
}
