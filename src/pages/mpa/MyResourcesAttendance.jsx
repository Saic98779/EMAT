import { memo, useCallback, useMemo, useState } from 'react'
import {
  Box, Card, Table, TableHead, TableBody, TableRow, TableCell, Typography, Button,
  Alert, CircularProgress, TextField, MenuItem, Chip, Stack,
  Dialog, DialogContent, DialogActions, Snackbar, IconButton,
} from '@mui/material'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import CloseIcon from '@mui/icons-material/Close'
import { alpha } from '@mui/material/styles'
import { PageHeader, Mono } from '../../components/shared'
import { useAuth } from '../../auth'
import {
  useBseByUserSelected,
  useBseAttendanceByRecommendation,
  useCreateBseAttendance,
  useUpdateBseAttendance,
  useDeleteBseAttendance,
} from '../../queries'
import { workingDaysInMonth } from '../../apis/bseAttendance'

// Vendor / Consultancy — "View Attendance of My Resources".
// Vendor fills attendance for each of their BSEs directly. One record = one
// day of presence (with in/out time). The page has two levels:
//   • Top-level table: BSE row per resource, showing Working Days in the
//     picked month and a "Mark attendance" button.
//   • Drawer/dialog per BSE: a day-grid for the selected month; click a day
//     to add/edit/remove the attendance record for that date.

const MONTHS = [
  { n: 1, label: 'January' }, { n: 2, label: 'February' }, { n: 3, label: 'March' },
  { n: 4, label: 'April' }, { n: 5, label: 'May' }, { n: 6, label: 'June' },
  { n: 7, label: 'July' }, { n: 8, label: 'August' }, { n: 9, label: 'September' },
  { n: 10, label: 'October' }, { n: 11, label: 'November' }, { n: 12, label: 'December' },
]
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]

