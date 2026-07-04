import { useState } from 'react'
import {
  Box, Card, CardContent, Stack, Typography, Button, Snackbar, Alert,
} from '@mui/material'
import { PageHeader, StatusChip, Mono } from '../../components/shared'
import { disbursals } from '../../data'
import { monoFont } from '../../theme'

const inr = (n) => '₹' + n.toLocaleString('en-IN')

export default function Disbursals({ role = 'gt' }) {
  const [items, setItems] = useState(disbursals)
  const [toast, setToast] = useState('')

  const subtitle = role === 'sde'
    ? 'Field expense claims cleared at GT (L1) — authorise Level 2 release.'
    : 'Field expense claims — two-level approval: GT (L1) then SIDBI SDE (L2).'

  // Which items this role can currently act on.
  const actionable = (d) =>
    role === 'gt' ? d.status === 'GT Approval (L1)' : d.status === 'SIDBI Approval (L2)'

  const act = (id, verb, status) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)))
    setToast(`${id} ${verb}.`)
  }

  const list = role === 'sde' ? items.filter((d) => d.status === 'SIDBI Approval (L2)' || d.status === 'Disbursed') : items

  return (
    <Box>
      <PageHeader title="Disbursals" subtitle={subtitle} />
      <Stack spacing={2}>
        {list.map((d) => (
          <Card key={d.id}>
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                <Box sx={{ minWidth: 96 }}>
                  <Typography variant="h6" fontWeight={800}>{inr(d.amount)}</Typography>
                  <Mono>{d.id}</Mono>
                </Box>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography fontWeight={700} fontSize="0.95rem">{d.title}</Typography>
                  <Typography variant="body2" color="text.secondary">{d.who} · {d.category} · {d.date}</Typography>
                  <Typography sx={{ fontFamily: monoFont, fontSize: '0.78rem', color: 'text.disabled', mt: 0.25 }}>{d.flow}</Typography>
                  {d.note && <Typography variant="body2" color="text.secondary" fontStyle="italic" mt={0.5}>“{d.note}”</Typography>}
                </Box>
                {actionable(d) ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <StatusChip status={d.status} />
                    <Button variant="outlined" color="error" size="small" onClick={() => act(d.id, 'rejected', role === 'gt' ? 'Rejected (L1)' : 'Rejected (L2)')}>Reject</Button>
                    <Button variant="contained" color="success" size="small"
                      onClick={() => act(d.id, role === 'gt' ? 'approved at L1' : 'disbursed', role === 'gt' ? 'SIDBI Approval (L2)' : 'Disbursed')}>
                      {role === 'gt' ? 'Approve (L1)' : 'Approve'}
                    </Button>
                  </Stack>
                ) : <StatusChip status={d.status} />}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
      <Snackbar open={!!toast} autoHideDuration={2000} onClose={() => setToast('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled">{toast}</Alert>
      </Snackbar>
    </Box>
  )
}
