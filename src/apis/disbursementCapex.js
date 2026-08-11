import { apiFetch } from '../api'

// Backend `disbursement-capex-controller`. Owns per-IA CAPEX reimbursement
// notes: BSE raises the request → GT Field Manager records verification
// comments (via PUT) → SIDBI SDE records amount recommended + Yes/No
// recommendation (also via PUT).
const PATH = '/disbursement-capex'

// GET /disbursement-capex → all CAPEX notes.
export function listDisbursementCapex({ signal } = {}) {
  return apiFetch(PATH, { signal })
}

// GET /disbursement-capex/{uuid}
export function getDisbursementCapex(uuid, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(uuid)}`, { signal })
}

// GET /disbursement-capex/registration/{registrationUuid} → all CAPEX
// notes raised against a specific IA. Handy for the IA-detail drawer.
export function listDisbursementCapexByRegistration(registrationUuid, { signal } = {}) {
  return apiFetch(
    `${PATH}/registration/${encodeURIComponent(registrationUuid)}`,
    { signal },
  )
}

// POST /disbursement-capex — feeds `BseCapexReimbursement.jsx`.
export function createDisbursementCapex(values, { signal } = {}) {
  return apiFetch(PATH, { method: 'POST', body: toPayload(values), signal })
}

// PUT /disbursement-capex/{uuid} — used by GT (comments) and SDE (amount +
// recommendation) reviews. Full-record replacement per backend contract.
export function updateDisbursementCapex(uuid, values, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(uuid)}`, {
    method: 'PUT',
    body: toPayload(values),
    signal,
  })
}

// DELETE /disbursement-capex/{uuid}
export function deleteDisbursementCapex(uuid, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(uuid)}`, {
    method: 'DELETE',
    signal,
  })
}

// ── Payload adapter ────────────────────────────────────────────────────────
// Frontend values → backend `DisbursementCapexRequest`.
//
// Fields owned by each role:
//   BSE  →  registrationUuid, gstinIa, gstinNotApplicable(+Reason),
//           gstinSidbi, sanctionedAmount, disbursedTillDate,
//           disbursementSought, invoiceDate, invoiceNumber, detailsOfItems,
//           valueOfServiceItems, igstAmount, totalAmount, tdsApplicable(+
//           Reason), preDisbursementCompliance
//   GT   →  gtCapexVerificationComments
//   SDE  →  amountRecommendedForDisbursement, accountCode, recommendation
//
// GT/SDE fields are sent as null on create and populated later via the PUT
// review. `toPayload` accepts a merged object (initial DTO + user edits)
// so all three roles can share the same adapter.
export function toPayload(v = {}) {
  const value = num(v.valueOfServiceItems)
  const igst = value != null ? +(value * 0.18).toFixed(2) : num(v.igstAmount)
  const total = value != null ? +(value * 1.18).toFixed(2) : num(v.totalAmount)

  return {
    registrationUuid: str(v.registrationUuid),

    // ── IA identity + GSTIN ───────────────────────────────────────────────
    gstinIa: str(v.gstinIa),
    gstinNotApplicable: bool(v.gstinNotApplicable),
    gstinNotApplicableReason:
      v.gstinNotApplicable === true ? str(v.gstinNotApplicableReason) : null,
    gstinSidbi: str(v.gstinSidbi) || '09AABCS3480N5ZS',

    // ── Grant / disbursement running totals ───────────────────────────────
    sanctionedAmount: num(v.sanctionedAmount),
    disbursedTillDate: num(v.disbursedTillDate),
    disbursementSought: total != null ? total : num(v.disbursementSought),

    // ── Invoice ───────────────────────────────────────────────────────────
    invoiceDate: toIsoDate(v.invoiceDate),
    invoiceNumber: str(v.invoiceNumber),
    detailsOfItems: str(v.detailsOfItems),
    valueOfServiceItems: value,
    igstAmount: igst,
    totalAmount: total,

    // ── TDS ───────────────────────────────────────────────────────────────
    tdsApplicable: bool(v.tdsApplicable),
    tdsNotApplicableReason:
      v.tdsApplicable === false ? str(v.tdsNotApplicableReason) : null,

    // ── BSE-owned compliance ──────────────────────────────────────────────
    preDisbursementCompliance: str(v.preDisbursementCompliance),

    // ── GT-owned (null on create) ─────────────────────────────────────────
    gtCapexVerificationComments: str(v.gtCapexVerificationComments),

    // ── SDE-owned (null on create) ────────────────────────────────────────
    amountRecommendedForDisbursement: num(v.amountRecommendedForDisbursement),
    accountCode: str(v.accountCode) || 'EX1909010',
    recommendation: bool(v.recommendation),
  }
}

// Backend DTO → form values. Used by the GT + SDE review screens to prefill
// their drafts with what BSE (and any prior reviewer) submitted.
export function toFormValues(dto = {}) {
  return {
    uuid: dto.uuid,
    registrationUuid: dto.registrationUuid ?? '',
    industryAssociationName: dto.industryAssociationName ?? '',
    gstinIa: dto.gstinIa ?? '',
    gstinNotApplicable: dto.gstinNotApplicable ?? false,
    gstinNotApplicableReason: dto.gstinNotApplicableReason ?? '',
    gstinSidbi: dto.gstinSidbi ?? '09AABCS3480N5ZS',
    sanctionedAmount: dto.sanctionedAmount ?? '',
    disbursedTillDate: dto.disbursedTillDate ?? '',
    disbursementSought: dto.disbursementSought ?? '',
    invoiceDate: dto.invoiceDate ?? '',
    invoiceNumber: dto.invoiceNumber ?? '',
    detailsOfItems: dto.detailsOfItems ?? '',
    valueOfServiceItems: dto.valueOfServiceItems ?? '',
    igstAmount: dto.igstAmount ?? '',
    totalAmount: dto.totalAmount ?? '',
    tdsApplicable: dto.tdsApplicable,
    tdsNotApplicableReason: dto.tdsNotApplicableReason ?? '',
    preDisbursementCompliance: dto.preDisbursementCompliance ?? '',
    gtCapexVerificationComments: dto.gtCapexVerificationComments ?? '',
    amountRecommendedForDisbursement: dto.amountRecommendedForDisbursement ?? '',
    accountCode: dto.accountCode ?? 'EX1909010',
    recommendation: dto.recommendation,
  }
}

// Deriving lifecycle stage from the mutable review columns since the backend
// doesn't expose a status enum.
//   • BSE Submitted    — no GT comments, no SDE recommendation
//   • GT Verified      — GT comments present, SDE recommendation missing
//   • Recommended      — SDE recommendation === true
//   • Not Recommended  — SDE recommendation === false
export function stageOf(dto = {}) {
  if (dto.recommendation === true) return 'Recommended'
  if (dto.recommendation === false) return 'Not Recommended'
  if (dto.gtCapexVerificationComments) return 'GT Verified'
  return 'BSE Submitted'
}

// ── Coercion helpers ──────────────────────────────────────────────────────
const str = (v) => (v == null || v === '' ? null : String(v).trim() || null)
const num = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const bool = (v) => {
  if (v === true || v === false) return v
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (s === 'yes' || s === 'true') return true
    if (s === 'no' || s === 'false') return false
  }
  return null
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
