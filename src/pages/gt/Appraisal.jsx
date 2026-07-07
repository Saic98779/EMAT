import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Box, Stack, Typography, Button, Snackbar, Alert, Chip } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EastIcon from '@mui/icons-material/East'
import FormRenderer from '../../components/FormRenderer'
import { appraisalSchema } from '../../formSchemas'
import { industryAssociations } from '../../data'

// Detailed appraisal — captured by the GT field team after basic (L1) approval.
export default function Appraisal() {
  const navigate = useNavigate()
  const { id } = useParams()
  const ia = industryAssociations.find((x) => x.id === id)
  const [toast, setToast] = useState(false)
  const submit = () => { setToast(true); setTimeout(() => navigate('/gt/ias'), 1300) }

  return (
    <Box sx={{ maxWidth: 940, mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/gt/ias')} sx={{ mb: 2 }}>IA Onboarding</Button>
      <Box textAlign="center" mb={3}>
        <Chip label="Detailed Appraisal" color="primary" sx={{ bgcolor: 'primary.light', color: 'primary.dark', mb: 1.5, fontWeight: 700 }} />
        <Typography variant="h4">Detailed Appraisal</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 640, mx: 'auto' }}>
          {ia ? `${ia.name} · ${ia.id}` : 'Complete the full 15-point appraisal'} — basic proposal approved by SIDBI SDE. Complete all points and submit for final approval.
        </Typography>
      </Box>

      <FormRenderer schema={appraisalSchema} accent="primary" />

      <Stack direction="row" justifyContent="center" spacing={1.5} mt={4}>
        <Button variant="text" color="inherit" onClick={() => navigate('/gt/ias')}>Save draft</Button>
        <Button variant="contained" size="large" endIcon={<EastIcon />} onClick={submit}>Submit to SDE for Final Approval</Button>
      </Stack>

      <Snackbar open={toast} autoHideDuration={2200} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled">Detailed appraisal submitted to SIDBI SDE for final approval.</Alert>
      </Snackbar>
    </Box>
  )
}
