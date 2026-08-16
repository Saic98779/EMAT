import { apiFetch } from '../api'

// Backend collection covering In-Principle Approval registrations.
const PATH = '/industry-association-registrations'

export function listIndustryAssociations({ signal } = {}) {
  return apiFetch(PATH, { signal })
}

export function getIndustryAssociation(uuid, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(uuid)}`, { signal })
}

// POST create — feeds `InPrincipleApproval.jsx`. Caller is expected to pass
// the raw form values; toPayload() shapes them for the backend contract.
export function createIndustryAssociation(values, { signal } = {}) {
  return apiFetch(PATH, { method: 'POST', body: toPayload(values), signal })
}

// PUT update — full-record replacement. Extends the create payload with
// `isActive` and `updatedBy` (the two extra fields on the Update DTO).
export function updateIndustryAssociation(uuid, values, extra = {}, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(uuid)}`, {
    method: 'PUT',
    body: toUpdatePayload(values, extra),
    signal,
  })
}

// PATCH approve — SDE flips the record to L1-approved. Backend expects an
// `ApprovalRequest`: { isSidbeApproved: boolean } — same field name as on
// the response DTO. Pass `false` to explicitly reject when the backend
// starts honouring it.
export function approveIndustryAssociation(uuid, { isSidbeApproved = true } = {}, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(uuid)}/approve`, {
    method: 'PATCH',
    body: { isSidbeApproved },
    signal,
  })
}

// DELETE (soft) — marks the record inactive but preserves the row.
export function deleteIndustryAssociation(uuid, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(uuid)}`, {
    method: 'DELETE',
    signal,
  })
}

// DELETE /permanent — irrecoverable removal. Guard behind an explicit confirm.
export function permanentlyDeleteIndustryAssociation(uuid, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(uuid)}/permanent`, {
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
  }
}

// Update DTO = Create DTO + `isActive` (soft-delete flag) + `updatedBy`
// (username of the actor). Pass those on `extra`; anything missing is left
// out so the backend keeps its current value.
export function toUpdatePayload(v = {}, extra = {}) {
  const payload = toPayload(v)
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
// Status vocabulary (used by StatusChip colour + row-action mapping):
//   "Basic · In Review"  → registration submitted, SDE hasn't approved L1
//   "Detailed Pending"   → L1 approved, detailed appraisal not yet submitted
//   "Final Review (L2)"  → detailed appraisal submitted, SDE hasn't sanctioned
//   "Approved"           → L2 sanctioned
//   "Changes Requested"  → reserved (backend flag not exposed yet)
export function fromDto(dto, appraisal = null) {
  const l1Approved = dto.isSidbeApproved === true
  // Only treat `false` as rejected when the SDE actually recorded a
  // rejection (audit user is stamped). Backend regressed Aug '26 to
  // default new GT records to `isSidbeApproved: false` (not `null`),
  // which without this guard would misclassify every fresh submission
  // as "Rejected (L1)". Once backend restores null-default (or strips
  // the field from POST), this guard becomes a no-op.
  const l1Rejected = dto.isSidbeApproved === false && dto.sidbeApprovedByUserId != null
  const hasAppraisal = !!appraisal
  const l2Approved = appraisal?.isSidbeApproved === true
  const l2Rejected = appraisal?.isSidbeApproved === false
  // Backend added Aug '26: true once the GT eligibility matrix has been
  // submitted for this IA, false while the record only carries the
  // matrix-header stub (name / PAN / email / state) and the full
  // In-Principle profile still needs to be filled.
  //
  // Naming preserved as-is (backend spelling is `isEligibleMatricsAdded`),
  // but exposed on the internal shape as `eligibilityMatrixAdded` for
  // readability. Both are available on `.raw` if you need the raw key.
  const eligibilityMatrixAdded = dto.isEligibleMatricsAdded === true

  let status, stage
  if (l1Rejected) { status = 'Rejected (L1)'; stage = 0 }
  else if (l1Approved) {
    if (l2Rejected) { status = 'Rejected (L2)'; stage = 1 }
    else if (!hasAppraisal) { status = 'Detailed Pending'; stage = 1 }
    else if (!l2Approved) { status = 'Final Review (L2)'; stage = 1 }
    else { status = 'Approved'; stage = 2 }
  }
  // Not yet L1-approved. Split into two sub-states so the GT queue can
  // separate "screened only" from "full application submitted".
  else if (eligibilityMatrixAdded && !dto.apexHolderName) {
    status = 'Screened · Awaiting In-Principle'; stage = 0
  } else {
    status = 'Basic · In Review'; stage = 0
  }

  return {
    id: dto.uuid,
    uuid: dto.uuid,
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
