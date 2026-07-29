import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Box, Typography, Button, Snackbar, Alert, Chip } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AppraisalForm from '../../components/AppraisalForm'
import { useIA } from '../../queries'
import { useAuth } from '../../auth'

// GT-facing "Detailed Appraisal" page. The actual form + save logic lives in
// AppraisalForm so the same component can be embedded on ProposalDetail for
// SDE too. This page only owns the page chrome (title, back button, toast).
export default function Appraisal({ backPath = '/gt/ias' } = {}) {
  const navigate = useNavigate()
  const { id } = useParams()
  const { rawRole } = useAuth()
  const isClusterExpert = rawRole === 'CLUSTER_EXPERT'
  const isSde = rawRole === 'SIDBI_SDE'
  const iaQ = useIA(id)
  const [toast, setToast] = useState({ severity: '', msg: '' })

  const chipLabel = isClusterExpert
    ? 'Cluster Expert · Review'
    : isSde
      ? 'SDE · Edit Appraisal'
      : 'Detailed Appraisal'
  const subtitle = isClusterExpert
    ? 'Reviewing the detailed appraisal. All fields are read-only; add your comments below and save.'
    : isSde
      ? `${iaQ.data?.name || ''} — modify any field submitted by GT / Cluster Expert before granting Final (L2) approval.`
      : `${iaQ.data?.name || 'Complete the full 15-point appraisal'} — basic proposal approved by SIDBI SDE. Complete all points and submit for final approval.`

  const handleSaved = (msg, severity) => {
    setToast({ severity, msg })
    if (severity === 'success') setTimeout(() => navigate(`${backPath}/${id}`), 1100)
  }

  return (
    <Box sx={{ maxWidth: 940, mx: 'auto', pb: 9 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(backPath)} sx={{ mb: 2 }}>Back</Button>
      <Box textAlign="center" mb={3}>
        <Chip label={chipLabel} sx={{ bgcolor: 'primary.light', color: 'primary.dark', mb: 1.5, fontWeight: 700 }} />
        <Typography variant="h4">Detailed Appraisal</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 640, mx: 'auto' }}>
          {subtitle}
        </Typography>
      </Box>

      <AppraisalForm registrationUuid={id} onSaved={handleSaved} stickyFooter />

      <Snackbar
        open={!!toast.msg}
        autoHideDuration={3000}
        onClose={() => setToast({ severity: '', msg: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast.severity || 'info'} variant="filled" onClose={() => setToast({ severity: '', msg: '' })}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}
