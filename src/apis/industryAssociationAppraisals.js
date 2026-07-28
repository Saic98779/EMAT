import { apiFetch } from '../api'

// Backend collection covering the Detailed Appraisal (Level 2) that GT
// completes after SIDBI SDE grants In-Principle approval on the registration.
// One appraisal per registration, keyed by the parent registrationUuid.
const PATH = '/industry-association-appraisals'

// GET /industry-association-appraisals — full list.
export function listAppraisals({ signal } = {}) {
  return apiFetch(PATH, { signal })
}

// GET /industry-association-appraisals/{uuid} — single appraisal.
export function getAppraisal(uuid, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(uuid)}`, { signal })
}

// GET /industry-association-appraisals/registration/{registrationUuid}
// The appraisal (if any) attached to a specific IA registration. Handy from
// the ProposalDetail page — call this to know whether a Level 2 draft exists.
export function getAppraisalByRegistration(registrationUuid, { signal } = {}) {
  return apiFetch(
    `${PATH}/registration/${encodeURIComponent(registrationUuid)}`,
    { signal },
  )
}

// POST /industry-association-appraisals — GT submits the detailed appraisal.
// Body is the full appraisal payload; caller is responsible for shape.
export function createAppraisal(body, { signal } = {}) {
  return apiFetch(PATH, { method: 'POST', body, signal })
}

// PUT /industry-association-appraisals/{uuid} — replace the appraisal (e.g.
// Cluster Expert adds comments, or GT revises after "changes requested").
export function updateAppraisal(uuid, body, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(uuid)}`, {
    method: 'PUT',
    body,
    signal,
  })
}

// PATCH /industry-association-appraisals/{uuid}/approve — SDE grants Final
// (Level 2) approval. Same `ApprovalRequest` shape: { isSidbeApproved }.
export function approveAppraisal(uuid, { isSidbeApproved = true } = {}, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(uuid)}/approve`, {
    method: 'PATCH',
    body: { isSidbeApproved },
    signal,
  })
}

// DELETE /industry-association-appraisals/{uuid} — soft delete.
export function deleteAppraisal(uuid, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(uuid)}`, {
    method: 'DELETE',
    signal,
  })
}

// ── Create payload adapter ─────────────────────────────────────────────────
// Frontend form values (`appraisalSchema` in formSchemas.js) → backend
// `CreateIndustryAssociationAppraisalRequest`. Every DTO column has a matching
// form field now (see appraisalSchema in formSchemas.js). Missing fields
// still get null so the request stays predictable.
//
// Top-3 sectors are collected as sector_1 / sector_2 / sector_3 text inputs
// and joined into `topThreeSectors: string[]` before send. Reverse mapping
// splits them back.
export function toCreatePayload(values = {}, registrationUuid = null) {
  const sectors = [values.sector_1, values.sector_2, values.sector_3]
    .map((s) => (s == null ? '' : String(s).trim()))
    .filter(Boolean)

  return {
    registrationUuid: str(registrationUuid),

    // Section 7 — Comments on Due Diligence (IA)
    cibilReportReferenceNo: str(values.cibil_ref_no),
    cibilReportDate: toIsoDate(values.cibil_date),
    cibilRanking: str(values.cibil_ranking),
    cibilRemarks: str(values.cibil_remarks),

    ngoDarpanNumber: str(values.ngo_darpan_no),
    nabardBlacklisted: bool(values.nabard_blacklisted),

    smartReportReferenceNo: str(values.smart_ref_no),
    smartReportDate: toIsoDate(values.smart_date),
    smartReportRemarks: str(values.smart_remarks),

    webSearchVerified: bool(values.web_search_verified),
    webSearchDocument: firstFileName(values.web_search_document),

    // Beneficial owner
    beneficialOwnerCibilRemarks: str(values.owner_cibil_remarks),
    beneficialOwnerSmartRemarks: str(values.owner_smart_remarks),

    // Section 10 — Existing Infra (extras beyond IA-mirrored fields)
    majorSourcesOfIncome: str(values.major_sources_of_income),
    activitiesLastYear: str(values.activities_last_year),

    // Section 11 — DIA Specific
    formalizationComments: str(values.ready_formalization),
    referralArrangementComments: str(values.ready_referral),
    bseReadinessComments: str(values.ready_bse),

    topThreeSectors: sectors,
    financingScope: str(values.financing_scope),
    projectLocation: str(values.project_location),

    // Section 12 — Cluster Expert
    clusterExpertComments: str(values.cluster_expert_comments),

    // Section 14 — Budget (availableBudget is derived; also sent so backend
    // has an explicit value if it stores rather than recomputes).
    budgetAllocated: num(values.budget_allocated),
    utilizedAmount: num(values.budget_utilized),
    availableBudget: computeAvailable(values),

    // Section 13 — Terms
    termsAndConditions: str(values.terms),
    // Section 15 — Delegation of Power
    dopDate: toIsoDate(values.dop_date),

    // Section 16 — Recommendation
    recommendation: str(values.recommendation),
    recommendationRemarks: str(values.recommendation_remarks),
  }
}

