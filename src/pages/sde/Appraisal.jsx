import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Box, Stack, Typography, Button, Snackbar, Alert, Chip } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import ReplayIcon from '@mui/icons-material/Replay'
import FormRenderer from '../../components/FormRenderer'
import { appraisalSchema } from '../../formSchemas'
import { industryAssociations } from '../../data'

export default function Appraisal() {
  const navigate = useNavigate()
  const { id } = useParams()
  const ia = industryAssociations.find((x) => x.id === id)
  const [toast, setToast] = useState('')
  const decide = (verb) => { setToast(`${ia ? ia.name : 'Proposal'} — ${verb}.`); setTimeout(() => navigate('/sde/queue'), 1300) }

  return (
    <Box sx={{ maxWidth: 940, mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/sde/queue')} sx={{ mb: 2 }}>Approval Queue</Button>
      <Box textAlign="center" mb={3}>
        <Chip label="Level 2 · Appraisal" color="secondary" sx={{ bgcolor: 'secondary.light', color: 'secondary.dark', mb: 1.5, fontWeight: 700 }} />
        <Typography variant="h4">Appraisal</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 640, mx: 'auto' }}>
          {ia ? `${ia.name} · ${ia.id}` : 'Full due-diligence appraisal'} — complete all 15 points before recording a decision.
        </Typography>
      </Box>

      <FormRenderer schema={appraisalSchema} accent="secondary" />

      <Stack direction="row" justifyContent="center" flexWrap="wrap" gap={1.5} mt={4}>
        <Button variant="text" color="inherit" onClick={() => navigate('/sde/queue')}>Cancel</Button>
        <Button variant="outlined" color="error" startIcon={<CloseIcon />} onClick={() => decide('rejected')}>Reject</Button>
        <Button variant="outlined" color="secondary" startIcon={<ReplayIcon />} onClick={() => decide('changes requested')}>Request changes</Button>
        <Button variant="contained" color="success" size="large" startIcon={<CheckIcon />} onClick={() => decide('sanctioned (L2)')}>Sanction</Button>
      </Stack>

      <Snackbar open={!!toast} autoHideDuration={2200} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled">{toast}</Alert>
      </Snackbar>
    </Box>
  )
}
