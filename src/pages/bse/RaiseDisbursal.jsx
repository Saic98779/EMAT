import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Stack, Button, TextField, MenuItem, Snackbar, Alert, Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EastIcon from '@mui/icons-material/East'
import { disbursalCategories } from '../../data'

export default function RaiseDisbursal() {
  const navigate = useNavigate()
  const [category, setCategory] = useState(disbursalCategories[0])
  const [toast, setToast] = useState(false)

  const submit = () => { setToast(true); setTimeout(() => navigate('/bse/disbursals'), 1200) }

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/bse/disbursals')} sx={{ mb: 2 }}>Disbursals</Button>
      <Box textAlign="center" mb={3}>
        <Typography variant="h4">Raise disbursal request</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>Claim field expenses. Approved by GT (L1) then SIDBI SDE (L2) before release.</Typography>
      </Box>

      <Card>
        <CardContent sx={{ p: { xs: 2, md: 4 } }}>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} fullWidth>
                {disbursalCategories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField required label="Amount (₹)" placeholder="e.g. 8,450" fullWidth /></Grid>
            <Grid size={12}><TextField label="Date" defaultValue="22 Jun 2026" fullWidth /></Grid>
            <Grid size={12}><TextField required label="Purpose" placeholder="Describe the expense and the field activity it relates to…" fullWidth multiline minRows={4} /></Grid>
          </Grid>
          <Stack direction="row" justifyContent="flex-end" spacing={1.5} mt={4}>
            <Button variant="text" color="inherit" onClick={() => navigate('/bse/disbursals')}>Cancel</Button>
            <Button variant="contained" endIcon={<EastIcon />} onClick={submit}>Submit for approval</Button>
          </Stack>
        </CardContent>
      </Card>

      <Snackbar open={toast} autoHideDuration={2000} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled">Disbursal request submitted for GT (L1) approval.</Alert>
      </Snackbar>
    </Box>
  )
}
