import { memo, useCallback, useMemo, useState } from 'react'
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, Grid, MenuItem, Snackbar,
  Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import LoginIcon from '@mui/icons-material/Login'
import LogoutIcon from '@mui/icons-material/Logout'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import EditCalendarOutlinedIcon from '@mui/icons-material/EditCalendarOutlined'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import CancelIcon from '@mui/icons-material/Cancel'
import { alpha } from '@mui/material/styles'
import { PageHeader } from '../../components/shared'
import { useAuth } from '../../auth'
import {
  useBseByUserSelected,
  useBseAttendanceByRecommendation,
  useCreateBseAttendance,
  useUpdateBseAttendance,
  useBseAttendanceManualRequestsByRecommendation,
  useCreateBseAttendanceManualRequest,
} from '../../queries'
import {
  workingDaysInMonth, attendanceIndexByDay,
} from '../../apis/bseAttendance'

// BSE workspace — daily attendance.
//
// Two backend surfaces feed this page:
//   • bse-attendance                  — the live, real-time record.
//                                       "In Time" button stamps the current
//                                       time; "Out Time" updates the same
//                                       row for today with the checkout.
//   • bse-attendance-manual-request   — for missed / backdated days. BSE
//                                       submits date + times + reason; goes
//                                       through approval before it counts.
//
// The header buttons drive bse-attendance directly. A secondary "Request a
// missed day" action opens a small dialog that files a manual request.

