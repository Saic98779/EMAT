import { apiFetch } from '../api'

// Backend `bse-attendance-controller`. One record = one day of presence for
// one BSE — the vendor (Manpower Agency) files these directly from the
// "View Attendance" workspace.
const PATH = '/bse-attendance'

// Record shape per Swagger:
//   {
//     uuid                : own PK
//     bseRecommendationId : which BSE (their recommendation UUID)
//     attendanceDate      : ISO date (YYYY-MM-DD)
//     inTime  / outTime   : time strings (HH:mm or HH:mm:ss)
//   }

export function listBseAttendance({ signal } = {}) {
  return apiFetch(PATH, { signal })
}

export function getBseAttendance(id, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}`, { signal })
}

// GET /bse-attendance/recommendation/{recommendationId}
// All attendance rows for a single BSE. The MPA workspace uses this per-BSE
// when the vendor drills into "Attendance of My Resources".
export function listBseAttendanceByRecommendation(recommendationId, { signal } = {}) {
  return apiFetch(
    `${PATH}/recommendation/${encodeURIComponent(recommendationId)}`,
    { signal },
  )
}

export function createBseAttendance(values, { signal } = {}) {
  return apiFetch(PATH, { method: 'POST', body: toPayload(values), signal })
}

export function updateBseAttendance(id, values, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: toPayload(values),
    signal,
  })
}

export function deleteBseAttendance(id, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}`, { method: 'DELETE', signal })
}

// ── Payload adapter ────────────────────────────────────────────────────────
// The Swagger schema is minimal — only four fields. We normalise the date to
// YYYY-MM-DD and pad times to HH:mm so the backend never sees a partial
// string like `9:5`.
export function toPayload(v = {}) {
  return {
    bseRecommendationId: str(v.bseRecommendationId),
    attendanceDate: toIsoDate(v.attendanceDate),
    inTime: normaliseTime(v.inTime),
    outTime: normaliseTime(v.outTime),
  }
}

// ── Client-side helpers ────────────────────────────────────────────────────

// Count of attendance rows falling within a given calendar month.
// month is 1-12; year is a four-digit int.
export function workingDaysInMonth(rows = [], month, year) {
  if (!Array.isArray(rows)) return 0
  const mm = String(month).padStart(2, '0')
  const prefix = `${year}-${mm}-`
  let n = 0
  for (const r of rows) {
    if (typeof r?.attendanceDate === 'string' && r.attendanceDate.startsWith(prefix)) n++
  }
  return n
}

// Given a list of attendance rows and (month, year), returns a map keyed by
// the "DD" of each day → the row for that day. Lets the UI look up presence
// in O(1) while rendering the per-day grid.
export function attendanceIndexByDay(rows = [], month, year) {
  const mm = String(month).padStart(2, '0')
  const prefix = `${year}-${mm}-`
  const idx = {}
  for (const r of rows) {
    if (typeof r?.attendanceDate === 'string' && r.attendanceDate.startsWith(prefix)) {
      const dd = r.attendanceDate.slice(8, 10)
      idx[dd] = r
    }
  }
  return idx
}

// ── Coercion helpers ───────────────────────────────────────────────────────
const str = (v) => (v == null || v === '' ? null : String(v).trim() || null)

function normaliseTime(v) {
  if (v == null || v === '') return null
  const s = String(v).trim()
  // Accept "H:M", "HH:MM", "HH:MM:SS" — pad hour/minute to two digits.
  const m = s.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/)
  if (!m) return s // let the backend decide if we don't recognise it
  const hh = m[1].padStart(2, '0')
  const mm = m[2].padStart(2, '0')
  return m[3] ? `${hh}:${mm}:${m[3].padStart(2, '0')}` : `${hh}:${mm}`
}

function toIsoDate(v) {
  if (!v) return null
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const dmy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}
