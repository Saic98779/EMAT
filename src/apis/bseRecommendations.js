  import { apiFetch } from '../api'

// Backend collection covering BSE candidate recommendations proposed by GT.
const PATH = '/bse-recommendations'

export function listBseRecommendations({ signal } = {}) {
  return apiFetch(PATH, { signal })
}

export function getBseRecommendation(uuid, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(uuid)}`, { signal })
}

// POST create — feeds `BseCandidate.jsx`. Caller passes the raw form values
// plus the `registrationUuid` of the target Industry Association (looked up
// from the selected `ia_name` on the page).
export function createBseRecommendation(values, registrationUuid, { signal } = {}) {
  return apiFetch(PATH, {
    method: 'POST',
    body: toPayload(values, registrationUuid),
    signal,
  })
}

// PUT update — used by the BSE candidate detail page for review actions
// (GT / HO / PMU / Committee recommendations, onboarding, etc.). Caller
// passes a partial patch shaped by `toUpdatePayload`.
export function updateBseRecommendation(uuid, patch, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(uuid)}`, {
    method: 'PUT',
    body: patch,
    signal,
  })
}

// GET /bse-recommendations/search?name=…
export function searchBseRecommendations(name, { signal } = {}) {
  const q = new URLSearchParams({ name: name ?? '' }).toString()
  return apiFetch(`${PATH}/search?${q}`, { signal })
}

// GET /bse-recommendations/registration/{registrationUuid}
// All BSE candidates proposed against a single IA registration.
export function listBseRecommendationsByRegistration(registrationUuid, { signal } = {}) {
  return apiFetch(
    `${PATH}/registration/${encodeURIComponent(registrationUuid)}`,
    { signal },
  )
}

// GET /bse-recommendations/gt-recommendation/{status}
export function listBseRecommendationsByGtStatus(status, { signal } = {}) {
  return apiFetch(
    `${PATH}/gt-recommendation/${encodeURIComponent(status)}`,
    { signal },
  )
}

// GET /bse-recommendations/ho-recommendation/{status}
export function listBseRecommendationsByHoStatus(status, { signal } = {}) {
  return apiFetch(
    `${PATH}/ho-recommendation/${encodeURIComponent(status)}`,
    { signal },
  )
}

// GET /bse-recommendations/pmu-recommendation/{status}
export function listBseRecommendationsByPmuStatus(status, { signal } = {}) {
  return apiFetch(
    `${PATH}/pmu-recommendation/${encodeURIComponent(status)}`,
    { signal },
  )
}

// GET /bse-recommendations/mapped/{status}
// `status` is the deployment-mapped state (boolean-like: true/false).
export function listBseRecommendationsByMappedStatus(status, { signal } = {}) {
  return apiFetch(
    `${PATH}/mapped/${encodeURIComponent(status)}`,
    { signal },
  )
}

// ── Payload adapter ─────────────────────────────────────────────────────────
// Frontend form values → backend `CreateBseRecommendationRequest`.
// - Coerces Yes/No strings to booleans for `experienced`
// - Emits ISO-8601 dates (accepts DD/MM/YYYY too)
// - File-typed fields are sent as `null` for now (no upload endpoint yet;
//   swap to filenames or URLs once uploads are wired)
// - Downstream stage fields (PMU / HO / Committee / approval / joining /
//   mapping / offer letter) are sent as `null` on create — they're populated
//   by the PUT flow after each stage's review.
//
// `industryRegistrationId` mirrors `registrationUuid` today: the frontend only
// carries the IA's UUID, and no separate short/human id is surfaced by the
// backend on the IA DTO. Pass the same UUID until the backend clarifies.
export function toPayload(v = {}, registrationUuid = null) {
  const experienced = bool(v.experience_status)
  const uuid = str(registrationUuid)
  return {
    registrationUuid: uuid,
    industryRegistrationId: uuid,
    vendorUuid: str(v.vendor_uuid),
    state: str(v.state),
    district: str(v.district),
    bseName: str(v.bse_name),
    mobileNumber: str(v.mobile),
    emailId: str(v.email),
    highestQualification: str(v.qualification),
    experienced,
    experienceYears: experienced ? int(v.experience_years) : null,
    experienceMonths: experienced ? int(v.experience_months) : null,
    employmentStatus: str(v.employment_status),
    currentSalary: v.employment_status === 'Working' ? num(v.current_salary) : null,
    noticePeriodDays: v.employment_status === 'Working' ? int(v.notice_period) : null,
    lastDrawnSalary: v.employment_status === 'Resigned' ? num(v.last_drawn_salary) : null,
    relievingLetter: null,
    expectedSalary: num(v.expected_salary),
    resumeStatus: str(v.resume_status),
    resumeFile: null,
    salarySlip: null,
    candidateCv: null,
    gtRecommendation: str(v.recommendation),
    gtRecommendationDate: toIsoDate(v.recommendation_date),
    gtRemarks: str(v.gt_remarks),
    pmuRecommendation: null,
    pmuRecommendationDate: null,
    pmuRemarks: null,
    hoRecommendation: null,
    hoRecommendationDate: null,
    hoRemarks: null,
    committeeRecommendation: null,
    committeeDate: null,
    committeeMom: null,
    committeeRemarks: null,
    approvedSalary: null,
    approvedTravelAllowance: null,
    dateOfJoining: null,
    iaMapped: null,
    offerLetter: null,
  }
}

