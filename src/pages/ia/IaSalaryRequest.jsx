import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Stack, Typography, Button, Snackbar, Alert, Chip, Paper } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SendIcon from '@mui/icons-material/Send'
import FormRenderer, { defaultsFor } from '../../components/FormRenderer'
import DocUpload from '../../components/DocUpload'
import { salaryRequestSchema } from '../../formSchemas'
import { useData } from '../../store'
import { useAuth } from '../../auth'

// Industry Association raises a BSE salary disbursement request.
export default function IaSalaryRequest() {
  const navigate = useNavigate()
  const { addSalaryRequest } = useData()
  const { roleInfo } = useAuth()
  const [values, setValues] = useState(() => ({ ...defaultsFor(salaryRequestSchema), ia_name: roleInfo.user.title }))
  const [docs, setDocs] = useState([])
  const [toast, setToast] = useState('')
  const setValue = (name, v) => setValues((p) => ({ ...p, [name]: v }))

  const submit = () => {
    if (docs.length === 0) { setToast('Please attach the Invoice before submitting.'); return }
    addSalaryRequest(values, docs)
    setToast('done')
    setTimeout(() => navigate('/ia/requests'), 1200)
  }

  return (
    <Box sx={{ maxWidth: 940, mx: 'auto', pb: 9 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/ia/requests')} sx={{ mb: 2 }}>My Requests</Button>
      <Box textAlign="center" mb={3}>
        <Chip label="New Request · BSE Salary" sx={{ bgcolor: 'primary.light', color: 'primary.dark', mb: 1.5, fontWeight: 700 }} />
        <Typography variant="h4">Raise BSE Salary Disbursement</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 640, mx: 'auto' }}>
          Submit the salary claim with the Invoice attached. It goes to the GT field team for verification and approval.
        </Typography>
      </Box>

      <Stack spacing={2}>
        <FormRenderer schema={salaryRequestSchema} accent="primary" values={values} setValue={setValue} />
        <DocUpload docs={docs} setDocs={setDocs} />
      </Stack>

      <Paper elevation={3} sx={{ position: 'sticky', bottom: 16, mt: 3, p: 1.5, borderRadius: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
        <Button color="inherit" onClick={() => navigate('/ia/requests')}>Cancel</Button>
        <Button variant="contained" startIcon={<SendIcon />} onClick={submit}>Submit to GT</Button>
      </Paper>

      <Snackbar open={!!toast} autoHideDuration={2200} onClose={() => setToast('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={toast === 'done' ? 'success' : 'warning'} variant="filled">
          {toast === 'done' ? 'Request submitted to GT for approval.' : toast}
        </Alert>
      </Snackbar>
    </Box>
  )
}