export default function MyResourcesAttendance() {
  const { user } = useAuth()
  const bsesQ = useBseByUserSelected(user?.userId)

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  // The BSE the vendor is currently marking attendance for. `null` when the
  // dialog is closed.
  const [target, setTarget] = useState(null)

  const rows = useMemo(() => bsesQ.data || [], [bsesQ.data])
  const initialLoading = bsesQ.isLoading && rows.length === 0

  return (
    <Box>
      <PageHeader
        title="Attendance of My Resources"
        subtitle="Mark and review working days for each BSE assigned to you."
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}
        alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
        <TextField select size="small" label="Month" value={month}
          onChange={(e) => setMonth(Number(e.target.value))} sx={{ minWidth: 160 }}>
          {MONTHS.map((m) => <MenuItem key={m.n} value={m.n}>{m.label}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Year" value={year}
          onChange={(e) => setYear(Number(e.target.value))} sx={{ minWidth: 120 }}>
          {YEARS.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
        </TextField>
        <Box sx={{ flexGrow: 1 }} />
        <Chip
          size="small" variant="outlined"
          label={`${rows.length} resource${rows.length === 1 ? '' : 's'}`}
        />
      </Stack>

      {initialLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <Table sx={{ '& tbody tr:last-of-type td': { border: 0 } }}>
            <TableHead>
              <TableRow>
                <TableCell width={64}>S.No</TableCell>
                <TableCell>IA</TableCell>
                <TableCell>Resource</TableCell>
                <TableCell>Mobile</TableCell>
                <TableCell align="right">Working Days</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, i) => (
                <AttendanceRow
                  key={r.uuid} resource={r} index={i + 1}
                  month={month} year={year}
                  onOpen={() => setTarget(r)}
                />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <AttendanceDialog
        target={target}
        month={month}
        year={year}
        onClose={() => setTarget(null)}
      />
    </Box>
  )
}

// ── Table row (memoised) ────────────────────────────────────────────────────
// Each row runs its own attendance query so the drilldown drawer and the
// visible count share the same cache — click the drawer, edit inside, and
// the row's count updates the moment the dialog closes.
const AttendanceRow = memo(function AttendanceRow({ resource, index, month, year, onOpen }) {
  const q = useBseAttendanceByRecommendation(resource.uuid)
  const workingDays = workingDaysInMonth(q.data || [], month, year)

  return (
    <TableRow hover onClick={onOpen} sx={{ cursor: 'pointer' }}>
      <TableCell><Mono>{index}</Mono></TableCell>
      <TableCell>{resource.industryAssociationName || '—'}</TableCell>
      <TableCell><Typography fontWeight={600}>{resource.bseName || '—'}</Typography></TableCell>
      <TableCell><Mono>{resource.mobileNumber || '—'}</Mono></TableCell>
      <TableCell align="right">
        {q.isLoading
          ? <CircularProgress size={14} />
          : <Chip size="small"
              color={workingDays > 0 ? 'success' : 'default'}
              variant={workingDays > 0 ? 'filled' : 'outlined'}
              label={`${workingDays} / ${daysInMonth(month, year)}`}
              sx={{ fontWeight: 700 }} />}
      </TableCell>
      <TableCell align="right">
        <Button size="small" variant="outlined"
          startIcon={<EventAvailableOutlinedIcon />}
          onClick={(e) => { e.stopPropagation(); onOpen() }}
          sx={{ textTransform: 'none' }}>
          Mark attendance
        </Button>
      </TableCell>
    </TableRow>
  )
})

// ── Attendance dialog ──────────────────────────────────────────────────────
// Proper calendar view for the selected month. Days are aligned to their
// weekday column (Sun … Sat) with a weekday header row. Present days show
// a green tick + times; unmarked days are muted; weekends are subtly tinted;
// today gets a highlighted ring so the vendor can find it fast.
function AttendanceDialog({ target, month, year, onClose }) {
  const q = useBseAttendanceByRecommendation(target?.uuid)
  const rows = q.data || []
  const [dayEditor, setDayEditor] = useState(null)

  const byDate = useMemo(() => {
    const idx = {}
    for (const r of rows) if (r.attendanceDate) idx[r.attendanceDate] = r
    return idx
  }, [rows])

  // Calendar cells: leading blanks so day 1 lands in its correct column
  // (Sunday-first grid — matches Excel / most Indian calendars).
  const cells = useMemo(() => {
    const n = daysInMonth(month, year)
    const firstWeekday = new Date(year, month - 1, 1).getDay()  // 0 = Sunday
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
  }, [month, year])

  const totalDays = cells.filter((c) => !c.empty).length
  const present = cells.reduce((n, c) => n + (!c.empty && byDate[c.date] ? 1 : 0), 0)
  const pct = totalDays ? Math.round((present / totalDays) * 100) : 0

  return (
    <>
      <Dialog open={!!target} onClose={onClose} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
        {/* Header — gradient banner so the dialog feels distinct from the page */}
        <Box sx={{
          px: { xs: 2, sm: 3 }, py: 2,
          background: (t) => `linear-gradient(135deg, ${t.palette.primary.main} 0%, ${t.palette.primary.dark} 100%)`,
          color: 'primary.contrastText',
          display: 'flex', alignItems: 'center', gap: 2,
        }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="overline" sx={{ opacity: 0.75, letterSpacing: '0.14em' }}>
              {MONTHS.find((m) => m.n === month)?.label} {year}
            </Typography>
            <Typography variant="h6" fontWeight={700} noWrap>
              {target?.bseName || 'Resource'}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.85 }} noWrap>
              {target?.industryAssociationName || '—'} · {target?.mobileNumber || '—'}
            </Typography>
          </Box>
          <Stack alignItems="center" sx={{ minWidth: 80 }}>
            <Typography variant="h4" fontWeight={800} lineHeight={1}>{present}</Typography>
            <Typography variant="caption" sx={{ opacity: 0.85 }}>of {totalDays} days</Typography>
          </Stack>
          <IconButton onClick={onClose} sx={{ color: 'inherit', ml: 0.5 }} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Progress bar */}
        <Box sx={{ height: 4, bgcolor: 'action.hover' }}>
          <Box sx={{
            height: '100%', width: `${pct}%`,
            background: (t) => `linear-gradient(90deg, ${t.palette.success.light}, ${t.palette.success.main})`,
            transition: 'width .2s',
          }} />
        </Box>

        <DialogContent sx={{ px: { xs: 1.5, sm: 2.5 }, py: 2 }}>
          {q.isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* Weekday header */}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 1, mb: 1,
              }}>
                {WEEKDAYS.map((w, i) => (
                  <Typography
                    key={w}
                    variant="caption"
                    sx={{
                      textAlign: 'center',
                      color: (i === 0 || i === 6) ? 'error.main' : 'text.secondary',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {w}
                  </Typography>
                ))}
              </Box>

              {/* Day grid */}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 1,
              }}>
                {cells.map((c) => {
                  if (c.empty) return <Box key={c.key} />
                  const existing = byDate[c.date]
                  return (
                    <DayCard
                      key={c.key}
                      day={c.day}
                      date={c.date}
                      weekday={c.weekday}
                      existing={existing}
                      onClick={() => setDayEditor({ date: c.date, existing })}
                    />
                  )
                })}
              </Box>

              {/* Legend */}
              <Stack direction="row" spacing={2} sx={{ mt: 2.5, flexWrap: 'wrap' }}>
                <Legend color="success.main" label="Present" />
                <Legend color="divider" outline label="Not marked" />
                <Legend color="primary.main" outline label="Today" />
              </Stack>
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      <DayEditorDialog
        open={!!dayEditor}
        date={dayEditor?.date}
        existing={dayEditor?.existing}
        recommendationId={target?.uuid}
        onClose={() => setDayEditor(null)}
      />
    </>
  )
}

