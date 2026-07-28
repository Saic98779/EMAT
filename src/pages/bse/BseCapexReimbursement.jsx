import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button, Snackbar, Alert, Chip, Paper } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SendIcon from '@mui/icons-material/Send'
import FormRenderer, { defaultsFor, fieldError } from '../../components/FormRenderer'
import { capexReimbursementSchema } from '../../formSchemas'
import { bseProfile } from '../../data'
import { useData } from '../../store'

function firstProblem(schema, values) {
  for (const sec of schema.sections) {
    for (const f of sec.fields) {
      if (f.showIf && !f.showIf(values)) continue
      if (f.readOnly) continue
      const v = values[f.name]
      const filled = Array.isArray(v) ? v.length > 0 : v != null && v !== ''
      if (f.required && !filled) return `${sec.title}: “${f.label}” is required`
      const err = fieldError(f, v, values)
      if (err) return `${sec.title}: ${f.label} — ${err}`
    }
  }
  return null
}

export default function BseCapexReimbursement() {
  const navigate = useNavigate()
  const { addBseCapexRequest } = useData()
  const [values, setValues] = useState(() => ({
    ...defaultsFor(capexReimbursementSchema),
    ia_name: bseProfile.ia_name,
    ia_gstin: bseProfile.ia_gstin,
    ia_gstin_na_reason: bseProfile.ia_gstin_na_reason,
    sidbi_gstin: bseProfile.sidbi_gstin,
    sanctioned_amount: bseProfile.sanctioned_amount,
    disbursed_till_date: bseProfile.disbursed_till_date,
    account_code: bseProfile.account_code,
    tds: bseProfile.tds_applicable,
    tds_na_reason: bseProfile.tds_na_reason,
    nature_payment: bseProfile.nature_payment,
  }))
  const [toast, setToast] = useState('')
  const setValue = useCallback((name, v) => setValues((p) => ({ ...p, [name]: v })), [])

  const submit = () => {
    const problem = firstProblem(capexReimbursementSchema, values)
    if (problem) { setToast(problem); return }
    addBseCapexRequest(values)
    setToast('done')
    setTimeout(() => navigate('/bse/disbursals'), 1200)
  }

  return (
    <Box sx={{ maxWidth: 940, mx: 'auto', pb: 9 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/bse')} sx={{ mb: 2 }}>Dashboard</Button>
      <Box textAlign="center" mb={3}>
        <Chip label="BSE · CAPEX Reimbursement Note" sx={{ bgcolor: 'primary.light', color: 'primary.dark', mb: 1.5, fontWeight: 700 }} />
        <Typography variant="h4">Reimbursement of CAPEX to IA</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 640, mx: 'auto' }}>
          Raise the CAPEX reimbursement note for your assigned Industry Association. It routes to the GT field team (L1) and SIDBI SDE (L2) for approval.
        </Typography>
      </Box>

      <FormRenderer schema={capexReimbursementSchema} accent="primary" values={values} setValue={setValue} />

      <Paper elevation={3} sx={{ position: 'sticky', bottom: 16, mt: 3, p: 1.5, borderRadius: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
        <Button color="inherit" onClick={() => navigate('/bse')}>Cancel</Button>
        <Button variant="contained" startIcon={<SendIcon />} onClick={submit}>Submit for Approval</Button>
      </Paper>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={toast === 'done' ? 'success' : 'warning'} variant="filled">
          {toast === 'done' ? 'CAPEX reimbursement note submitted for approval.' : toast}
        </Alert>
      </Snackbar>
    </Box>
  )
}
