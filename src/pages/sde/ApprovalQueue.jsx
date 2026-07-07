import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Stack, Typography, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Snackbar, Alert,
} from '@mui/material'
import { PageHeader, StatusChip, Mono, statusColor } from '../../components/shared'
import { approvalQueue } from '../../data'

const accentFor = (badge) => `${statusColor(badge)}.main`

export default function ApprovalQueue() {
  const navigate = useNavigate()
  const [items] = useState(approvalQueue)
  const [review, setReview] = useState(null) // item under review
  const [remark, setRemark] = useState('')
  const [toast, setToast] = useState('')

  const decide = (verb) => { setToast(`${review.name} — ${verb}.`); setReview(null); setRemark('') }
  const isDisbursal = review?.kind.startsWith('DISBURSAL')

  return (
    <Box>
      <PageHeader title="Approval queue" subtitle="Everything awaiting your appraisal — basic (L1), detailed (final L2), and field disbursals." />
      <Stack spacing={2}>
        {items.map((q) => (
          <Card key={q.name} sx={{ position: 'relative', overflow: 'hidden' }}>
            <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, bgcolor: accentFor(q.badge) }} />
            <CardContent sx={{ pl: 3 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="overline" color="text.secondary">{q.kind}</Typography>
                  <Typography fontWeight={700}>{q.name}</Typography>
                  <Mono>{q.meta}</Mono>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <StatusChip status={q.badge} />
                  {q.iaId && <Button variant="outlined" size="small" onClick={() => navigate(`/sde/ias/${q.iaId}`)}>Open</Button>}
                  {q.action === 'Final review'
                    ? <Button variant="contained" size="small" onClick={() => navigate(`/sde/ias/${q.iaId}/appraisal`)}>{q.action}</Button>
                    : <Button variant="contained" size="small" onClick={() => setReview(q)}>{q.action}</Button>}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Dialog open={!!review} onClose={() => setReview(null)} maxWidth="sm" fullWidth>
        {review && (
          <>
            <DialogTitle sx={{ pb: 0.5 }}>
              <Typography variant="overline" color="text.secondary" display="block">
                {isDisbursal ? 'Level 2 — Disbursal' : review.kind.includes('FINAL') ? 'Level 2 — Detailed proposal' : 'Level 1 — Basic proposal'}
              </Typography>
              <Typography variant="h6">{isDisbursal ? review.name : `Review ${review.kind.includes('FINAL') ? 'detailed proposal' : 'basic proposal'} · ${review.iaId}`}</Typography>
              {!isDisbursal && <Typography variant="body2" color="text.secondary">{review.name}</Typography>}
            </DialogTitle>
            <DialogContent>
              <TextField
                label="Comment / remarks" placeholder="Add remarks for the GT field team…"
                value={remark} onChange={(e) => setRemark(e.target.value)}
                fullWidth multiline minRows={3} sx={{ mt: 2 }}
              />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
              <Button variant="outlined" color="error" onClick={() => decide('rejected')}>Reject</Button>
              {!isDisbursal && <Button variant="outlined" color="secondary" onClick={() => decide('changes requested')}>Request changes</Button>}
              <Button variant="contained" color="success" onClick={() => decide(isDisbursal ? 'disbursed' : review.kind.includes('FINAL') ? 'sanctioned (L2)' : 'approved (L1)')}>
                {isDisbursal ? 'Approve & release' : review.kind.includes('FINAL') ? 'Sanction (L2)' : 'Approve (L1)'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={2200} onClose={() => setToast('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled">{toast}</Alert>
      </Snackbar>
    </Box>
  )
}
