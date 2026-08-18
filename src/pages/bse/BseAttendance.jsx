import { memo, useCallback, useMemo, useState } from 'react'
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, Grid, MenuItem, Snackbar,
  Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import LoginIcon from '@mui/icons-material/Login'
import LogoutIcon from '@mui/icons-material/Logout'
import EditCalendarOutlinedIcon from '@mui/icons-material/EditCalendarOutlined'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import CancelIcon from '@mui/icons-material/Cancel'
import { alpha } from '@mui/material/styles'
import { PageHeader } from '../../components/shared'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useAuth } from '../../auth'
import {
  useBseAttendanceList,
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

  // Straight to the attendance controller — GET /bse-attendance returns
  // the rows the backend chooses to expose to this token (in production
  // this is expected to be scoped to the logged-in BSE; the frontend
  // doesn't second-guess that scoping). The parent `bseRecommendationId`
  // needed for POST / PUT is derived from those returned rows.
  const attendanceQ = useBseAttendanceList()
  const rows = useMemo(() => attendanceQ.data || [], [attendanceQ.data])
  // Pick the recommendationId that appears most often in the returned
  // rows — that's the BSE's own recommendation. Falls back to the first
  // row's id if all rows are equally represented (single-BSE case).
  const recommendationId = useMemo(() => pickRecommendationId(rows), [rows])
  const manualQ = useBseAttendanceManualRequestsByRecommendation(recommendationId)
  const createAttendance = useCreateBseAttendance()
  const updateAttendance = useUpdateBseAttendance()

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [manualOpen, setManualOpen] = useState(false)
  const [toast, setToast] = useState({ severity: '', msg: '' })
  // { kind: 'in' | 'out' } — driven by header buttons; runs on confirm.
  const [confirm, setConfirm] = useState(null)

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

  if (attendanceQ.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
  }

  return (
    <Box>
      <PageHeader
        title="Attendance"
        subtitle={`Mark your In / Out each day — ${user?.name || 'BSE'}.`}
      />

      {/* Today card — hero for the primary action. Colour shifts with
          state so the BSE knows at a glance whether they've marked In. */}
      <TodayCard
        todaysRow={todaysRow}
        isCheckedIn={isCheckedIn}
        isCheckedOut={isCheckedOut}
        onIn={() => setConfirm({ kind: 'in' })}
        onOut={() => setConfirm({ kind: 'out' })}
        inDisabled={createAttendance.isPending || !!todaysRow || !recommendationId}
        outDisabled={updateAttendance.isPending || !isCheckedIn || !recommendationId}
        greeting={greetingFor(now)}
        dateLabel={longDate(now)}
      />

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}
                alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
                    {MONTHS.find((m) => m.n === month)?.label} {year}
                  </Typography>
                  <Typography variant="caption" color="text.secondary"
                    sx={{ letterSpacing: '0.06em', fontWeight: 600 }}>
                    {daysMarked} of {totalDays} days marked
                  </Typography>
                </Box>
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
          <Card sx={(t) => ({
            mb: 2, borderRadius: 2,
            borderLeft: `4px solid ${t.palette.warning.main}`,
          })}>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 1 }}>
                <Box sx={(t) => ({
                  width: 36, height: 36, borderRadius: 1.5,
                  bgcolor: alpha(t.palette.warning.main, 0.14),
                  color: t.palette.warning.dark,
                  display: 'grid', placeItems: 'center', flexShrink: 0,
                })}>
                  <EditCalendarOutlinedIcon fontSize="small" />
                </Box>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
                    Missed a day?
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    File a manual request for a past day. Your GT supervisor
                    reviews and approves it before it counts.
                  </Typography>
                </Box>
              </Stack>
              <Button fullWidth size="medium" variant="outlined" color="warning"
                startIcon={<EditCalendarOutlinedIcon />}
                onClick={() => setManualOpen(true)}
                sx={{ textTransform: 'none', fontWeight: 700, mt: 1 }}>
                Request manual attendance
              </Button>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.25 }}>
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

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm?.kind === 'in') await markInTime()
          else if (confirm?.kind === 'out') await markOutTime()
          setConfirm(null)
        }}
        busy={createAttendance.isPending || updateAttendance.isPending}
        severity={confirm?.kind === 'out' ? 'warning' : 'success'}
        title={confirm?.kind === 'out' ? 'Mark Out Time?' : 'Mark In Time?'}
        description={confirm?.kind === 'out'
          ? `Ending your day at ${currentHHMM()}. This will close today's attendance — you can't re-open it once marked.`
          : `Starting your day at ${currentHHMM()}. This records today as attended.`}
        confirmLabel={confirm?.kind === 'out' ? 'Mark Out' : 'Mark In'}
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

