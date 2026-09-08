import { apiFetch } from '../api'

// Backend collection covering In-Principle Approval registrations.
const PATH = '/industry-association-registrations'

export function listIndustryAssociations({ signal } = {}) {
  return apiFetch(PATH, { signal })
}

export function getIndustryAssociation(id, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}`, { signal })
}

// POST create — feeds `InPrincipleApproval.jsx`. Caller is expected to pass
// the raw form values; toPayload() shapes them for the backend contract.
export function createIndustryAssociation(values, { signal } = {}) {
  return apiFetch(PATH, { method: 'POST', body: toPayload(values), signal })
}

// PUT update — full-record replacement. Extends the create payload with
// `isActive` and `updatedBy` (the two extra fields on the Update DTO).
export function updateIndustryAssociation(id, values, extra = {}, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: toUpdatePayload(values, extra),
    signal,
  })
}

// Reviewer decision — SDE (or any reviewer) records their outcome on the
// IA at a specific sub-stage.
//
// Backend note (verified 2026-09-08): the dedicated PATCH `/approve`
// endpoint sets the sidbeApproved flag but *ignores* `stageId` — it does
// not advance `currentStage` and writes no stage-history row. The main
// PUT `/{id}` endpoint, when sent `{ isSidbeApproved, stageId,
// stageComments }` (and nothing else), does everything atomically:
//   • records isSidbeApproved
//   • advances currentStage to the sub-stage identified by stageId
//   • appends a stage-history row with the comments (comments required
//     for reject / revert per backend contract; frontend gates that)
//   • preserves every other field on the record (merge, not replace)
// So we PUT here — that keeps a single, reliable code path for every
// reviewer action across the workflow.
export function approveIndustryAssociation(
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

// DELETE (soft) — marks the record inactive but preserves the row.
export function deleteIndustryAssociation(id, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    signal,
  })
}

