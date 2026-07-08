import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Stack, Button, TextField, MenuItem, Snackbar, Alert, Typography, InputAdornment,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EastIcon from '@mui/icons-material/East'
import { disbursalCategories } from '../../data'
import { useData } from '../../store'

export default function RaiseDisbursal() {
  const navigate = useNavigate()
  const { addDisbursal } = useData()
  const [form, setForm] = useState({ category: disbursalCategories[0], amount: '', date: '22 Jun 2026', purpose: '' })
  const [toast, setToast] = useState(false)
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  const submit = () => { addDisbursal(form); setToast(true); setTimeout(() => navigate('/bse/disbursals'), 1100) }

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/bse/disbursals')} sx={{ mb: 2 }}>Disbursals</Button>
      <Box textAlign="center" mb={3}>
        <Typography variant="h4">Raise disbursal request</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>Claim field expenses. Approved by GT (L1) then SIDBI SDE (L2) before release.</Typography>
      </Box>

      <Card>
        <CardContent sx={{ p: { xs: 2, md: 3.5 } }}>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField size="small" select label="Category" value={form.category} onChange={set('category')} fullWidth>
                {disbursalCategories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField size="small" required type="number" label="Amount" placeholder="8450" value={form.amount} onChange={set('amount')}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} fullWidth />
            </Grid>
            <Grid size={12}><TextField size="small" label="Date" value={form.date} onChange={set('date')} fullWidth /></Grid>
            <Grid size={12}><TextField size="small" required label="Purpose" placeholder="Describe the expense and the field activity it relates to…" value={form.purpose} onChange={set('purpose')} fullWidth multiline minRows={3} /></Grid>
          </Grid>
          <Stack direction="row" justifyContent="flex-end" spacing={1.5} mt={4}>
            <Button variant="text" color="inherit" onClick={() => navigate('/bse/disbursals')}>Cancel</Button>
            <Button variant="contained" endIcon={<EastIcon />} onClick={submit}>Submit for approval</Button>
          </Stack>
        </CardContent>
      </Card>

      <Snackbar open={toast} autoHideDuration={2000} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled">Disbursal request raised — awaiting GT (L1) approval.</Alert>
      </Snackbar>
    </Box>
  )
}
