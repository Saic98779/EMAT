import { useState } from 'react'
import {
  Box, Grid, Stack, Button, Chip, Snackbar, Alert, Typography,
} from '@mui/material'
import LoginIcon from '@mui/icons-material/Login'
import LogoutIcon from '@mui/icons-material/Logout'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import { PageHeader, StatBars, SectionCard } from '../../components/shared'
import { bseStats } from '../../data'
import AttendanceCalendar from './AttendanceCalendar'

// BSE workspace — daily attendance.
// The Login / Logout controls are the BSE's check-in / check-out for the
// current shift. Local-only for now — wiring to POST /bse-attendance
// requires the logged-in BSE's `bseRecommendationId`, which the session
// doesn't currently carry. When that link is added, swap the `handleLogin`
// / `handleLogout` bodies to fire the corresponding mutation.
export default function BseAttendance() {
  const [session, setSession] = useState({ inTime: null, outTime: null })
  const [toast, setToast] = useState(null)

  const handleLogin = () => {
    const now = new Date()
    setSession({ inTime: now, outTime: null })
    setToast({ severity: 'success', msg: `Logged in at ${formatTime(now)}.` })
  }
  const handleLogout = () => {
    const now = new Date()
    setSession((prev) => ({ ...prev, outTime: now }))
    setToast({ severity: 'info', msg: `Logged out at ${formatTime(now)}.` })
  }

  const isCheckedIn = session.inTime && !session.outTime
  const isCheckedOut = session.inTime && session.outTime

  return (
    <Box>
      <PageHeader
        title="Attendance"
        subtitle="Field-visit & branch days for the current cycle, tracked daily."
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            {session.inTime && (
              <Chip
                icon={<AccessTimeIcon />}
                size="small"
                color={isCheckedIn ? 'success' : 'default'}
                variant={isCheckedIn ? 'filled' : 'outlined'}
                label={
                  isCheckedIn
                    ? `In since ${formatTime(session.inTime)}`
                    : `${formatTime(session.inTime)} → ${formatTime(session.outTime)}`
                }
                sx={{ fontWeight: 600 }}
              />
            )}
            <Button
              variant="contained"
              color="success"
              startIcon={<LoginIcon />}
              onClick={handleLogin}
              disabled={isCheckedIn}
            >
              Login
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              disabled={!isCheckedIn}
            >
              Logout
            </Button>
          </Stack>
        }
      />

      {isCheckedOut && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Today's shift: <strong>{formatTime(session.inTime)}</strong> to <strong>{formatTime(session.outTime)}</strong>
            {' · '}
            <strong>{formatDuration(session.inTime, session.outTime)}</strong> logged.
          </Typography>
        </Alert>
      )}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 8 }}>
          <SectionCard title="June 2026" subtitle="Tap a day to view the logged activity.">
            <AttendanceCalendar />
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SectionCard title="This month" subtitle="Jun 1 – Jun 22, 2026">
            <StatBars rows={bseStats.attendanceMonth} />
          </SectionCard>
        </Grid>
      </Grid>

      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast && (
          <Alert severity={toast.severity} variant="filled" onClose={() => setToast(null)}>
            {toast.msg}
          </Alert>
        )}
      </Snackbar>
    </Box>
  )
}

function formatTime(d) {
  if (!d) return '—'
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function formatDuration(start, end) {
  if (!start || !end) return '—'
  const ms = end - start
  const mins = Math.floor(ms / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}