const MONTHS = [
  { n: 1, label: 'January' }, { n: 2, label: 'February' }, { n: 3, label: 'March' },
  { n: 4, label: 'April' }, { n: 5, label: 'May' }, { n: 6, label: 'June' },
  { n: 7, label: 'July' }, { n: 8, label: 'August' }, { n: 9, label: 'September' },
  { n: 10, label: 'October' }, { n: 11, label: 'November' }, { n: 12, label: 'December' },
]
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function BseAttendance() {
  const { user } = useAuth()

  // Resolve the BSE's own recommendation uuid from the shared selected-BSE
  // hook. For a BSE-role user, this returns the record backend-linked to
  // their userId — take the first one.
  const meQ = useBseByUserSelected(user?.userId)
  const me = (meQ.data || [])[0] || null
  const recommendationId = me?.uuid || null

  const attendanceQ = useBseAttendanceByRecommendation(recommendationId)
  const manualQ = useBseAttendanceManualRequestsByRecommendation(recommendationId)
  const createAttendance = useCreateBseAttendance()
  const updateAttendance = useUpdateBseAttendance()

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [manualOpen, setManualOpen] = useState(false)
  const [toast, setToast] = useState({ severity: '', msg: '' })

  const rows = useMemo(() => attendanceQ.data || [], [attendanceQ.data])
  const manualRows = useMemo(() => manualQ.data || [], [manualQ.data])

  // Today's attendance row (if any) — powers the In / Out button state.
  const today = todayIso()
  const todaysRow = useMemo(
    () => rows.find((r) => r?.attendanceDate === today) || null,
    [rows, today],
  )
  const isCheckedIn = !!todaysRow?.inTime && !todaysRow?.outTime
  const isCheckedOut = !!todaysRow?.inTime && !!todaysRow?.outTime

  const markInTime = useCallback(async () => {
    if (!recommendationId) return
    try {
      await createAttendance.mutateAsync({
        bseRecommendationId: recommendationId,
        attendanceDate: today,
        inTime: currentHHMM(),
        outTime: null,
      })
      setToast({ severity: 'success', msg: `In Time marked for today.` })
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Failed to mark In Time.' })
    }
  }, [createAttendance, recommendationId, today])

  const markOutTime = useCallback(async () => {
    if (!recommendationId || !todaysRow?.uuid) return
    try {
      await updateAttendance.mutateAsync({
        id: todaysRow.uuid,
        values: {
          bseRecommendationId: recommendationId,
          attendanceDate: today,
          inTime: todaysRow.inTime,
          outTime: currentHHMM(),
        },
      })
      setToast({ severity: 'success', msg: `Out Time marked for today.` })
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Failed to mark Out Time.' })
    }
  }, [updateAttendance, recommendationId, todaysRow, today])

  const monthRows = useMemo(
    () => attendanceIndexByDay(rows, month, year),
    [rows, month, year],
  )
  const daysMarked = workingDaysInMonth(rows, month, year)
  const totalDays = daysInMonth(month, year)

  if (meQ.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
  }
  if (!recommendationId) {
    return (
      <Box>
        <PageHeader title="Attendance" />
        <Alert severity="warning">
          Your login isn&apos;t linked to a BSE record yet. Ask SIDBI HO to onboard
          you before you can mark attendance.
        </Alert>
      </Box>
    )
  }

  return (
    <Box>
      <PageHeader
        title="Attendance"
        subtitle={`Field-visit & branch days for ${me?.bseName || 'you'} — mark In / Out each day.`}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            {todaysRow && (
              <Chip
                icon={<AccessTimeIcon />} size="small"
                color={isCheckedIn ? 'success' : 'default'}
                variant={isCheckedIn ? 'filled' : 'outlined'}
                label={isCheckedIn
                  ? `In since ${short(todaysRow.inTime)}`
                  : `${short(todaysRow.inTime)} → ${short(todaysRow.outTime)}`}
                sx={{ fontWeight: 600 }}
              />
            )}
            <Button
              variant="contained" color="success" startIcon={<LoginIcon />}
              onClick={markInTime}
              disabled={createAttendance.isPending || !!todaysRow}
            >
              In Time
            </Button>
            <Button
              variant="outlined" color="error" startIcon={<LogoutIcon />}
              onClick={markOutTime}
              disabled={updateAttendance.isPending || !isCheckedIn}
            >
              Out Time
            </Button>
          </Stack>
        }
      />

      {isCheckedOut && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Today: <strong>{short(todaysRow.inTime)}</strong> to <strong>{short(todaysRow.outTime)}</strong>
          {' · '}<strong>{formatDurationHM(todaysRow.inTime, todaysRow.outTime)}</strong> logged.
        </Alert>
      )}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}
                alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700}>
                  {MONTHS.find((m) => m.n === month)?.label} {year}
                </Typography>
                <Chip size="small" variant="outlined"
                  label={`${daysMarked} / ${totalDays} days marked`}
                  color={daysMarked > 0 ? 'success' : 'default'} />
                <Box sx={{ flexGrow: 1 }} />
                <TextField select size="small" label="Month" value={month}
                  onChange={(e) => setMonth(Number(e.target.value))} sx={{ minWidth: 140 }}>
                  {MONTHS.map((m) => <MenuItem key={m.n} value={m.n}>{m.label}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Year" value={year}
                  onChange={(e) => setYear(Number(e.target.value))} sx={{ minWidth: 100 }}>
                  {YEARS.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </TextField>
              </Stack>

              {attendanceQ.isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
              ) : (
                <CalendarGrid month={month} year={year} byDay={monthRows} today={today} />
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>
                  Missed a day?
                </Typography>
                <Button size="small" variant="outlined"
                  startIcon={<EditCalendarOutlinedIcon />}
                  onClick={() => setManualOpen(true)}
                  sx={{ textTransform: 'none' }}>
                  Request
                </Button>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                File a manual attendance request for a past day. Your supervisor
                reviews and approves it before it counts.
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                My Manual Requests
              </Typography>
              <ManualRequestsList rows={manualRows} loading={manualQ.isLoading} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <ManualRequestDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        recommendationId={recommendationId}
        onToast={setToast}
      />

      <Snackbar open={!!toast.msg} autoHideDuration={3000}
        onClose={() => setToast({ severity: '', msg: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={toast.severity || 'info'} variant="filled"
          onClose={() => setToast({ severity: '', msg: '' })}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}

// ── Calendar ───────────────────────────────────────────────────────────────
const CalendarGrid = memo(function CalendarGrid({ month, year, byDay, today }) {
  const cells = useMemo(() => buildCells(month, year), [month, year])

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, mb: 1 }}>
        {WEEKDAYS.map((w, i) => (
          <Typography key={w} variant="caption"
            sx={{
              textAlign: 'center',
              color: (i === 0 || i === 6) ? 'error.main' : 'text.secondary',
              fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}
          >
            {w}
          </Typography>
        ))}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {cells.map((c) => {
          if (c.empty) return <Box key={c.key} />
          const dd = String(c.day).padStart(2, '0')
          const row = byDay[dd]
          return (
            <DayCard key={c.key} day={c.day} date={c.date} weekday={c.weekday}
              row={row} isToday={c.date === today} />
          )
        })}
      </Box>
      <Stack direction="row" spacing={2} sx={{ mt: 2, flexWrap: 'wrap' }}>
        <Legend color="success.main" label="Marked" />
        <Legend color="divider" outline label="Not marked" />
        <Legend color="primary.main" outline label="Today" />
      </Stack>
    </Box>
  )
})

const DayCard = memo(function DayCard({ day, date, weekday, row, isToday }) {
  const isPresent = !!row
  const isWeekend = weekday === 0 || weekday === 6
  return (
    <Box sx={{
      minHeight: 70, p: 0.75, borderRadius: 1.5,
      border: '1.5px solid',
      borderColor: isPresent ? 'success.main' : isToday ? 'primary.main' : 'divider',
      bgcolor: (t) => isPresent
        ? alpha(t.palette.success.main, 0.08)
        : isWeekend ? alpha(t.palette.text.primary, 0.03) : 'background.paper',
      display: 'flex', flexDirection: 'column', gap: 0.25,
    }}>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography fontWeight={700} fontSize="0.9rem"
          sx={{ color: isPresent ? 'success.dark' : isToday ? 'primary.dark' : isWeekend ? 'text.disabled' : 'text.primary' }}>
          {day}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        {isPresent && <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />}
      </Stack>
      {isPresent && (
        <Typography variant="caption"
          sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '0.65rem', color: 'success.dark' }}>
          {short(row.inTime)}–{short(row.outTime)}
        </Typography>
      )}
    </Box>
  )
})

function Legend({ color, outline, label }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Box sx={{
        width: 12, height: 12, borderRadius: 0.75,
        bgcolor: outline ? 'transparent' : color,
        border: outline ? `1.5px solid` : 'none',
        borderColor: outline ? color : undefined,
      }} />
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Stack>
  )
}

// ── Manual requests: list + dialog ─────────────────────────────────────────
const ManualRequestsList = memo(function ManualRequestsList({ rows, loading }) {
  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={20} /></Box>
  }
  if (!rows.length) {
    return <Typography variant="body2" color="text.secondary">No manual requests yet.</Typography>
  }
  const sorted = [...rows].sort((a, b) => (b.attendanceDate || '').localeCompare(a.attendanceDate || ''))
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Date</TableCell>
          <TableCell>In / Out</TableCell>
          <TableCell>Status</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {sorted.slice(0, 8).map((r) => (
          <TableRow key={r.uuid ?? r.id}>
            <TableCell>{r.attendanceDate || '—'}</TableCell>
            <TableCell>{short(r.inTime)}–{short(r.outTime)}</TableCell>
            <TableCell><StatusChip value={r.isApproved} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
})

function StatusChip({ value }) {
  if (value === true) return <Chip size="small" color="success" icon={<CheckCircleIcon />} label="Approved" />
  if (value === false) return <Chip size="small" color="error" icon={<CancelIcon />} label="Rejected" />
  return <Chip size="small" color="warning" variant="outlined" icon={<HourglassEmptyIcon />} label="Pending" />
}

function ManualRequestDialog({ open, onClose, recommendationId, onToast }) {
  const createM = useCreateBseAttendanceManualRequest()
  const [date, setDate] = useState(todayIso())
  const [inTime, setInTime] = useState('09:00')
  const [outTime, setOutTime] = useState('18:00')
  const [reason, setReason] = useState('')

  const submit = async () => {
    if (!reason.trim()) {
      onToast({ severity: 'warning', msg: 'Please give a reason for the manual entry.' })
      return
    }
    if (date > todayIso()) {
      onToast({ severity: 'warning', msg: 'Manual requests can\'t be for a future date.' })
      return
    }
    try {
      await createM.mutateAsync({
        bseRecommendationId: recommendationId,
        attendanceDate: date,
        inTime, outTime,
        reason,
      })
      onToast({ severity: 'success', msg: 'Manual request submitted for approval.' })
      onClose()
      setReason('')
    } catch (err) {
      onToast({ severity: 'error', msg: err.message || 'Failed to submit request.' })
    }
  }

  const busy = createM.isPending
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle>Request manual attendance</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField size="small" fullWidth type="date" label="Date"
            InputLabelProps={{ shrink: true }} value={date}
            onChange={(e) => setDate(e.target.value)}
            inputProps={{ max: todayIso() }}
            disabled={busy} />
          <Stack direction="row" spacing={1.5}>
            <TextField size="small" fullWidth type="time" label="In Time"
              InputLabelProps={{ shrink: true }} value={inTime}
              onChange={(e) => setInTime(e.target.value)} disabled={busy} />
            <TextField size="small" fullWidth type="time" label="Out Time"
              InputLabelProps={{ shrink: true }} value={outTime}
              onChange={(e) => setOutTime(e.target.value)} disabled={busy} />
          </Stack>
          <TextField size="small" fullWidth multiline minRows={2}
            label="Reason *"
            placeholder="Why couldn't attendance be marked in real time?"
            value={reason} onChange={(e) => setReason(e.target.value)}
            disabled={busy} />
        </Stack>
      </DialogContent>
      <Divider />
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" disableElevation
          onClick={submit} disabled={busy}
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}>
          Submit for approval
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────
function todayIso() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function currentHHMM() {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function short(t) {
  if (!t) return '—'
  const s = String(t)
  return s.length >= 5 ? s.slice(0, 5) : s
}

function formatDurationHM(inT, outT) {
  const parse = (s) => {
    if (!s) return null
    const m = String(s).match(/^(\d{1,2}):(\d{1,2})/)
    return m ? Number(m[1]) * 60 + Number(m[2]) : null
  }
  const a = parse(inT), b = parse(outT)
  if (a == null || b == null || b <= a) return '—'
  const mins = b - a
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`
}

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate()
}

function buildCells(month, year) {
  const n = daysInMonth(month, year)
  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const mm = String(month).padStart(2, '0')
  const out = []
  for (let i = 0; i < firstWeekday; i++) out.push({ empty: true, key: `blank-${i}` })
  for (let d = 1; d <= n; d++) {
    const dd = String(d).padStart(2, '0')
    const date = `${year}-${mm}-${dd}`
    const dow = new Date(year, month - 1, d).getDay()
    out.push({ day: d, date, weekday: dow, key: date })
  }
  return out
}