// ── Update payload adapter ─────────────────────────────────────────────────
// Frontend patch → backend `UpdateBseRecommendationRequest`. Only the keys
// present in `patch` are forwarded — this keeps PUT idempotent for partial
// review edits (e.g., HO records their recommendation without touching the
// GT fields). Server-controlled `id` / `uuid` / timestamps are never sent.
//
// Recognised patch keys (all optional):
//   state, district,
//   pmuRecommendation, pmuRecommendationDate, pmuRemarks,
//   hoRecommendation,  hoRecommendationDate,  hoRemarks,
//   committeeRecommendation, committeeDate, committeeMom, committeeRemarks,
//   gtRecommendation, gtRecommendationDate, gtRemarks,
//   iaMapped,
//   dateOfJoining, approvedSalary, approvedTravelAllowance,
//   expectedSalary, resumeStatus,
//   resumeFile, salarySlip, candidateCv, relievingLetter, offerLetter,
export function toUpdatePayload(patch = {}) {
  const out = {}
  const passthrough = [
    'state', 'district',
    'pmuRecommendation', 'pmuRemarks',
    'hoRecommendation', 'hoRemarks',
    'committeeRecommendation', 'committeeMom', 'committeeRemarks',
    'gtRecommendation', 'gtRemarks',
    'resumeStatus',
    'resumeFile', 'salarySlip', 'candidateCv', 'relievingLetter', 'offerLetter',
  ]
  for (const k of passthrough) if (patch[k] !== undefined) out[k] = str(patch[k])

  const dateKeys = [
    'pmuRecommendationDate', 'hoRecommendationDate',
    'committeeDate', 'gtRecommendationDate',
    'dateOfJoining',
  ]
  for (const k of dateKeys) if (patch[k] !== undefined) out[k] = toIsoDate(patch[k])

  if (patch.iaMapped !== undefined) out.iaMapped = bool(patch.iaMapped)
  if (patch.expectedSalary !== undefined) out.expectedSalary = num(patch.expectedSalary)
  if (patch.currentSalary !== undefined) out.currentSalary = num(patch.currentSalary)
  if (patch.lastDrawnSalary !== undefined) out.lastDrawnSalary = num(patch.lastDrawnSalary)
  if (patch.noticePeriodDays !== undefined) out.noticePeriodDays = int(patch.noticePeriodDays)
  if (patch.approvedSalary !== undefined) out.approvedSalary = num(patch.approvedSalary)
  if (patch.approvedTravelAllowance !== undefined) out.approvedTravelAllowance = num(patch.approvedTravelAllowance)
  return out
}

// ── Coercion helpers ────────────────────────────────────────────────────────
const str = (v) => (v == null || v === '' ? null : String(v))
const int = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}
const num = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const bool = (v) => {
  if (v === true) return true
  if (v === false) return false
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (s === 'yes' || s === 'true') return true
    if (s === 'no' || s === 'false') return false
  }
  return null
}
// Accepts ISO-8601, DD/MM/YYYY (form placeholder), or anything Date can parse.
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

// ── Adapter ─────────────────────────────────────────────────────────────────
// Maps a backend recommendation record to the internal shape used by the
// BSE candidates list / dashboards. The raw DTO is kept on `.raw` so we can
// round-trip edits later without re-fetching.
export function fromDto(dto = {}) {
  return {
    id: dto.uuid,
    uuid: dto.uuid,
    name: dto.bseName || '—',
    ia: dto.industryAssociationName || dto.registrationUuid || '—',
    mobile: dto.mobileNumber || '—',
    email: dto.emailId || '—',
    qualification: dto.highestQualification || '—',
    experienceStatus: dto.experienced ? 'Yes' : 'No',
    experience: dto.experienced
      ? `${dto.experienceYears || 0}y ${dto.experienceMonths || 0}m`
      : '—',
    employmentStatus: dto.employmentStatus || '—',
    currentSalary: dto.currentSalary ?? null,
    noticePeriod: dto.noticePeriodDays ?? null,
    lastDrawnSalary: dto.lastDrawnSalary ?? null,
    expectedSalary: dto.expectedSalary ?? 0,
    resumeStatus: dto.resumeStatus || '—',
    recommendation: dto.gtRecommendation || '—',
    recommendationDate: formatDate(dto.gtRecommendationDate),
    status: statusFrom(dto),
    submitted: formatDate(dto.createdAt),
    raw: dto,
  }
}

function statusFrom(dto) {
  if (dto.dateOfJoining) return 'Onboarded'
  if (dto.committeeRecommendation) return 'Committee reviewed'
  if (dto.hoRecommendation) return 'HO reviewed'
  if (dto.pmuRecommendation) return 'PMU reviewed'
  if (dto.gtRecommendation) return 'Proposed by GT'
  return 'Draft'
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
