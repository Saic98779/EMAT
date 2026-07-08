import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Box, Stack, Typography, Button, Snackbar, Alert, Chip, Paper } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EastIcon from '@mui/icons-material/East'
import FormRenderer from '../../components/FormRenderer'
import { appraisalSchema } from '../../formSchemas'
import { useData } from '../../store'

// Detailed appraisal — captured by the GT field team after basic (L1) approval.
export default function Appraisal() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { ias, submitAppraisal } = useData()
  const ia = ias.find((x) => x.id === id)
  const [values, setValues] = useState(ia ? { state: ia.state, ia_name: ia.name, sidbi_branch: ia.branch, district: ia.city, year_incorp: String(ia.est) } : {})
  const [toast, setToast] = useState(false)
  const setValue = (name, v) => setValues((p) => ({ ...p, [name]: v }))

  const submit = () => { submitAppraisal(id, values); setToast(true); setTimeout(() => navigate(`/gt/ias/${id}`), 1100) }

  return (
    <Box sx={{ maxWidth: 940, mx: 'auto', pb: 9 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/gt/ias')} sx={{ mb: 2 }}>IA Onboarding</Button>
      <Box textAlign="center" mb={3}>
        <Chip label="Detailed Appraisal" sx={{ bgcolor: 'primary.light', color: 'primary.dark', mb: 1.5, fontWeight: 700 }} />
        <Typography variant="h4">Detailed Appraisal</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 640, mx: 'auto' }}>
          {ia ? `${ia.name} · ${ia.id}` : 'Complete the full 15-point appraisal'} — basic proposal approved by SIDBI SDE. Complete all points and submit for final approval.
        </Typography>
      </Box>

      <FormRenderer schema={appraisalSchema} accent="primary" values={values} setValue={setValue} />

      <Paper elevation={3} sx={{ position: 'sticky', bottom: 16, mt: 3, p: 1.5, borderRadius: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
        <Button color="inherit" onClick={() => navigate('/gt/ias')}>Save draft</Button>
        <Button variant="contained" endIcon={<EastIcon />} onClick={submit}>Submit to SDE for Final Approval</Button>
      </Paper>

      <Snackbar open={toast} autoHideDuration={2000} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled">Detailed appraisal submitted — now at Final Review (L2).</Alert>
      </Snackbar>
    </Box>
  )
}