// One-day tile in the calendar grid.
// • Weekends get a subtle grey background so the calendar reads like a week.
// • Today gets a solid primary-blue ring so it's easy to find.
// • Present days: green fill + big check icon + times underneath.
// • Not marked: neutral outline + only the day number.
const DayCard = memo(function DayCard({ day, date, weekday, existing, onClick }) {
  const isPresent = !!existing
  const isWeekend = weekday === 0 || weekday === 6
  const isToday = date === todayIso()

  return (
    <Box
      onClick={onClick}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      sx={{
        minHeight: 78,
        p: 0.75, borderRadius: 1.5,
        border: '1.5px solid',
        borderColor: isPresent ? 'success.main'
          : isToday ? 'primary.main'
          : 'divider',
        bgcolor: (t) => isPresent
          ? alpha(t.palette.success.main, 0.08)
          : isWeekend
            ? alpha(t.palette.text.primary, 0.03)
            : 'background.paper',
        cursor: 'pointer',
        transition: 'border-color .12s, background-color .12s, box-shadow .12s, transform .05s',
        outline: 'none',
        '&:hover': {
          borderColor: 'primary.main',
          boxShadow: 1,
          transform: 'translateY(-1px)',
        },
        '&:focus-visible': {
          borderColor: 'primary.main',
          boxShadow: (t) => `0 0 0 3px ${alpha(t.palette.primary.main, 0.25)}`,
        },
        display: 'flex', flexDirection: 'column', gap: 0.25,
      }}
    >
      {/* Top row: day number + present badge */}
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography
          fontWeight={700}
          fontSize="0.95rem"
          sx={{
            color: isPresent ? 'success.dark'
              : isToday ? 'primary.dark'
              : isWeekend ? 'text.disabled'
              : 'text.primary',
          }}
        >
          {day}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        {isPresent && (
          <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
        )}
      </Stack>

      {/* Bottom: times if present, otherwise a muted hint on hover */}
      {isPresent ? (
        <Stack direction="row" alignItems="center" spacing={0.4}
          sx={{ color: 'success.dark' }}>
          <AccessTimeIcon sx={{ fontSize: 12 }} />
          <Typography
            variant="caption"
            sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '0.68rem', lineHeight: 1.2 }}
          >
            {short(existing.inTime)}–{short(existing.outTime)}
          </Typography>
        </Stack>
      ) : (
        <Typography
          variant="caption"
          sx={{ color: 'text.disabled', fontSize: '0.68rem', mt: 'auto' }}
        >
          {isToday ? 'Today' : ' '}
        </Typography>
      )}
    </Box>
  )
})

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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

// "09:00:00" → "09:00" — keeps the calendar tiles tidy.
function short(t) {
  if (!t) return '—'
  const s = String(t)
  return s.length >= 5 ? s.slice(0, 5) : s
}

