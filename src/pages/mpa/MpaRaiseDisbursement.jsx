import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button, Snackbar, Alert, Chip, Paper } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SendIcon from '@mui/icons-material/Send'
import FormRenderer, { defaultsFor, fieldError } from '../../components/FormRenderer'
import { makeMpaDisbursementSchema } from '../../formSchemas'
import { manpowerProfile } from '../../data'
import { useData } from '../../store'

// Walk the schema in order and surface the first blocking issue.
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

export default function MpaRaiseDisbursement() {
  const navigate = useNavigate()
  const { addMpaRequest } = useData()
  const schema = useMemo(() => makeMpaDisbursementSchema(manpowerProfile.bse_roster), [])
  const [values, setValues] = useState(() => ({
    ...defaultsFor(schema),
    // Autofilled from login / agency profile.
    manpower_name: manpowerProfile.agency_name,
    agency_gstin: manpowerProfile.agency_gstin,
    gstin_na_reason: manpowerProfile.gstin_na_reason,
    sidbi_gstin: manpowerProfile.sidbi_gstin,
    sanctioned_amount: manpowerProfile.sanctioned_amount,
    disbursed_till_date: manpowerProfile.disbursed_till_date,
    account_code: manpowerProfile.account_code,
    nature_payment: manpowerProfile.nature_payment,
    tds: manpowerProfile.tds_applicable,
    tds_na_reason: manpowerProfile.tds_na_reason,
  }))
  const [toast, setToast] = useState('')
  const setValue = useCallback((name, v) => setValues((p) => ({ ...p, [name]: v })), [])

  // Auto-populate Annexure I salary + attendance when the BSE is picked.
  useEffect(() => {
    const master = manpowerProfile.bse_master[values.annex_bse_name]
    if (!master) return
    setValues((p) => ({
      ...p,
      annex_ia_name: p.annex_ia_name || master.ia,
      monthly_salary: master.monthly_salary,
      salary_days: master.days_this_cycle,
    }))
  }, [values.annex_bse_name])

  const submit = () => {
    const problem = firstProblem(schema, values)
    if (problem) { setToast(problem); return }
    addMpaRequest(values)
    setToast('done')
    setTimeout(() => navigate('/mpa'), 1200)
  }

  return (
    <Box sx={{ maxWidth: 940, mx: 'auto', pb: 9 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/mpa')} sx={{ mb: 2 }}>Dashboard</Button>
      <Box textAlign="center" mb={3}>
        <Chip label="Manpower Agency · New Disbursement" sx={{ bgcolor: 'primary.light', color: 'primary.dark', mb: 1.5, fontWeight: 700 }} />
        <Typography variant="h4">Raise Salary Disbursement</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 640, mx: 'auto' }}>
          Select the BSEs paid this cycle, attach the invoice details, and submit to the SIDBI HO Maker for review.
        </Typography>
      </Box>

      <FormRenderer schema={schema} accent="primary" values={values} setValue={setValue} />

      <Paper elevation={3} sx={{ position: 'sticky', bottom: 16, mt: 3, p: 1.5, borderRadius: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
        <Button color="inherit" onClick={() => navigate('/mpa')}>Cancel</Button>
        <Button variant="contained" startIcon={<SendIcon />} onClick={submit}>Submit to HO Maker</Button>
      </Paper>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={toast === 'done' ? 'success' : 'warning'} variant="filled">
          {toast === 'done' ? 'Disbursement request submitted to HO Maker.' : toast}
        </Alert>
      </Snackbar>
    </Box>
  )
}
