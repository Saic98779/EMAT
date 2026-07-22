import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button, Snackbar, Alert, Chip, Paper } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EastIcon from '@mui/icons-material/East'
import FormRenderer, { fieldError } from '../../components/FormRenderer'
import { makeBseCandidateSchema } from '../../formSchemas'
import { useData } from '../../store'

// First unmet requirement (missing required field or a validation error), if any.
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

export default function BseCandidate() {
  const navigate = useNavigate()
  const { ias, addBseCandidate } = useData()
  const [values, setValues] = useState({})
  const [toast, setToast] = useState('')
  const setValue = (name, v) => setValues((p) => ({ ...p, [name]: v }))

  // Only IAs whose In-Principle Approval is cleared (stage >= 1) are eligible.
  const approvedIAs = useMemo(
    () => ias.filter((i) => (i.stage ?? 0) >= 1).map((i) => i.name),
    [ias],
  )
  const schema = useMemo(() => makeBseCandidateSchema(approvedIAs), [approvedIAs])

  const submit = () => {
    const problem = firstProblem(schema, values)
    if (problem) { setToast(problem); return }
    addBseCandidate(values)
    setToast('done')
    setTimeout(() => navigate('/gt/team'), 1100)
  }

  return (
    <Box sx={{ maxWidth: 940, mx: 'auto', pb: 9 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/gt/team')} sx={{ mb: 2 }}>BSE Team</Button>
      <Box textAlign="center" mb={3}>
        <Chip label="BSE Onboarding · Candidate Proposal" sx={{ bgcolor: 'primary.light', color: 'primary.dark', mb: 1.5, fontWeight: 700 }} />
        <Typography variant="h4">Propose a BSE Candidate</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 640, mx: 'auto' }}>
          To be filled by GT Field Manager. Captures candidate profile, salary expectations, documents and your recommendation for the selected Industry Association.
        </Typography>
      </Box>

      <FormRenderer schema={schema} accent="primary" values={values} setValue={setValue} />

      <Paper elevation={3} sx={{ position: 'sticky', bottom: 16, mt: 3, p: 1.5, borderRadius: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
        <Button color="inherit" onClick={() => navigate('/gt/team')}>Cancel</Button>
        <Button variant="contained" endIcon={<EastIcon />} onClick={submit}>Submit Proposal</Button>
      </Paper>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={toast === 'done' ? 'success' : 'warning'} variant="filled">
          {toast === 'done' ? `${values.bse_name || 'Candidate'} proposed for ${values.ia_name || 'IA'}.` : toast}
        </Alert>
      </Snackbar>
    </Box>
  )
}