function todayIso() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ── Per-day add/edit/delete dialog ──────────────────────────────────────────
function DayEditorDialog({ open, date, existing, recommendationId, onClose }) {
  const createM = useCreateBseAttendance()
  const updateM = useUpdateBseAttendance()
  const deleteM = useDeleteBseAttendance()

  const [inTime, setInTime] = useState(existing?.inTime || '09:00')
  const [outTime, setOutTime] = useState(existing?.outTime || '18:00')
  const [toast, setToast] = useState({ severity: '', msg: '' })

  // Reset local state whenever the dialog opens on a new day.
  useMemo(() => {
    if (open) {
      setInTime(existing?.inTime || '09:00')
      setOutTime(existing?.outTime || '18:00')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.uuid])

  const isEdit = !!existing?.uuid || existing?.id != null
  const busy = createM.isPending || updateM.isPending || deleteM.isPending

  const save = useCallback(async () => {
    const values = { bseRecommendationId: recommendationId, attendanceDate: date, inTime, outTime }
    try {
      if (isEdit) {
        await updateM.mutateAsync({ id: existing.uuid ?? existing.id, values })
        setToast({ severity: 'success', msg: 'Attendance updated.' })
      } else {
        await createM.mutateAsync(values)
        setToast({ severity: 'success', msg: 'Attendance marked.' })
      }
      onClose()
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Failed to save.' })
    }
  }, [createM, updateM, isEdit, existing, recommendationId, date, inTime, outTime, onClose])

  const remove = useCallback(async () => {
    if (!existing) return
    try {
      await deleteM.mutateAsync({
        id: existing.uuid ?? existing.id,
        recommendationId,
      })
      setToast({ severity: 'success', msg: 'Attendance removed.' })
      onClose()
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Failed to delete.' })
    }
  }, [deleteM, existing, recommendationId, onClose])

  const hours = durationHours(inTime, outTime)
  const canSave = !!inTime && !!outTime && hours != null && hours > 0

  return (
    <>
      <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
        {/* Compact header: pretty date + close, no shouty title */}
        <Stack direction="row" alignItems="center" spacing={1}
          sx={{ px: 2.5, pt: 2, pb: 1 }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary"
              sx={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {isEdit ? 'Edit attendance' : 'Mark attendance'}
            </Typography>
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              {prettyDate(date)}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose} disabled={busy} aria-label="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>

        <DialogContent sx={{ px: 2.5, pt: 1, pb: 2 }}>
          <Stack direction="row" spacing={1.5}>
            <TextField size="small" fullWidth type="time" label="In time"
              InputLabelProps={{ shrink: true }}
              value={inTime} onChange={(e) => setInTime(e.target.value)}
              disabled={busy} />
            <TextField size="small" fullWidth type="time" label="Out time"
              InputLabelProps={{ shrink: true }}
              value={outTime} onChange={(e) => setOutTime(e.target.value)}
              disabled={busy} />
          </Stack>

          {/* Quiet duration pill — updates as the user picks times */}
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 1.5 }}>
            <AccessTimeIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
            <Typography variant="caption" color="text.secondary">
              {hours == null
                ? 'Set both times to see total.'
                : hours <= 0
                  ? 'Out time must be after in time.'
                  : `Total: ${formatHours(hours)}`}
            </Typography>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 2, py: 1.25, gap: 0.5 }}>
          {isEdit && (
            <Button
              size="small" color="error"
              startIcon={deleteM.isPending
                ? <CircularProgress size={12} color="inherit" />
                : <DeleteOutlineIcon fontSize="small" />}
              onClick={remove} disabled={busy}
              sx={{ textTransform: 'none' }}
            >
              Remove
            </Button>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Button size="small" onClick={onClose} disabled={busy}
            sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            size="small" variant="contained" disableElevation
            onClick={save}
            disabled={busy || !canSave}
            startIcon={(createM.isPending || updateM.isPending)
              ? <CircularProgress size={12} color="inherit" /> : null}
            sx={{ textTransform: 'none', minWidth: 84 }}
          >
            {isEdit ? 'Save' : 'Mark'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast.msg} autoHideDuration={2500}
        onClose={() => setToast({ severity: '', msg: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={toast.severity || 'info'} variant="filled"
          onClose={() => setToast({ severity: '', msg: '' })}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </>
  )
}

// "2026-08-12" → "Wed, 12 Aug 2026". Falls back to the raw value.
function prettyDate(iso) {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00`)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  })
}

// Duration in hours between two "HH:mm" strings. Returns null when either
// side is missing/invalid so the UI can show a distinct "not yet" hint.
function durationHours(inT, outT) {
  const parse = (s) => {
    if (!s) return null
    const m = String(s).match(/^(\d{1,2}):(\d{1,2})/)
    if (!m) return null
    return Number(m[1]) * 60 + Number(m[2])
  }
  const a = parse(inT), b = parse(outT)
  if (a == null || b == null) return null
  return (b - a) / 60
}

function formatHours(h) {
  const sign = h < 0 ? '-' : ''
  const abs = Math.abs(h)
  const hh = Math.floor(abs)
  const mm = Math.round((abs - hh) * 60)
  if (mm === 0) return `${sign}${hh}h`
  return `${sign}${hh}h ${mm}m`
}

// ── Empty state ────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <Box sx={{
      textAlign: 'center', py: 6, px: 3,
      border: '1px dashed', borderColor: 'divider', borderRadius: 2,
      bgcolor: 'action.hover',
    }}>
      <EventAvailableOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
      <Typography variant="subtitle1" fontWeight={700} color="text.secondary">
        No resources assigned yet
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 480, mx: 'auto' }}>
        Once SIDBI HO onboards BSEs under your login, they&apos;ll appear here so
        you can mark their attendance.
      </Typography>
    </Box>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────
function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate()
}
