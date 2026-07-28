import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Box, Stack, Typography, Button, Snackbar, Alert, Chip, Paper } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PaymentsIcon from '@mui/icons-material/Payments'
import FormRenderer, { defaultsFor } from '../../components/FormRenderer'
import { capexSchema } from '../../formSchemas'
import { useData } from '../../store'

// GT disbursement note for a CAPEX purchase (post-sanction).
export default function CapexNote() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { ias, addCapex } = useData()
  const ia = ias.find((x) => x.id === id)
  const [values, setValues] = useState(() => ({ ...defaultsFor(capexSchema), ...(ia ? { ia_name: ia.name } : {}) }))
  const [toast, setToast] = useState(false)
  const setValue = useCallback((name, v) => setValues((p) => ({ ...p, [name]: v })), [])

  const submit = () => { addCapex(values); setToast(true); setTimeout(() => navigate('/gt/disbursals'), 1200) }

  return (
    <Box sx={{ maxWidth: 940, mx: 'auto', pb: 9 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/gt/ias')} sx={{ mb: 2 }}>IA Onboarding</Button>
      <Box textAlign="center" mb={3}>
        <Chip label="Disbursement Note · CAPEX" sx={{ bgcolor: 'primary.light', color: 'primary.dark', mb: 1.5, fontWeight: 700 }} />
        <Typography variant="h4">CAPEX Disbursement Note</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 640, mx: 'auto' }}>
          {ia ? `${ia.name} · ${ia.id}` : 'CAPEX purchase disbursement'} — verify the purchase in IA premises. IGST & total are auto-calculated.
        </Typography>
      </Box>

      <FormRenderer schema={capexSchema} accent="primary" values={values} setValue={setValue} />

      <Paper elevation={3} sx={{ position: 'sticky', bottom: 16, mt: 3, p: 1.5, borderRadius: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
        <Button color="inherit" onClick={() => navigate('/gt/ias')}>Cancel</Button>
        <Button variant="contained" startIcon={<PaymentsIcon />} onClick={submit}>Disburse CAPEX</Button>
      </Paper>

      <Snackbar open={toast} autoHideDuration={2000} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled">CAPEX disbursement recorded in Disbursals.</Alert>
      </Snackbar>
    </Box>
  )
}
