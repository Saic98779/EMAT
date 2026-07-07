import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Stack, Typography, Button, Snackbar, Alert, Chip } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EastIcon from '@mui/icons-material/East'
import FormRenderer from '../../components/FormRenderer'
import { inPrincipleSchema } from '../../formSchemas'

export default function InPrincipleApproval() {
  const navigate = useNavigate()
  const [toast, setToast] = useState(false)
  const submit = () => { setToast(true); setTimeout(() => navigate('/gt/ias'), 1300) }

  return (
    <Box sx={{ maxWidth: 940, mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/gt/ias')} sx={{ mb: 2 }}>IA Onboarding</Button>
      <Box textAlign="center" mb={3}>
        <Chip label="Level 1 · In-Principle Approval" color="primary" sx={{ bgcolor: 'primary.light', color: 'primary.dark', mb: 1.5, fontWeight: 700 }} />
        <Typography variant="h4">In-Principle Approval</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 620, mx: 'auto' }}>
          Capture the Industry Association profile. On submit, this goes to the SIDBI SDE for appraisal.
        </Typography>
      </Box>

      <FormRenderer schema={inPrincipleSchema} accent="primary" />

      <Stack direction="row" justifyContent="center" spacing={1.5} mt={4}>
        <Button variant="text" color="inherit" onClick={() => navigate('/gt/ias')}>Cancel</Button>
        <Button variant="contained" size="large" endIcon={<EastIcon />} onClick={submit}>Submit for Appraisal</Button>
      </Stack>

      <Snackbar open={toast} autoHideDuration={2200} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled">In-Principle Approval submitted to SIDBI SDE for appraisal.</Alert>
      </Snackbar>
    </Box>
  )
}
