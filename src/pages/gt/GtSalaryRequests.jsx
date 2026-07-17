import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Stack, Typography, Button, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Snackbar, Alert, Divider,
} from '@mui/material'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import { PageHeader, StatusChip, Mono } from '../../components/shared'
import { useData } from '../../store'

const inr = (n) => '₹' + n.toLocaleString('en-IN')

export default function GtSalaryRequests() {
  const navigate = useNavigate()
  const { salaryRequests, reviewSalaryRequest } = useData()
  const [review, setReview] = useState(null)
  const [attendance, setAttendance] = useState('')
  const [additional, setAdditional] = useState('')
  const [toast, setToast] = useState('')

  const open = (r) => { setReview(r); setAttendance(''); setAdditional('') }
  const decide = (status, verb) => {
    reviewSalaryRequest(review.id, status, { attendance, additional })
    setToast(`${review.id} — ${verb}.`)
    setReview(null)
  }

  return (
    <Box>
      <PageHeader title="BSE Salary Requests" subtitle="Requests raised by Industry Associations — verify attendance and offer your comments." />
      <Stack spacing={2}>
        {salaryRequests.map((r) => (
          <Card key={r.id}>
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                <Box sx={{ minWidth: 110 }}>
                  <Typography variant="h6" fontWeight={800}>{inr(r.amount)}</Typography>
                  <Mono>{r.id}</Mono>
                </Box>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography fontWeight={700} fontSize="0.95rem">BSE Salary — {r.bse} · {r.month}</Typography>
                  <Typography variant="body2" color="text.secondary">{r.agency} · Invoice {r.invoiceNo} · {r.date}</Typography>
                  <Stack direction="row" spacing={0.75} mt={1} flexWrap="wrap">
                    {r.docs.map((d) => <Chip key={d} size="small" variant="outlined" icon={<DescriptionOutlinedIcon />} label={d} />)}
                  </Stack>
                  {r.gtComments?.attendance && (
                    <Typography variant="body2" color="text.secondary" fontStyle="italic" mt={1}>GT: “{r.gtComments.attendance}”</Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <StatusChip status={r.status} />
                  {r.status === 'Submitted to GT'
                    ? <Button variant="contained" size="small" onClick={() => open(r)}>Review</Button>
                    : r.status === 'Approved by GT'
                      ? <Button variant="outlined" size="small" startIcon={<PaymentsOutlinedIcon />} onClick={() => navigate('/gt/team/salary')}>Disburse</Button>
                      : null}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Dialog open={!!review} onClose={() => setReview(null)} maxWidth="sm" fullWidth>
        {review && (
          <>
            <DialogTitle component="div" sx={{ pb: 0.5 }}>
              <Typography variant="overline" color="text.secondary" display="block">Review salary request · {review.id}</Typography>
              <Typography variant="h6">BSE Salary — {review.bse} · {review.month}</Typography>
              <Typography variant="body2" color="text.secondary">{review.agency} · Invoice {review.invoiceNo} · {inr(review.amount)}</Typography>
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2} mt={1}>
                <TextField label="GT Comments on BSE attendance" value={attendance} onChange={(e) => setAttendance(e.target.value)}
                  fullWidth multiline minRows={2} size="small" placeholder="Attendance verified against field logs…" />
                <TextField label="GT Comments on additional payment, if any" value={additional} onChange={(e) => setAdditional(e.target.value)}
                  fullWidth multiline minRows={2} size="small" />
              </Stack>
            </DialogContent>
            <Divider />
            <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
              <Button variant="outlined" color="error" onClick={() => decide('Rejected by GT', 'rejected')}>Reject</Button>
              <Button variant="outlined" color="secondary" onClick={() => decide('Changes requested by GT', 'changes requested')}>Request changes</Button>
              <Button variant="contained" color="success" onClick={() => decide('Approved by GT', 'approved')}>Approve</Button>
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
