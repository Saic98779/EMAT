import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Stack, Typography, Button, Chip,
  CircularProgress, Snackbar, Alert, TextField,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import HighlightOffIcon from '@mui/icons-material/HighlightOff'
import { SectionCard, StatusChip } from '../../components/shared'
import { useIA, useUpdateAppraisal } from '../../queries'
import {
  unpackClusterExpertComments,
  unpackHoDecision,
  toFormValues,
  toUpdatePayload,
  packHoDecision,
} from '../../apis/industryAssociationAppraisals'

// SIDBI HO Maker's entire remit: read a Cluster-Expert-commented appraisal
// and record an approve/reject decision with mandatory remarks. No dedicated
// backend field exists for this, so the decision is packed into
// recommendationRemarks behind a marker (see unpackHoDecision) — same
// technique the Cluster Expert's own comments already use.
export default function HoIaReview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const iaQ = useIA(id)
  const updateM = useUpdateAppraisal()
  const [toast, setToast] = useState({ severity: '', msg: '' })
  const [decision, setDecision] = useState(null)
  const [remarks, setRemarks] = useState('')
  const [seeded, setSeeded] = useState(false)

  const ia = iaQ.data
  const appraisal = ia?.appraisal
  const commented = !!String(appraisal?.clusterExpertComments || '').trim()

  useEffect(() => {
    if (seeded || !appraisal) return
    const ho = unpackHoDecision(appraisal)
    setDecision(ho.decision)
    setRemarks(ho.remarks)
    setSeeded(true)
  }, [seeded, appraisal])

  if (iaQ.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
  }
  if (iaQ.error) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/sde/ia-approvals')} sx={{ mb: 2 }}>IA Approvals</Button>
        <Alert severity="error">{iaQ.error.message || 'Failed to load application'}</Alert>
      </Box>
    )
  }
  if (!ia) return null

  if (!appraisal || !commented) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/sde/ia-approvals')} sx={{ mb: 2 }}>IA Approvals</Button>
        <Alert severity="warning">
          This application isn't open for your review yet — the Cluster Expert hasn't commented on
          its appraisal.
        </Alert>
      </Box>
    )
  }

  const ceComments = unpackClusterExpertComments(appraisal)
  const remarksEmpty = !String(remarks || '').trim()
  const blockSave = !decision || remarksEmpty
  const approved = decision === 'Approved'
  const rejected = decision === 'Rejected'

  const submit = async () => {
    try {
      const ho = unpackHoDecision(appraisal)
      const formValues = toFormValues(appraisal)
      formValues.recommendation_remarks = packHoDecision(ho.baseRemarks, decision, remarks)
      await updateM.mutateAsync({
        uuid: appraisal.uuid,
        body: toUpdatePayload(formValues, id),
      })
      setToast({ severity: 'success', msg: `Decision recorded: ${decision}.` })
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Failed to save decision.' })
    }
  }

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/sde/ia-approvals')} sx={{ mb: 2 }}>IA Approvals</Button>

      <Card sx={{ mb: 2.5 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap" mb={2}>
            <Typography variant="h5">{ia.name}</Typography>
            <StatusChip status={ia.status} />
            <Box sx={{ flexGrow: 1 }} />
            <Typography variant="body2" color="text.secondary">Submitted {ia.submitted}</Typography>
          </Stack>
          <Grid container spacing={2}>
            <Field label="City / District" value={ia.city} />
            <Field label="State" value={ia.state} />
            <Field label="Apex holder" value={ia.apex?.name} />
            <Field label="Nodal contact" value={ia.nodal?.name} />
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard title="Cluster Expert comments" subtitle="Read-only context for your decision.">
            <Field label="Comments" value={ceComments.general} span={12} />
            {ceComments.terms && <Field label="Terms of Assistance" value={ceComments.terms} span={12} />}
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Box sx={{
            p: 2.5, borderRadius: 2, border: '2px solid',
            borderColor: approved ? 'success.main' : rejected ? 'error.main' : 'divider',
            bgcolor: approved ? 'success.50' : rejected ? 'error.50' : 'action.hover',
            transition: 'border-color 0.15s, background-color 0.15s',
          }}>
            <Typography variant="subtitle1" fontWeight={700} mb={0.5}>Your Decision</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Approve or reject this application. Remarks are mandatory either way.
            </Typography>

            <Stack direction="row" spacing={1.5} mb={2}>
              <Button
                fullWidth size="large" variant={approved ? 'contained' : 'outlined'} color="success"
                startIcon={<CheckCircleOutlineIcon />} onClick={() => setDecision('Approved')}
                sx={{ fontWeight: 700 }}
              >
                Approve
              </Button>
              <Button
                fullWidth size="large" variant={rejected ? 'contained' : 'outlined'} color="error"
                startIcon={<HighlightOffIcon />} onClick={() => setDecision('Rejected')}
                sx={{ fontWeight: 700 }}
              >
                Reject
              </Button>
            </Stack>

            <TextField
              fullWidth multiline minRows={3} label="Remarks"
              placeholder="Reason for your decision (required)"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              error={remarksEmpty}
              helperText={remarksEmpty ? 'Required' : ' '}
              sx={{ mb: 1.5, bgcolor: 'background.paper', borderRadius: 1 }}
            />

            <Stack direction="row" justifyContent="flex-end">
              <Button
                size="large" variant="contained" color={rejected ? 'error' : 'success'}
                startIcon={updateM.isPending ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                disabled={updateM.isPending || blockSave}
                onClick={submit}
                sx={{ px: 3, fontWeight: 700 }}
              >
                {updateM.isPending
                  ? 'Saving…'
                  : approved ? 'Submit Approval' : rejected ? 'Submit Rejection' : 'Submit Decision'}
              </Button>
            </Stack>
          </Box>
        </Grid>
      </Grid>

      <Snackbar
        open={!!toast.msg}
        autoHideDuration={3200}
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

function Field({ label, value, span = 6 }) {
  return (
    <Grid size={{ xs: 12, sm: span }}>
      <Typography variant="overline" color="text.secondary" display="block">{label}</Typography>
      <Typography fontWeight={500} sx={{ whiteSpace: 'pre-wrap' }}>{value || '—'}</Typography>
    </Grid>
  )
}
