import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Stack, Typography, Button, Snackbar, Alert, Chip, Paper } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PaymentsIcon from '@mui/icons-material/Payments'
import FormRenderer, { defaultsFor } from '../../components/FormRenderer'
import { salarySchema } from '../../formSchemas'
import { useData } from '../../store'

// GT disburses BSE salary through the manpower agency.
export default function BseSalary() {
  const navigate = useNavigate()
  const { addSalary } = useData()
  const [values, setValues] = useState(() => defaultsFor(salarySchema))
  const [toast, setToast] = useState(false)
  const setValue = (name, v) => setValues((p) => ({ ...p, [name]: v }))

  const submit = () => { addSalary(values); setToast(true); setTimeout(() => navigate('/gt/disbursals'), 1200) }

  return (
    <Box sx={{ maxWidth: 940, mx: 'auto', pb: 9 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/gt/team')} sx={{ mb: 2 }}>BSE Team</Button>
      <Box textAlign="center" mb={3}>
        <Chip label="BSE Salary Disbursement" sx={{ bgcolor: 'primary.light', color: 'primary.dark', mb: 1.5, fontWeight: 700 }} />
        <Typography variant="h4">Disburse BSE Salary</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 640, mx: 'auto' }}>
          Salary payment to BSEs via the manpower agency. IGST, total and BSE payout are auto-calculated.
        </Typography>
      </Box>

      <FormRenderer schema={salarySchema} accent="primary" values={values} setValue={setValue} />

      <Paper elevation={3} sx={{ position: 'sticky', bottom: 16, mt: 3, p: 1.5, borderRadius: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
        <Button color="inherit" onClick={() => navigate('/gt/team')}>Cancel</Button>
        <Button variant="contained" startIcon={<PaymentsIcon />} onClick={submit}>Disburse Salary</Button>
      </Paper>

      <Snackbar open={toast} autoHideDuration={2000} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled">BSE salary disbursed — recorded in Disbursals.</Alert>
      </Snackbar>
    </Box>
  )
}
