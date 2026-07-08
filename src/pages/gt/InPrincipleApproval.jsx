import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Stack, Typography, Button, Snackbar, Alert, Chip, Paper } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EastIcon from '@mui/icons-material/East'
import FormRenderer from '../../components/FormRenderer'
import { inPrincipleSchema } from '../../formSchemas'
import { useData } from '../../store'

export default function InPrincipleApproval() {
  const navigate = useNavigate()
  const { addIA } = useData()
  const [values, setValues] = useState({})
  const [toast, setToast] = useState(false)
  const setValue = (name, v) => setValues((p) => ({ ...p, [name]: v }))

  const submit = () => {
    const id = addIA(values)
    setToast(true)
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

      <Snackbar open={toast} autoHideDuration={2000} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled">{values.ia_name || 'New IA'} added to the onboarding pipeline.</Alert>
      </Snackbar>
    </Box>
  )
}
