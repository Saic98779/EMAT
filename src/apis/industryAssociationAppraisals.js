import { apiFetch } from '../api'

// Backend collection covering the Detailed Appraisal (Level 2) that GT
// completes after SIDBI SDE grants In-Principle approval on the registration.
// One appraisal per registration, keyed by the parent registrationId.
const PATH = '/industry-association-appraisals'

// GET /industry-association-appraisals — full list.
export function listAppraisals({ signal } = {}) {
  return apiFetch(PATH, { signal })
}

// GET /industry-association-appraisals/{id} — single appraisal.
export function getAppraisal(id, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}`, { signal })
}

// GET /industry-association-appraisals/registration/{registrationId}
// The appraisal (if any) attached to a specific IA registration. Handy from
// the ProposalDetail page — call this to know whether a Level 2 draft exists.
export function getAppraisalByRegistration(registrationId, { signal } = {}) {
  return apiFetch(
    `${PATH}/registration/${encodeURIComponent(registrationId)}`,
    { signal },
  )
}

// POST /industry-association-appraisals — GT submits the detailed appraisal.
// Body is the full appraisal payload; caller is responsible for shape.
export function createAppraisal(body, { signal } = {}) {
  return apiFetch(PATH, { method: 'POST', body, signal })
}

// PUT /industry-association-appraisals/{id} — replace the appraisal (e.g.
// Cluster Expert adds comments, or GT revises after "changes requested").
export function updateAppraisal(id, body, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body,
    signal,
  })
}

// Reviewer decision on the appraisal — SDE (L2), CE (comments), HO Maker.
//
// Same backend gotcha as `approveIndustryAssociation`: the dedicated
// `/approve` endpoint records the flag but ignores `stageId`. We PUT
// the main update endpoint with the three workflow keys; that both
// records the flag and advances the workflow atomically. Fields not
// present in the body are preserved (merge, not replace).
export function approveAppraisal(
  id,
  { isSidbeApproved = true, stageId = null, stageComments = null } = {},
  { signal } = {},
) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: {
      isSidbeApproved,
      ...(stageId != null ? { stageId } : null),
      ...(stageComments != null ? { stageComments } : null),
    },
    signal,
  })
}

// DELETE /industry-association-appraisals/{id} — soft delete.
export function deleteAppraisal(id, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    signal,
  })
}

// ── Create payload adapter ─────────────────────────────────────────────────
// Frontend form values (`appraisalSchema` in formSchemas.js) → backend
// `CreateIndustryAssociationAppraisalRequest` / update DTO.
//
// The appraisal DTO now mirrors most Section 5–10 fields from the parent IA
// (autofetched and modifiable in the appraisal). We send whatever the user
// has in the form — the appraisal view seeds these from IA on load, so if
// the user hasn't touched them the mirror still matches IA.
//
// Fields still without a backend column are kept in the form (per client
// direction) but not sent:
//   - financing_scope_crore (sent as extra key financingScopeCrore — backend
//     may ignore until column exists)
//   - sector_N_problems (form-only)
//   - Structured IA Office Holder CIBIL/SMART sub-fields (form-only)
//   - Structured IA Beneficial Owner CIBIL/SMART ref no / date / ranking /
//     file (form-only). Only *_remarks fields round-trip.
export function toCreatePayload(values = {}, registrationId = null) {
  // Backend field is `sectors` — array of { sector, sectorKeyProblems }.
  // We used to send { name, problems } but the backend DTO expects the
  // fully-spelled names and silently dropped ours to null (values didn't
  // persist, sectors always came back as []). Confirmed by round-tripping
  // both shapes against `/industry-association-appraisals/{id}` PUT.
  // Only include a slot when the sector name is non-empty (otherwise we'd
  // ship rows with empty names).
  const sectorPairs = [
    [values.sector_1, values.sector_1_problems],
    [values.sector_2, values.sector_2_problems],
    [values.sector_3, values.sector_3_problems],
  ]
  const sectors = []
  for (const [name, problems] of sectorPairs) {
    const nm = name == null ? '' : String(name).trim()
    if (!nm) continue
    sectors.push({
      sector: nm,
      sectorKeyProblems: problems == null ? '' : String(problems).trim(),
    })
  }

  return {
    registrationId: str(registrationId),

    // ── Section 5 — Apex Office Holder (autofetched, modifiable) ─────────
    apexHolderName: str(values.apex_name),
    apexHolderDesignation: str(values.apex_designation),
    apexHolderMobile: str(values.apex_contact),
    apexHolderEmail: str(values.apex_email),

    // ── Section 6 — Nodal Person (autofetched, modifiable) ───────────────
    nodalName: str(values.nodal_name),
    nodalDesignation: str(values.nodal_designation),
    nodalMobile: str(values.nodal_contact),
    nodalEmail: str(values.nodal_email),

    // ── Section 7 — Comments on Due Diligence (IA) ───────────────────────
    cibilReportReferenceNo: str(values.cibil_ref_no),
    cibilReportDate: toIsoDate(values.cibil_date),
    cibilRanking: str(values.cibil_ranking),
    cibilRemarks: str(values.cibil_remarks),

    ngoDarpanNumber: str(values.ngo_darpan_no),
    ngoDarpanFile: firstFileName(values.ngo_darpan_file),
    nabardBlacklisted: bool(values.nabard_blacklisted),
    nabardBlacklistFile: firstFileName(values.nabard_blacklist_file),

    smartReportAvailable: bool(values.smart_verified),
    smartReportReferenceNo: str(values.smart_ref_no),
    smartReportDate: toIsoDate(values.smart_date),
    smartReportRemarks: str(values.smart_remarks),

    webSearchVerified: bool(values.web_search_verified),
    webSearchDocument: firstFileName(values.web_search_document),

    // ── IA Office Holder — CIBIL ─────────────────────────────────────────
    // Backend stores CIBIL Score as a String (validated 300–900 on the
    // frontend). Coerce to string here so a numeric input still lands.
    holderCibilReferenceNo: str(values.holder_cibil_ref_no),
    holderCibilDate: toIsoDate(values.holder_cibil_date),
    holderCibilScore: str(values.holder_cibil_score),
    holderCibilRemarks: str(values.holder_cibil_remarks),
    holderCibilFile: firstFileName(values.holder_cibil_file),

    // ── IA Office Holder — SMART ─────────────────────────────────────────
    holderSmartAvailable: bool(values.holder_smart_verified),
    holderSmartDate: toIsoDate(values.holder_smart_date),
    holderSmartRemarks: str(values.holder_smart_remarks),

    // ── IA Beneficial Owner — CIBIL + SMART ──────────────────────────────
    // Structured sub-fields now round-trip (backend added the columns).
    // Remarks were the only field that persisted previously.
    beneficialOwnerCibilReferenceNo: str(values.owner_cibil_ref_no),
    beneficialOwnerCibilDate: toIsoDate(values.owner_cibil_date),
    beneficialOwnerCibilRanking: str(values.owner_cibil_ranking),
    beneficialOwnerCibilFile: firstFileName(values.owner_cibil_file),
    beneficialOwnerCibilRemarks: str(values.owner_cibil_remarks),

    beneficialOwnerSmartAvailable: bool(values.owner_smart_verified),
    beneficialOwnerSmartDate: toIsoDate(values.owner_smart_date),
    beneficialOwnerSmartRemarks: str(values.owner_smart_remarks),

    // ── Section 8 — SIDBI Branch (autofetched, modifiable) ───────────────
    sidbiBranch: str(values.sidbi_branch),

    // ── Section 9 — Cluster / District (autofetched, modifiable) ─────────
    mappedWithCluster: bool(values.cluster_mapped),
    clusterName: str(values.cluster_which),
    mappedWithImportantDistrict: bool(values.district_mapped),
    // Backend has both districtMsmeCount and msmeCountWithoutTraders. Form
    // has one input (msme_count); populate both until backend clarifies.
    districtMsmeCount: num(values.msme_count),
    msmeCountWithoutTraders: num(values.msme_count),

    // ── Section 10 — Existing Infra (autofetched + free-text extras) ─────
    activeMembersAbove200: bool(values.members_gt200),
    activeMembersCount: num(values.active_members),
    justification: str(values.members_justification),
    buildingType: str(values.own_building_details),
    itInfrastructureAvailable: bool(values.it_infra),
    infrastructureType: str(values.it_infra_details),
    secretariatStaffAvailable: bool(values.secretariat_staff),
    websiteAvailable: bool(values.website),
    paidServicesAvailable: bool(values.paid_services),
    paidServicesDetails: values.paid_services === 'yes' ? str(values.paid_services_details) : null,
    majorSourcesOfIncome: str(values.major_sources_of_income),
    activitiesLastYear: str(values.activities_last_year),

    // ── Section 11 — DIA Specific ─────────────────────────────────────────
    formalizationComments: str(values.ready_formalization),
    referralArrangementComments: str(values.ready_referral),
    bseReadinessComments: str(values.ready_bse),
    // Yes/No toggles sent speculatively alongside the existing *Comments
    // strings so the moment backend adds boolean columns, they land. Jackson
    // ignores unknown keys today, so this is safe either way.
    referralArrangementReady: bool(values.ready_referral_yn),
    bseReadinessReady: bool(values.ready_bse_yn),

    sectors,
    financingScope: str(values.financing_scope),
    // Separate scope-in-crore number; backend column pending, sent as extra
    // key so it lands once the column exists.
    financingScopeCrore: num(values.financing_scope_crore),
    projectLocation: str(values.project_location),

    // ── Grant + Envisaged (autofetched from IA, modifiable) ──────────────
    // Backend split the old aggregated `grantProposed` column into two:
    // `grantProposedSalary` (BSE salary allocation) and `grantProposedCapex`
    // (IA sustainability + training budget). Send both from the two new
    // form fields. Old `grantProposed` key is no longer a backend column,
    // so it's not sent — Jackson would drop it anyway.
    grantProposedSalary: num(values.grant_proposed_salary),
    grantProposedCapex: num(values.grant_proposed_capex),
    grantDetails: str(values.grant_details),
    envisagedOutput: str(values.envisaged_output),
    envisagedOutcome: str(values.envisaged_outcome),
    envisagedImpact: str(values.envisaged_impact),

    // ── Section 12 — Cluster Expert ──────────────────────────────────────
    clusterExpertComments: packClusterExpertComments(values),
    clusterExpertTermsComments: str(values.cluster_expert_terms_comments),

    // ── Section 14 — Budget (availableBudget derived; sent for safety) ───
    financialYear: toIsoDate(values.financial_year),
    budgetAllocated: num(values.budget_allocated),
    utilizedAmount: num(values.budget_utilized),
    availableBudget: computeAvailable(values),

    // ── Section 13 — Terms ────────────────────────────────────────────────
    termsAndConditions: str(values.terms),
    // ── Section 15 — Delegation of Power ─────────────────────────────────
    dopDate: toIsoDate(values.dop_date),

    // ── Section 16 — Recommendation ──────────────────────────────────────
    recommendation: str(values.recommendation),
    recommendationRemarks: str(values.recommendation_remarks),
    // ── Workflow ──────────────────────────────────────────────────────────
    // Same stageId / stageComments contract as the IA registration payload:
    // stamp the destination sub-stage so the backend advances currentStage
    // and appends a stage-history row. Optional — omitted keys leave the
    // record's workflow alone.
    ...(values.stageId != null ? { stageId: values.stageId } : null),
    ...(values.stageComments ? { stageComments: String(values.stageComments) } : null),
  }
}

// Update payload = same shape as create.
export function toUpdatePayload(values, registrationId) {
  return toCreatePayload(values, registrationId)
}

// Reverse mapping: backend DTO → form values shape used by appraisalSchema.
// Used to prefill the L2 form when an appraisal already exists (revise flow).
//
// For fields that mirror the IA registration (apex, nodal, cluster, infra,
// grant, envisaged): only include the key when the DTO actually has a
// populated value. This lets `{ ...seed, ...toFormValues(dto) }` in
// AppraisalForm work correctly — the appraisal wins when the SDE has edited
// it, but the IA seed is preserved when the appraisal hasn't touched it.
export function toFormValues(dto = {}) {
  if (!dto || typeof dto !== 'object') return {}
  // Backend field is `sectors` — array of { sector, sectorKeyProblems }.
  // Also tolerate older shapes ({name, problems} or {sectorName, keyProblems})
  // in case anyone still has legacy rows in their DB.
  const sectorEntries = Array.isArray(dto.sectors)
    ? dto.sectors.map((s) => (
        s && typeof s === 'object'
          ? [
              s.sector ?? s.name ?? s.sectorName ?? '',
              s.sectorKeyProblems ?? s.problems ?? s.keyProblems ?? '',
            ]
          : [String(s ?? ''), '']
      ))
    : Array.isArray(dto.topThreeSectors)
      ? dto.topThreeSectors.map((n) => [n, ''])
      : (dto.topThreeSectors && typeof dto.topThreeSectors === 'object'
          ? Object.entries(dto.topThreeSectors)
          : [])
  const clusterExpert = unpackClusterExpertComments(dto)

  const out = {
    // ── Section 7 — Due Diligence (IA) ────────────────────────────────
    cibil_ref_no: dto.cibilReportReferenceNo ?? '',
    cibil_date: (dto.cibilReportDate ?? '').slice(0, 10),
    cibil_ranking: dto.cibilRanking ?? '',
    cibil_remarks: dto.cibilRemarks ?? '',

    ngo_darpan_no: dto.ngoDarpanNumber ?? '',
    nabard_blacklisted: dto.nabardBlacklisted == null ? '' : (dto.nabardBlacklisted ? 'yes' : 'no'),

    smart_verified: dto.smartReportAvailable == null ? '' : (dto.smartReportAvailable ? 'yes' : 'no'),
    smart_ref_no: dto.smartReportReferenceNo ?? '',
    smart_date: (dto.smartReportDate ?? '').slice(0, 10),
    smart_remarks: dto.smartReportRemarks ?? '',

    web_search_verified: dto.webSearchVerified == null ? '' : (dto.webSearchVerified ? 'yes' : 'no'),
    // File inputs (ngo_darpan_file, nabard_blacklist_file, holder_cibil_file,
    // owner_cibil_file, web_search_document) hold a filename string on the
    // DTO. We leave the picker empty on load — the existing filename stays
    // on the DTO and displays via the file field's `help` slot.

    // ── IA Office Holder — CIBIL + SMART ─────────────────────────────────
    holder_cibil_ref_no: dto.holderCibilReferenceNo ?? '',
    holder_cibil_date: (dto.holderCibilDate ?? '').slice(0, 10),
    holder_cibil_score: dto.holderCibilScore ?? '',
    holder_cibil_remarks: dto.holderCibilRemarks ?? '',
    holder_smart_verified: dto.holderSmartAvailable == null ? '' : (dto.holderSmartAvailable ? 'yes' : 'no'),
    holder_smart_date: (dto.holderSmartDate ?? '').slice(0, 10),
    holder_smart_remarks: dto.holderSmartRemarks ?? '',

    // ── IA Beneficial Owner — CIBIL + SMART ──────────────────────────────
    owner_cibil_ref_no: dto.beneficialOwnerCibilReferenceNo ?? '',
    owner_cibil_date: (dto.beneficialOwnerCibilDate ?? '').slice(0, 10),
    owner_cibil_ranking: dto.beneficialOwnerCibilRanking ?? '',
    owner_cibil_remarks: dto.beneficialOwnerCibilRemarks ?? '',
    owner_smart_verified: dto.beneficialOwnerSmartAvailable == null ? '' : (dto.beneficialOwnerSmartAvailable ? 'yes' : 'no'),
    owner_smart_date: (dto.beneficialOwnerSmartDate ?? '').slice(0, 10),
    owner_smart_remarks: dto.beneficialOwnerSmartRemarks ?? '',

    // ── Section 10 extras ─────────────────────────────────────────────
    major_sources_of_income: dto.majorSourcesOfIncome ?? '',
    activities_last_year: dto.activitiesLastYear ?? '',

    // ── Section 11 — DIA Specific ─────────────────────────────────────
    ready_formalization: dto.formalizationComments ?? '',
    ready_referral: dto.referralArrangementComments ?? '',
    ready_referral_yn: dto.referralArrangementReady == null ? '' : (dto.referralArrangementReady ? 'yes' : 'no'),
    ready_bse: dto.bseReadinessComments ?? '',
    ready_bse_yn: dto.bseReadinessReady == null ? '' : (dto.bseReadinessReady ? 'yes' : 'no'),
    sector_1: sectorEntries[0]?.[0] ?? '',
    sector_1_problems: sectorEntries[0]?.[1] ?? '',
    sector_2: sectorEntries[1]?.[0] ?? '',
    sector_2_problems: sectorEntries[1]?.[1] ?? '',
    sector_3: sectorEntries[2]?.[0] ?? '',
    sector_3_problems: sectorEntries[2]?.[1] ?? '',
    financing_scope: dto.financingScope ?? '',
    financing_scope_crore: dto.financingScopeCrore ?? '',
    project_location: dto.projectLocation ?? '',

    // ── Section 12 — Cluster Expert ──────────────────────────────────
    cluster_expert_comments: clusterExpert.general,
    cluster_expert_terms_comments: clusterExpert.terms,

    // ── Section 13, 14, 15 ───────────────────────────────────────────
    terms: dto.termsAndConditions ?? '',
    financial_year: (dto.financialYear ?? '').slice(0, 10),
    budget_allocated: dto.budgetAllocated ?? '',
    budget_utilized: dto.utilizedAmount ?? '',
    dop_date: (dto.dopDate ?? '').slice(0, 10),

    // ── Section 16 — Recommendation ──────────────────────────────────
    recommendation: dto.recommendation ?? '',
    recommendation_remarks: dto.recommendationRemarks ?? '',
  }

  // Overlay IA-mirror fields only when the appraisal has actual data,
  // otherwise the IA seed already in the form gets clobbered by empties.
  const putStr = (k, v) => { if (v != null && v !== '') out[k] = String(v) }
  const putNum = (k, v) => { if (v != null && v !== '') out[k] = v }
  const putBool = (k, v, hi = 'yes', lo = 'no') => { if (v === true) out[k] = hi; else if (v === false) out[k] = lo }

  // Section 5 — Apex Office Holder
  putStr('apex_name', dto.apexHolderName)
  putStr('apex_designation', dto.apexHolderDesignation)
  putStr('apex_contact', dto.apexHolderMobile)
  putStr('apex_email', dto.apexHolderEmail)

  // Section 6 — Nodal Person
  putStr('nodal_name', dto.nodalName)
  putStr('nodal_designation', dto.nodalDesignation)
  putStr('nodal_contact', dto.nodalMobile)
  putStr('nodal_email', dto.nodalEmail)

  // Section 8 — SIDBI Branch
  putStr('sidbi_branch', dto.sidbiBranch)

  // Section 9 — Cluster / District
  putBool('cluster_mapped', dto.mappedWithCluster)
  putStr('cluster_which', dto.clusterName)
  putBool('district_mapped', dto.mappedWithImportantDistrict)
  putNum('msme_count', dto.msmeCountWithoutTraders ?? dto.districtMsmeCount)

  // Section 10 — Membership + Infra
  putBool('members_gt200', dto.activeMembersAbove200, 'Yes', 'No')
  putNum('active_members', dto.activeMembersCount)
  putStr('members_justification', dto.justification)
  if (dto.buildingType) {
    out.own_building = 'yes'
    out.own_building_details = String(dto.buildingType)
  }
  putBool('it_infra', dto.itInfrastructureAvailable)
  putStr('it_infra_details', dto.infrastructureType)
  putBool('secretariat_staff', dto.secretariatStaffAvailable)
  putBool('website', dto.websiteAvailable)
  putBool('paid_services', dto.paidServicesAvailable)
  putStr('paid_services_details', dto.paidServicesDetails)

  // Grant + Envisaged. Backend now stores salary/capex separately; hydrate
  // both fields. The legacy aggregated `grantProposed` is no longer sent
  // by the backend, so fall back to the sum for backward-viewing only.
  putNum('grant_proposed_salary', dto.grantProposedSalary)
  putNum('grant_proposed_capex', dto.grantProposedCapex)
  putStr('grant_details', dto.grantDetails)
  putStr('envisaged_output', dto.envisagedOutput)
  putStr('envisaged_outcome', dto.envisagedOutcome)
  putStr('envisaged_impact', dto.envisagedImpact)

  return out
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

// ── Cluster Expert comments ───────────────────────────────────────────────
// The Cluster Expert writes two things: general remarks on the proposal, and
// remarks specifically on the Terms of Assistance. The backend currently
// exposes a single `clusterExpertComments` column, so the two are packed into
// it behind a marker line and split apart on read. `clusterExpertTermsComments`
// is *also* sent so the value lands natively the moment a real column ships —
// and `unpack` prefers that field when the response carries it.
const TERMS_MARK = '\n\n--- Comments on Terms of Assistance ---\n'

function packClusterExpertComments(values) {
  const general = values.cluster_expert_comments ?? ''
  const terms = values.cluster_expert_terms_comments ?? ''
  if (!String(terms).trim()) return str(general)
  return `${general}${TERMS_MARK}${terms}`
}

export function unpackClusterExpertComments(dto) {
  const raw = dto.clusterExpertComments ?? ''
  const i = raw.indexOf(TERMS_MARK)
  const general = i === -1 ? raw : raw.slice(0, i)
  const packedTerms = i === -1 ? '' : raw.slice(i + TERMS_MARK.length)
  return {
    general,
    terms: dto.clusterExpertTermsComments ?? packedTerms,
  }
}

// ── SIDBI HO Maker decision ────────────────────────────────────────────────
// Like Cluster Expert comments, HO Maker's approve/reject-with-remarks has no
// dedicated backend column. It's packed into `recommendationRemarks` behind a
// marker so GT/SDE's own remarks on that field survive. Deliberately NOT
// touching `isSidbeApproved` — that's SDE's own Level-2 approval, and writing
// there would mean HO Maker and SDE silently overwrite each other's decision
// on the same field.
const HO_MARK = '\n\n--- SIDBI HO Maker Decision ---\n'

export function packHoDecision(baseRemarks, decision, remarks) {
  return `${baseRemarks || ''}${HO_MARK}${decision}: ${remarks}`
}

export function unpackHoDecision(dto) {
  const raw = dto?.recommendationRemarks ?? ''
  const i = raw.indexOf(HO_MARK)
  if (i === -1) return { baseRemarks: raw, decision: null, remarks: '' }
  const tail = raw.slice(i + HO_MARK.length)
  const m = tail.match(/^(Approved|Rejected):\s*([\s\S]*)$/)
  return {
    baseRemarks: raw.slice(0, i),
    decision: m ? m[1] : null,
    remarks: m ? m[2] : tail,
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
    id: dto.id,
    registrationId: dto.registrationId || null,
    iaName: dto.industryAssociationName || dto.registrationId || '—',
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
