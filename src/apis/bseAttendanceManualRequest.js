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

// PATCH /bse-attendance-manual-request/{id}/approve?approvedBy=<UUID>
// PATCH /bse-attendance-manual-request/{id}/reject?approvedBy=<UUID>
// Backend requires `approvedBy` as a query parameter typed as UUID
// (returns 400 without it) — it does NOT derive the approver from the
// JWT. Users don't have UUIDs on this backend (just integer userIds),
// so we encode the userId into a UUID-shaped string via
// `userIdToUuid()` before sending. Once backend either derives approver
// from JWT or exposes user UUIDs, we can swap this over.
export function approveBseAttendanceManualRequest(id, { approvedBy, signal } = {}) {
  const q = new URLSearchParams({ approvedBy: approvedBy || '' }).toString()
  return apiFetch(`${PATH}/${encodeURIComponent(id)}/approve?${q}`, { method: 'PATCH', signal })
}

export function rejectBseAttendanceManualRequest(id, { approvedBy, signal } = {}) {
  const q = new URLSearchParams({ approvedBy: approvedBy || '' }).toString()
  return apiFetch(`${PATH}/${encodeURIComponent(id)}/reject?${q}`, { method: 'PATCH', signal })
}

// Encode an integer userId into a UUID-shaped string so it satisfies the
// backend's UUID type check while still carrying the approver's identity
// in the last group of the UUID. E.g. userId=22 → 00000000-0000-0000-
// 0000-000000000022.
export function userIdToUuid(userId) {
  const n = Math.max(0, Number(userId) || 0)
  const hex = n.toString(16).padStart(12, '0').slice(-12)
  return `00000000-0000-0000-0000-${hex}`
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
