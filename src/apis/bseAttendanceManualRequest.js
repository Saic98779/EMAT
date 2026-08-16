import { apiFetch } from '../api'

// Backend `bse-attendance-manual-request-controller`. Used when a BSE
// forgets to mark attendance in real time (or needs to backdate a day) —
// they submit a manual request with a reason; MPA/supervisor approves or
// rejects it. Approved rows should be treated as attendance for
// downstream salary / working-day totals.
//
// Record shape per Swagger:
//   {
//     uuid                : own PK
//     bseRecommendationId : which BSE
//     attendanceDate      : ISO date (YYYY-MM-DD)
//     inTime / outTime    : "HH:mm" / "HH:mm:ss"
//     reason              : free text — why the manual entry
//     isApproved          : null (pending) | true | false
//     approvedDate        : ISO datetime when approved / rejected
//     approvedBy          : approver's uuid
//   }
const PATH = '/bse-attendance-manual-request'

// ── Reads ──────────────────────────────────────────────────────────────────
export function listBseAttendanceManualRequests({ signal } = {}) {
  return apiFetch(PATH, { signal })
}

export function getBseAttendanceManualRequest(id, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}`, { signal })
}

// GET /bse-attendance-manual-request/recommendation/{recommendationId}
// All manual requests raised by / for a specific BSE. Used both by the
// BSE workspace (show their own pending / decided requests) and by the
// approver's per-BSE drill-down.
export function listBseAttendanceManualRequestsByRecommendation(recommendationId, { signal } = {}) {
  return apiFetch(
    `${PATH}/recommendation/${encodeURIComponent(recommendationId)}`,
    { signal },
  )
}

// GET /bse-attendance-manual-request/approval-status/{status}
// `status` is one of: pending | approved | rejected — feeds the approver's
// queue tabs without having to filter client-side.
export function listBseAttendanceManualRequestsByStatus(status, { signal } = {}) {
  return apiFetch(
    `${PATH}/approval-status/${encodeURIComponent(status)}`,
    { signal },
  )
}

// ── Writes ─────────────────────────────────────────────────────────────────
export function createBseAttendanceManualRequest(values, { signal } = {}) {
  return apiFetch(PATH, { method: 'POST', body: toPayload(values), signal })
}

export function updateBseAttendanceManualRequest(id, values, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: toPayload(values),
    signal,
  })
}

export function deleteBseAttendanceManualRequest(id, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}`, { method: 'DELETE', signal })
}

// PATCH /bse-attendance-manual-request/{id}/approve
// PATCH /bse-attendance-manual-request/{id}/reject
// Backend stamps approvedDate + approvedBy from the JWT session — no body
// required (spec has an empty request schema for these endpoints).
export function approveBseAttendanceManualRequest(id, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}/approve`, { method: 'PATCH', signal })
}

export function rejectBseAttendanceManualRequest(id, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}/reject`, { method: 'PATCH', signal })
}

// ── Payload adapter ────────────────────────────────────────────────────────
// Same shape as bse-attendance + `reason`. Backend fills the approval
// fields — POST/PUT never send them.
export function toPayload(v = {}) {
  return {
    bseRecommendationId: str(v.bseRecommendationId),
    attendanceDate: toIsoDate(v.attendanceDate),
    inTime: normaliseTime(v.inTime),
    outTime: normaliseTime(v.outTime),
    reason: str(v.reason),
  }
}

// ── Coercion helpers ───────────────────────────────────────────────────────
const str = (v) => (v == null || v === '' ? null : String(v).trim() || null)

function normaliseTime(v) {
  if (v == null || v === '') return null
  const s = String(v).trim()
  const m = s.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/)
  if (!m) return s
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