// Update payload = same shape as create.
export function toUpdatePayload(values, registrationUuid) {
  return toCreatePayload(values, registrationUuid)
}

// Reverse mapping: backend DTO → form values shape used by appraisalSchema.
// Used to prefill the L2 form when an appraisal already exists (revise flow).
export function toFormValues(dto = {}) {
  if (!dto || typeof dto !== 'object') return {}
  const sectors = Array.isArray(dto.topThreeSectors) ? dto.topThreeSectors : []
  return {
    // Section 7
    cibil_ref_no: dto.cibilReportReferenceNo ?? '',
    cibil_date: (dto.cibilReportDate ?? '').slice(0, 10),
    cibil_ranking: dto.cibilRanking ?? '',
    cibil_remarks: dto.cibilRemarks ?? '',

    ngo_darpan_no: dto.ngoDarpanNumber ?? '',
    nabard_blacklisted: dto.nabardBlacklisted == null ? '' : (dto.nabardBlacklisted ? 'yes' : 'no'),

    smart_ref_no: dto.smartReportReferenceNo ?? '',
    smart_date: (dto.smartReportDate ?? '').slice(0, 10),
    smart_remarks: dto.smartReportRemarks ?? '',

    web_search_verified: dto.webSearchVerified == null ? '' : (dto.webSearchVerified ? 'yes' : 'no'),
    // web_search_document is a File-typed input; the DTO carries a filename
    // string. We leave the picker empty on load — user can re-attach if they
    // need to replace it. Existing file remains referenced by the DTO field.

    owner_cibil_remarks: dto.beneficialOwnerCibilRemarks ?? '',
    owner_smart_remarks: dto.beneficialOwnerSmartRemarks ?? '',

    // Section 10 extras
    major_sources_of_income: dto.majorSourcesOfIncome ?? '',
    activities_last_year: dto.activitiesLastYear ?? '',

    // Section 11
    ready_formalization: dto.formalizationComments ?? '',
    ready_referral: dto.referralArrangementComments ?? '',
    ready_bse: dto.bseReadinessComments ?? '',
    sector_1: sectors[0] ?? '',
    sector_2: sectors[1] ?? '',
    sector_3: sectors[2] ?? '',
    financing_scope: dto.financingScope ?? '',
    project_location: dto.projectLocation ?? '',

    // Section 12
    cluster_expert_comments: dto.clusterExpertComments ?? '',

    // Section 13, 14, 15
    terms: dto.termsAndConditions ?? '',
    budget_allocated: dto.budgetAllocated ?? '',
    budget_utilized: dto.utilizedAmount ?? '',
    // budget_available is a computed field; nothing to seed.
    dop_date: (dto.dopDate ?? '').slice(0, 10),

    // Section 16
    recommendation: dto.recommendation ?? '',
    recommendation_remarks: dto.recommendationRemarks ?? '',
  }
}

// Small helpers used by the adapter.
function firstFileName(v) {
  if (!Array.isArray(v) || v.length === 0) return null
  const f = v[0]
  return typeof f === 'string' ? f : (f && f.name) || null
}
function computeAvailable(v) {
  const a = Number(v?.budget_allocated)
  const u = Number(v?.budget_utilized)
  if (!Number.isFinite(a) && !Number.isFinite(u)) return null
  return (Number.isFinite(a) ? a : 0) - (Number.isFinite(u) ? u : 0)
}

// ── Coercion helpers ──────────────────────────────────────────────────────
const str = (v) => (v == null || v === '' ? null : String(v))
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
    if (s === 'yes' || s === 'true' || s === 'blacklisted') return true
    if (s === 'no' || s === 'false' || s === 'clear') return false
  }
  return null
}
function toIsoDate(v) {
  if (!v) return null
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const dmy = s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

// ── Adapter ────────────────────────────────────────────────────────────────
// Maps a backend appraisal record to the shape used by the SDE queue / detail
// pages. Field names below follow the same convention as the registration DTO
// (isSidbeApproved / sidbeApprovedByUsername / createdAt / updatedAt) —
// adjust once we see the exact appraisal DTO from the backend.
export function fromDto(dto = {}) {
  const approved = dto.isSidbeApproved === true
  return {
    id: dto.uuid,
    uuid: dto.uuid,
    registrationUuid: dto.registrationUuid || null,
    iaName: dto.industryAssociationName || dto.registrationUuid || '—',
    approved,
    status: approved ? 'Final approved (L2)' : 'Detailed · Awaiting L2',
    approvedBy: dto.sidbeApprovedByUsername || null,
    submitted: formatDate(dto.createdAt),
    updated: formatDate(dto.updatedAt),
    raw: dto,
  }
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
