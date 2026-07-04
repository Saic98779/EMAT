import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Stack, Typography, Button, TextField, Divider, Snackbar, Alert,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EastIcon from '@mui/icons-material/East'

function SectionLabel({ children }) {
  return <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>{children}</Typography>
}

export default function NewProposal() {
  const navigate = useNavigate()
  const [toast, setToast] = useState(false)

  const submit = () => { setToast(true); setTimeout(() => navigate('/gt/ias'), 1200) }

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/gt/ias')} sx={{ mb: 2 }}>Industry Associations</Button>
      <Box textAlign="center" mb={3}>
        <Typography variant="h4">New basic proposal</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>Capture the essentials. On submit this goes to the SIDBI SDE for Level 1 approval.</Typography>
      </Box>

      <Card>
        <CardContent sx={{ p: { xs: 2, md: 4 } }}>
          <SectionLabel>Association</SectionLabel>
          <Grid container spacing={2.5}>
            <Grid size={12}><TextField required label="Name of Industry Association" placeholder="e.g. Coimbatore Textile Manufacturers Assn." fullWidth /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="Sector" placeholder="e.g. Textiles" fullWidth /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField required label="Year of incorporation" placeholder="e.g. 1987" fullWidth /></Grid>
            <Grid size={12}><TextField label="Registered address" placeholder="Street, area, PIN" fullWidth /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField required label="City" placeholder="City" fullWidth /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="State" placeholder="State" fullWidth /></Grid>
            <Grid size={12}><TextField label="Nearest SIDBI branch office" placeholder="e.g. SIDBI Coimbatore" fullWidth /></Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />
          <SectionLabel>Apex office holder</SectionLabel>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 6 }}><TextField required label="Name" placeholder="Full name" fullWidth /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="Designation" placeholder="e.g. President" fullWidth /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="Phone" fullWidth /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="Email" fullWidth /></Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />
          <SectionLabel>Nodal person</SectionLabel>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 6 }}><TextField required label="Name" placeholder="Full name" fullWidth /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="Designation" fullWidth /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="Phone" fullWidth /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="Email" fullWidth /></Grid>
          </Grid>

          <Stack direction="row" justifyContent="flex-end" spacing={1.5} mt={4}>
            <Button variant="text" color="inherit" onClick={() => navigate('/gt/ias')}>Cancel</Button>
            <Button variant="contained" endIcon={<EastIcon />} onClick={submit}>Submit to SDE for L1</Button>
          </Stack>
        </CardContent>
      </Card>

      <Snackbar open={toast} autoHideDuration={2000} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled">Basic proposal submitted to SIDBI SDE for L1 approval.</Alert>
      </Snackbar>
    </Box>
  )
}