// ── Today hero ─────────────────────────────────────────────────────────────
const TodayCard = memo(function TodayCard({
  todaysRow, isCheckedIn, isCheckedOut, onIn, onOut, inDisabled, outDisabled,
  greeting, dateLabel,
}) {
  const tone = isCheckedIn ? 'success' : isCheckedOut ? 'info' : 'primary'
  const statusLabel = isCheckedIn
    ? `Checked in since ${short(todaysRow.inTime)}`
    : isCheckedOut
      ? `Day closed · ${short(todaysRow.inTime)} → ${short(todaysRow.outTime)} · ${formatDurationHM(todaysRow.inTime, todaysRow.outTime)}`
      : 'Not yet marked for today.'

  return (
    <Card sx={(t) => ({
      mb: 2.5,
      borderRadius: 3, overflow: 'hidden', position: 'relative',
      border: 0,
      color: 'common.white',
      background: `linear-gradient(120deg, ${t.palette[tone].dark} 0%, ${t.palette[tone].main} 100%)`,
    })}>
      {/* subtle decorative rings — same visual language as GreetingBanner */}
      <Box sx={{ position: 'absolute', right: -80, top: -80, width: 240, height: 240, borderRadius: '50%', bgcolor: alpha('#fff', 0.06) }} />
      <Box sx={{ position: 'absolute', right: 60, bottom: -110, width: 220, height: 220, borderRadius: '50%', bgcolor: alpha('#fff', 0.05) }} />
      <CardContent sx={{ position: 'relative', p: { xs: 2.5, md: 3.5 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}
          alignItems={{ md: 'center' }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="overline" sx={{ letterSpacing: '0.14em', color: alpha('#fff', 0.72), fontWeight: 700 }}>
              {dateLabel}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.25 }}>
              {greeting}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.25 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%',
                bgcolor: isCheckedIn ? '#7CFFB2' : isCheckedOut ? alpha('#fff', 0.85) : alpha('#fff', 0.5) }} />
              <Typography sx={{ color: alpha('#fff', 0.94), fontWeight: 500 }}>
                {statusLabel}
              </Typography>
            </Stack>
          </Box>
          <Stack direction="row" spacing={1.25}>
            <Button
              variant="contained" size="large"
              startIcon={<LoginIcon />}
              onClick={onIn}
              disabled={inDisabled}
              sx={{
                textTransform: 'none', fontWeight: 700,
                bgcolor: 'common.white', color: 'success.dark',
                '&:hover': { bgcolor: 'grey.100' },
                '&.Mui-disabled': { bgcolor: alpha('#fff', 0.3), color: alpha('#fff', 0.6) },
              }}
            >
              In Time
            </Button>
            <Button
              variant="outlined" size="large"
              startIcon={<LogoutIcon />}
              onClick={onOut}
              disabled={outDisabled}
              sx={{
                textTransform: 'none', fontWeight: 700,
                borderColor: alpha('#fff', 0.7), color: 'common.white',
                '&:hover': { borderColor: 'common.white', bgcolor: alpha('#fff', 0.08) },
                '&.Mui-disabled': { borderColor: alpha('#fff', 0.25), color: alpha('#fff', 0.4) },
              }}
            >
              Out Time
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
})

function greetingFor(d) {
  const h = d.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
function longDate(d) {
  return d.toLocaleDateString(undefined, {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
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
// Pick the recommendation id the current attendance page should target
// for POST / PUT. If the backend returns multiple recommendationIds
// (e.g. a stub environment where /bse-attendance is unscoped), take the
// one that appears most often — that's the "primary" attendance owner.
function pickRecommendationId(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null
  const counts = new Map()
  for (const r of rows) {
    const id = r?.bseRecommendationId
    if (!id) continue
    counts.set(id, (counts.get(id) || 0) + 1)
  }
  let top = null
  let topN = 0
  for (const [id, n] of counts) {
    if (n > topN) { top = id; topN = n }
  }
  return top
}

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
