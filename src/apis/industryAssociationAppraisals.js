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
// `CreateIndustryAssociationAppraisalRequest`. Best-effort mapping; the form
// captures a superset in some places and a subset in others.
//
// Field mapping notes:
//   dd_ia_cibil    → cibilReportReferenceNo   (form has a single text; DTO
//                                              splits ref-no / date / rank /
//                                              remarks — we send ref-no only)
//   dd_ia_darpan   → ngoDarpanNumber
//   dd_ia_nabard   → nabardBlacklisted        (form is a free-text "status";
//                                              coerced to boolean)
//   dd_ia_smart    → smartReportReferenceNo
//   dd_holder_cibil → cibilRemarks
//   dd_holder_smart → smartReportRemarks
//   dd_owner_cibil  → beneficialOwnerCibilRemarks
//   dd_owner_smart  → beneficialOwnerSmartRemarks
//   ready_*         → formalizationComments / referralArrangementComments /
//                     bseReadinessComments
//   budget_*        → budgetAllocated / utilizedAmount / availableBudget
//   terms           → termsAndConditions
//   dop             → dopDate (ISO)
//   recommendations → recommendationRemarks
//
// Fields with no form input (cibilReportDate, cibilRanking, smartReportDate,
// webSearchVerified, webSearchDocument, majorSourcesOfIncome, activitiesLastYear,
// topThreeSectors, financingScope, clusterExpertComments, recommendation,
// createdBy) are omitted / null — extend the form to capture them.
export function toCreatePayload(values = {}, registrationUuid = null) {
  return {
    registrationUuid: str(registrationUuid),

    cibilReportReferenceNo: str(values.dd_ia_cibil),
    cibilReportDate: null,
    cibilRanking: null,
    cibilRemarks: str(values.dd_holder_cibil),

    ngoDarpanNumber: str(values.dd_ia_darpan),
    nabardBlacklisted: bool(values.dd_ia_nabard),

    smartReportReferenceNo: str(values.dd_ia_smart),
    smartReportDate: null,
    smartReportRemarks: str(values.dd_holder_smart),

    webSearchVerified: null,
    webSearchDocument: null,

    beneficialOwnerCibilRemarks: str(values.dd_owner_cibil),
    beneficialOwnerSmartRemarks: str(values.dd_owner_smart),

    majorSourcesOfIncome: null,
    activitiesLastYear: null,

    formalizationComments: str(values.ready_formalization),
    referralArrangementComments: str(values.ready_referral),
    bseReadinessComments: str(values.ready_bse),

    topThreeSectors: Array.isArray(values.top_three_sectors) ? values.top_three_sectors : [],
    financingScope: null,
    projectLocation: str(values.project_location),
    clusterExpertComments: str(values.cluster_expert_comments),

    budgetAllocated: num(values.budget_allocated),
    utilizedAmount: num(values.budget_utilized),
    availableBudget: num(values.budget_available),

    termsAndConditions: str(values.terms),
    dopDate: toIsoDate(values.dop),

    recommendation: null,
    recommendationRemarks: str(values.recommendations),
  }
}

// Update payload = same shape as create for now. When backend adds fields
// only updatable post-submit (cluster expert comments, etc.), branch here.
export function toUpdatePayload(values, registrationUuid) {
  return toCreatePayload(values, registrationUuid)
}

// Reverse mapping: backend DTO → form values shape used by appraisalSchema.
// Used to prefill the L2 form when an appraisal already exists (revise flow).
export function toFormValues(dto = {}) {
  if (!dto || typeof dto !== 'object') return {}
  return {
    dd_ia_cibil: dto.cibilReportReferenceNo ?? '',
    dd_ia_darpan: dto.ngoDarpanNumber ?? '',
    dd_ia_nabard: dto.nabardBlacklisted == null
      ? ''
      : (dto.nabardBlacklisted ? 'Blacklisted' : 'Clear'),
    dd_ia_smart: dto.smartReportReferenceNo ?? '',
    dd_holder_cibil: dto.cibilRemarks ?? '',
    dd_holder_smart: dto.smartReportRemarks ?? '',
    dd_owner_cibil: dto.beneficialOwnerCibilRemarks ?? '',
    dd_owner_smart: dto.beneficialOwnerSmartRemarks ?? '',
    ready_formalization: dto.formalizationComments ?? '',
    ready_referral: dto.referralArrangementComments ?? '',
    ready_bse: dto.bseReadinessComments ?? '',
    project_location: dto.projectLocation ?? '',
    cluster_expert_comments: dto.clusterExpertComments ?? '',
    top_three_sectors: Array.isArray(dto.topThreeSectors) ? dto.topThreeSectors : [],
    budget_allocated: dto.budgetAllocated ?? '',
    budget_utilized: dto.utilizedAmount ?? '',
    budget_available: dto.availableBudget ?? '',
    terms: dto.termsAndConditions ?? '',
    dop: dto.dopDate ?? '',
    recommendations: dto.recommendationRemarks ?? '',
  }
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
