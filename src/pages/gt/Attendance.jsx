import { useState } from 'react'
import {
  Box, Card, CardContent, Stack, Typography, Button, Avatar, Snackbar, Alert,
} from '@mui/material'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import { PageHeader, StatusChip, Mono } from '../../components/shared'
import { useData } from '../../store'

export default function Attendance() {
  const { attendance: items, setAttendanceStatus } = useData()
  const [toast, setToast] = useState('')

  const act = (id, verb, status) => {
    setAttendanceStatus(id, status)
    setToast(`${id} ${verb}.`)
  }

  return (
    <Box>
      <PageHeader title="Attendance requests" subtitle="Off-site / field-visit attendance — approved by the GT field team." />
      <Stack spacing={2}>
        {items.map((a) => (
          <Card key={a.id}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar variant="rounded" sx={{ bgcolor: 'action.hover', color: 'primary.main' }}>
                  <CalendarMonthOutlinedIcon fontSize="small" />
                </Avatar>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="baseline">
                    <Mono sx={{ color: 'secondary.main' }}>{a.id}</Mono>
                    <Typography fontWeight={700}>{a.type}</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">{a.who} · {a.date} · {a.place}</Typography>
                  <Typography variant="body2" color="text.disabled">{a.note}</Typography>
                </Box>
                {a.status === 'Pending' ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <StatusChip status="Pending" />
                    <Button variant="outlined" color="error" size="small" onClick={() => act(a.id, 'rejected', 'Rejected')}>Reject</Button>
                    <Button variant="contained" color="success" size="small" onClick={() => act(a.id, 'approved', 'Approved')}>Approve</Button>
                  </Stack>
                ) : <StatusChip status={a.status} />}
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