// DELETE /permanent — irrecoverable removal. Guard behind an explicit confirm.
export function permanentlyDeleteIndustryAssociation(id, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}/permanent`, {
    method: 'DELETE',
    signal,
  })
}

// ── Payload adapter ─────────────────────────────────────────────────────────
// Frontend form values → backend `CreateIndustryAssociationRegistrationRequest`.
// - Coerces yes/no & Yes/No strings to booleans
// - Emits ISO-8601 date for `incorporationDate`
// - File-typed fields are sent as `null` for now (no upload endpoint yet;
//   flip to `firstFileName(...)` or a real URL once uploads are wired)
// - Drops frontend-only fields with no backend column
// - Drops server-controlled fields (`isSidbeApproved`, `sidbeApprovedByUserId`,
//   `createdBy`) so we never overwrite them from the client
export function toPayload(v = {}) {
  return {
    state: str(v.state),
    industryAssociationName: str(v.ia_name),
    // Org-level identifiers on the IA record (backend added Aug '26).
    email: str(v.email),
    panNo: str(v.pan_no),
    constitutionType: str(v.constitution_type),
    constitutionOther: v.constitution_type === 'Other' ? str(v.constitution_other) : null,
    incorporationDate: toIsoDate(v.incorporation_date),
    incorporationCertificate: null,
    iaType: str(v.ia_profit_type),
    constitutionProof: null,
    district: str(v.district),
    pincode: str(v.pincode),
    apexHolderName: str(v.apex_name),
    apexHolderDesignation: str(v.apex_designation),
    apexHolderMobile: str(v.apex_contact),
    apexHolderEmail: str(v.apex_email),
    addressProofType: str(v.apex_kyc_doc),
    addressProof: str(v.apex_kyc_number),
    idProofType: str(v.apex_id_proof),
    idProof: str(v.apex_id_number),
    nodalName: str(v.nodal_name),
    nodalDesignation: str(v.nodal_designation),
    nodalMobile: str(v.nodal_contact),
    nodalEmail: str(v.nodal_email),
    sidbiBranch: str(v.sidbi_branch),
    mappedWithCluster: bool(v.cluster_mapped),
    clusterName: v.cluster_mapped === 'yes' ? str(v.cluster_which) : null,
    mappedWithImportantDistrict: bool(v.district_mapped),
    districtMsmeCount: int(v.msme_count),
    activeMembersAbove200: bool(v.members_gt200),
    activeMembersCount: int(v.active_members),
    justification: str(v.members_justification),
    approvalLetter: null,
    msmeCountWithoutTraders: int(v.msme_count),
    memberDirectoryAvailable: bool(v.member_directory),
    buildingType: str(v.building),
    declarationSigned: bool(v.declaration_signed),
    electricityBill: null,
    telephoneBill: null,
    itInfrastructureAvailable: bool(v.it_infra),
    infrastructureType: v.it_infra === 'yes'
      ? (Array.isArray(v.it_infra_details) ? (v.it_infra_details.length ? v.it_infra_details.join(', ') : null) : str(v.it_infra_details))
      : null,
    secretariatStaffAvailable: bool(v.secretariat_staff),
    websiteAvailable: bool(v.website),
    websiteUrl: v.website === 'yes' ? str(v.website_url) : null,
    paidServicesAvailable: bool(v.paid_services),
    // Sent speculatively — backend may or may not have a column yet. Jackson
    // ignores unknown keys, so it's safe to include either way. If the POST
    // response echoes this back, backend already supports it.
    paidServicesDetails: v.paid_services === 'yes' ? str(v.paid_services_details) : null,
    // Same story for the secretariat staff grid. Sending as an array of
    // { name, contact, email } — filter out empty rows so we don't ship
    // half-blank entries.
    secretariatStaff: v.secretariat_staff === 'yes' && Array.isArray(v.secretariat_list)
      ? v.secretariat_list
          .map((row) => ({
            name: str(row?.name),
            contact: str(row?.contact),
            email: str(row?.email),
          }))
          .filter((r) => r.name || r.contact || r.email)
      : [],
    adverseRemarksAvailable: bool(v.adverse_remarks),
    adverseRemarks: v.adverse_remarks === 'yes' ? str(v.adverse_details) : null,
    webReport: null,
    selectionCriteria: Array.isArray(v.basis_of_selection) ? v.basis_of_selection : [],
    willingnessComments: str(v.willingness_comments),
    workedWithSidbiBefore: bool(v.worked_before),
    grantProposed: num(v.grant_proposed),
    grantDetails: str(v.grant_details),
    envisagedOutput: str(v.envisaged_output),
    envisagedOutcome: str(v.envisaged_outcome),
    envisagedImpact: str(v.envisaged_impact),
    sde: str(v.select_sde),
    // Workflow stamp — tells the backend which sub-stage this write puts
    // the IA into so it can append a stage-history row. Resolved by the
    // caller from `useAllStages()` + `stageIdForStage(...)`. Both fields
    // are optional; omitted keys leave the backend's default behaviour
    // (no history row) untouched.
    ...(v.stageId != null ? { stageId: v.stageId } : null),
    ...(v.stageComments ? { stageComments: String(v.stageComments) } : null),
  }
}

// Update DTO = Create DTO + `isActive` (soft-delete flag) + `updatedBy`
// (username of the actor). Pass those on `extra`; anything missing is left
// out so the backend keeps its current value.
export function toUpdatePayload(v = {}, extra = {}) {
  const payload = toPayload(v)
  // Backend PUT /industry-association-registrations/{id} throws a 500 the
  // moment `secretariatStaff` is present in the body — empty array, null,
  // AND a populated array all crash the handler. POST works fine, only PUT
  // is broken. Omitting the key lets the backend keep whatever it already
  // has for that record. Restore this once the backend is patched.
  delete payload.secretariatStaff
  if (extra.isActive != null) payload.isActive = !!extra.isActive
  if (extra.updatedBy != null) payload.updatedBy = str(extra.updatedBy)
  return payload
}

// Reverse mapping: backend DTO → form values shape used by makeInPrincipleSchema.
// Used by SDE edit mode to prefill the form with the current record. File
// fields are omitted — file objects live in state only until the parent record
// is created; on edit they can be re-uploaded via DocUpload.
export function toFormValues(dto = {}) {
  const yn = (b) => (b === true ? 'yes' : b === false ? 'no' : '')
  const YN = (b) => (b === true ? 'Yes' : b === false ? 'No' : '')
  const num = (n) => (n == null ? '' : String(n))
  return {
    state: dto.state ?? '',
    ia_name: dto.industryAssociationName ?? '',
    email: dto.email ?? '',
    pan_no: dto.panNo ?? '',
    constitution_type: dto.constitutionType ?? '',
    constitution_other: dto.constitutionOther ?? '',
    incorporation_date: (dto.incorporationDate ?? '').slice(0, 10),
    ia_profit_type: dto.iaType ?? '',
    district: dto.district ?? '',
    pincode: dto.pincode ?? '',
    apex_name: dto.apexHolderName ?? '',
    apex_designation: dto.apexHolderDesignation ?? '',
    apex_contact: dto.apexHolderMobile ?? '',
    apex_email: dto.apexHolderEmail ?? '',
    apex_kyc_doc: dto.addressProofType ?? '',
    apex_kyc_number: dto.addressProof ?? '',
    apex_id_proof: dto.idProofType ?? '',
    apex_id_number: dto.idProof ?? '',
    nodal_name: dto.nodalName ?? '',
    nodal_designation: dto.nodalDesignation ?? '',
    nodal_contact: dto.nodalMobile ?? '',
    nodal_email: dto.nodalEmail ?? '',
    sidbi_branch: dto.sidbiBranch ?? '',        // UUID; branch dropdown resolves
    cluster_mapped: yn(dto.mappedWithCluster),
    cluster_which: dto.clusterName ?? '',
    district_mapped: yn(dto.mappedWithImportantDistrict),
    msme_count: num(dto.msmeCountWithoutTraders ?? dto.districtMsmeCount),
    members_gt200: YN(dto.activeMembersAbove200),
    active_members: num(dto.activeMembersCount),
    members_justification: dto.justification ?? '',
    member_directory: yn(dto.memberDirectoryAvailable),
    building: dto.buildingType ?? '',
    declaration_signed: yn(dto.declarationSigned),
    it_infra: yn(dto.itInfrastructureAvailable),
    it_infra_details: typeof dto.infrastructureType === 'string' && dto.infrastructureType.length
      ? dto.infrastructureType.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    secretariat_staff: yn(dto.secretariatStaffAvailable),
    secretariat_list: Array.isArray(dto.secretariatStaff) ? dto.secretariatStaff : [],
    website: yn(dto.websiteAvailable),
    website_url: dto.websiteUrl ?? '',
    paid_services: yn(dto.paidServicesAvailable),
    paid_services_details: dto.paidServicesDetails ?? '',
    adverse_remarks: yn(dto.adverseRemarksAvailable),
    adverse_details: dto.adverseRemarks ?? '',
    basis_of_selection: Array.isArray(dto.selectionCriteria) ? dto.selectionCriteria : [],
    willingness_comments: dto.willingnessComments ?? '',
    worked_before: yn(dto.workedWithSidbiBefore),
    grant_proposed: num(dto.grantProposed),
    grant_details: dto.grantDetails ?? '',
    envisaged_output: dto.envisagedOutput ?? '',
    envisaged_outcome: dto.envisagedOutcome ?? '',
    envisaged_impact: dto.envisagedImpact ?? '',
    select_sde: dto.sde ?? '',                  // UUID; SDE dropdown resolves
  }
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
function toIsoDate(v) {
  if (!v) return null
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

// ── Adapter ─────────────────────────────────────────────────────────────────
// Maps a backend registration record to the internal shape used by the list
// table (IndustryAssociations.jsx), the proposal detail page, and dashboards.
// Optionally accepts the linked detailed appraisal DTO so the status can
// advance to "Final Review (L2)" or "Approved" — pass `null`/undefined for a
// registration-only view.
//
// Status vocabulary — the labels shown in StatusChip on the IA list and
// used by the row-action switch. As of Sep '26 the source of truth is
// the backend's `currentStage` string; the old flag-based derivation is
// kept as a fallback for records that predate the new column.
//
//   "Basic · In Review"                → GT is still filling the record
//   "Screened · Awaiting In-Principle" → eligibility matrix done, L1 form pending
//   "In-Principle · Awaiting SDE"      → GT submitted L1, SDE hasn't decided
//   "Rejected (L1)" | "Rejected (L2)"  → terminal rejects
//   "Changes Requested"                → sent back for revisions (any level)
//   "Detailed Pending"                 → L1 approved, appraisal not started
//   "Sustainability · Submitted"       → GT submitted sustainability matrix
//   "Action Plan · With CE"            → GT submitted action plan, CE reviewing
//   "Final Review (L2)"                → appraisal submitted, SDE reviewing
//   "L2 · With CE"                     → SDE approved L2, CE commenting
//   "L2 · With HO Maker"               → CE done, HO Maker reviewing
//   "Panel · Submitted"                → after HO, panel review
//   "Documentation"                    → workflow complete, documenting IA
//   "Approved"                         → HO Maker gave final sign-off
export function fromDto(dto, appraisal = null) {
  const eligibilityMatrixAdded = dto.isEligibleMatricsAdded === true

  const derived = statusFromCurrentStage(dto.currentStage)
    || statusFromLegacyFlags({ dto, appraisal, eligibilityMatrixAdded })
  const { status, stage } = derived
  const l1Approved = dto.currentStage
    ? isL1ApprovedSubStage(dto.currentStage)
    : dto.isSidbeApproved === true

  return {
    id: dto.id,
    name: dto.industryAssociationName || '—',
    email: dto.email || '—',
    panNo: dto.panNo || '—',
    eligibilityMatrixAdded,
    sector: '—', // Not modelled on the backend yet.
    city: dto.district || '—',
    state: dto.state || '—',
    branch: dto.sidbiBranch || '—',
    status,
    stage,
    // Backend sometimes emits `"STAGE.SUB_STAGE"` and sometimes just
    // `"SUB_STAGE"` — collapse to the bare key so downstream code doing
    // straight `===` checks (row action, workflow derivation) works
    // regardless of which shape came back.
    currentStage: stripStagePrefix(dto.currentStage) || null,
    est: yearOf(dto.incorporationDate),
    address: [dto.district, dto.pincode].filter(Boolean).join(' · ') || '—',
    apex: {
      name: dto.apexHolderName || '—',
      role: dto.apexHolderDesignation || '—',
      phone: dto.apexHolderMobile || '—',
      email: dto.apexHolderEmail || '—',
    },
    nodal: {
      name: dto.nodalName || '—',
      role: dto.nodalDesignation || '—',
      phone: dto.nodalMobile || '—',
      email: dto.nodalEmail || '—',
    },
    detailed: null,
    submitted: formatDate(dto.createdAt),
    trail: buildTrail(dto, l1Approved),
    raw: dto,
    appraisal,
  }
}

// Map from the backend `currentStage` string to the internal status label
// + numeric stage. Keys can be either a top-level stage enum (for stages
// with no sub-stages, like ELIGIBILITY_MATRIX and DOCUMENTATION_OF_IA) or
// a sub-stage enum. Anything not listed here falls through to the legacy
// flag-based derivation.
const CURRENT_STAGE_TO_STATUS = {
  ELIGIBILITY_MATRIX:                              { status: 'Screened · Awaiting In-Principle', stage: 0 },

  IN_PRINCIPLE_APPROVAL_OF_IA_SUBMITTED:           { status: 'In-Principle · Awaiting SDE',      stage: 0 },
  IN_PRINCIPLE_APPROVAL_OF_IA_SDE_APPROVAL:        { status: 'Detailed Pending',                 stage: 1 },
  IN_PRINCIPLE_APPROVAL_OF_IA_SDE_REJECTED:        { status: 'Rejected (L1)',                    stage: 0 },
  IN_PRINCIPLE_APPROVAL_OF_IA_SDE_REVERTED:        { status: 'Changes Requested',                stage: 0 },

  SUSTAINABILITY_MATRIX_SUBMITTED:                 { status: 'Sustainability · Submitted',       stage: 1 },

  ACTION_PLAN_SUBMITTED:                           { status: 'Action Plan · With CE',            stage: 1 },
  CLUSTER_EXPERT_APPROVED:                         { status: 'Detailed Pending',                 stage: 1 },
  CLUSTER_EXPERT_REVERTED:                         { status: 'Changes Requested',                stage: 1 },

  DETAILED_APPRAISAL_SUBMITTED:                    { status: 'Final Review (L2)',                stage: 1 },
  DETAILED_APPRAISAL_APPROVAL_BY_SDE:              { status: 'L2 · With CE',                     stage: 1 },
  DETAILED_APPRAISAL_REJECTED_BY_SDE:              { status: 'Rejected (L2)',                    stage: 1 },
  DETAILED_APPRAISAL_REVERTED_BY_SDE:              { status: 'Changes Requested',                stage: 1 },
  DETAILED_APPRAISAL_CE_COMMENTS_SUBMITTED:        { status: 'L2 · With HO Maker',               stage: 1 },
  DETAILED_APPRAISAL_APPROVAL_BY_HO_MAKER:         { status: 'Approved',                         stage: 2 },
  DETAILED_APPRAISAL_REJECTED_BY_HO_MAKER:         { status: 'Rejected (HO)',                    stage: 1 },
  DETAILED_APPRAISAL_REVERTED_BY_HO_MAKER:         { status: 'Changes Requested',                stage: 1 },
  DETAILED_APPRAISAL_SUBMITTED_BY_PANEL:           { status: 'Panel · Submitted',                stage: 1 },

  DOCUMENTATION_OF_IA:                             { status: 'Documentation',                    stage: 2 },
}

// Sub-stages that indicate L1 has been granted — used by the trail
// builder to decide whether to render the "L1 Approved" trail entry.
const L1_APPROVED_SUBSTAGES = new Set([
  'IN_PRINCIPLE_APPROVAL_OF_IA_SDE_APPROVAL',
  'SUSTAINABILITY_MATRIX_SUBMITTED',
  'ACTION_PLAN_SUBMITTED',
  'CLUSTER_EXPERT_APPROVED',
  'CLUSTER_EXPERT_REVERTED',
  'DETAILED_APPRAISAL_SUBMITTED',
  'DETAILED_APPRAISAL_APPROVAL_BY_SDE',
  'DETAILED_APPRAISAL_REJECTED_BY_SDE',
  'DETAILED_APPRAISAL_REVERTED_BY_SDE',
  'DETAILED_APPRAISAL_CE_COMMENTS_SUBMITTED',
  'DETAILED_APPRAISAL_APPROVAL_BY_HO_MAKER',
  'DETAILED_APPRAISAL_REJECTED_BY_HO_MAKER',
  'DETAILED_APPRAISAL_REVERTED_BY_HO_MAKER',
  'DETAILED_APPRAISAL_SUBMITTED_BY_PANEL',
  'DOCUMENTATION_OF_IA',
])

// Backend inconsistency: some endpoints emit the current stage as the
// bare sub-stage enum ("IN_PRINCIPLE_APPROVAL_OF_IA_SUBMITTED"), others
// as the dotted "STAGE.SUB_STAGE" form. Strip the leading `STAGE.` so
// both callers see the same lookup key.
function stripStagePrefix(raw) {
  if (!raw || typeof raw !== 'string') return raw
  const dot = raw.indexOf('.')
  return dot >= 0 ? raw.slice(dot + 1) : raw
}

function isL1ApprovedSubStage(currentStage) {
  return L1_APPROVED_SUBSTAGES.has(stripStagePrefix(currentStage))
}

function statusFromCurrentStage(currentStage) {
  if (!currentStage) return null
  return CURRENT_STAGE_TO_STATUS[stripStagePrefix(currentStage)] || null
}

// Fallback for records created before the backend added `currentStage` —
// derives the same status vocabulary from the legacy flag columns so old
// rows keep rendering the correct chip.
function statusFromLegacyFlags({ dto, appraisal, eligibilityMatrixAdded }) {
  const l1Approved = dto.isSidbeApproved === true
  // Only treat `false` as rejected when the SDE actually recorded a
  // rejection (audit user is stamped). Backend regressed Aug '26 to
  // default new GT records to `isSidbeApproved: false` (not `null`).
  const l1Rejected = dto.isSidbeApproved === false && dto.sidbeApprovedByUserId != null
  const hasAppraisal = !!appraisal
  const l2Approved = appraisal?.isSidbeApproved === true
  const l2Rejected = appraisal?.isSidbeApproved === false

  if (l1Rejected) return { status: 'Rejected (L1)', stage: 0 }
  if (l1Approved) {
    if (l2Rejected) return { status: 'Rejected (L2)', stage: 1 }
    if (!hasAppraisal) return { status: 'Detailed Pending', stage: 1 }
    if (!l2Approved) return { status: 'Final Review (L2)', stage: 1 }
    return { status: 'Approved', stage: 2 }
  }
  if (eligibilityMatrixAdded && !dto.apexHolderName) {
    return { status: 'Screened · Awaiting In-Principle', stage: 0 }
  }
  return { status: 'Basic · In Review', stage: 0 }
}

function buildTrail(dto, approved) {
  const trail = [{
    title: 'In-Principle submitted',
    by: dto.createdBy || '—',
    date: formatDate(dto.createdAt),
  }]
  if (approved) {
    trail.push({
      title: 'Basic approved (L1)',
      by: dto.sidbeApprovedByUsername || '—',
      date: formatDate(dto.updatedAt),
    })
  }
  return trail
}

function yearOf(iso) {
  if (!iso) return '—'
  const y = String(iso).slice(0, 4)
  return /^\d{4}$/.test(y) ? y : '—'
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
