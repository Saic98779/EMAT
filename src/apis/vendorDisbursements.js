import { apiFetch } from '../api'

// Backend `vendor-disbursement-controller`. Owns the Manpower Agency salary
// disbursement requests (created by MPA login, reviewed by SIDBI HO).
const PATH = '/vendor-disbursements'

// GET /vendor-disbursements → list of all disbursement requests.
export function listVendorDisbursements({ signal } = {}) {
  return apiFetch(PATH, { signal })
}

// GET /vendor-disbursements/{id} → single record.
export function getVendorDisbursement(id, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}`, { signal })
}

// POST /vendor-disbursements — feeds `MpaRaiseDisbursement.jsx`.
export function createVendorDisbursement(values, { signal } = {}) {
  return apiFetch(PATH, { method: 'POST', body: toPayload(values), signal })
}

// PUT /vendor-disbursements/{id} — reviewer updates (status, recommendation,
// verifiedBy, approvedBy, etc.).
export function updateVendorDisbursement(id, values, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: toPayload(values),
    signal,
  })
}

// DELETE /vendor-disbursements/{id}
export function deleteVendorDisbursement(id, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}`, { method: 'DELETE', signal })
}

// GET /vendor-disbursements/approved-industry-associations
// → [{ id, name }] — IAs eligible to raise a claim against.
export function listApprovedIndustryAssociations({ signal } = {}) {
  return apiFetch(`${PATH}/approved-industry-associations`, { signal })
}

// ── Payload adapter ────────────────────────────────────────────────────────
// Frontend values → backend `VendorDisbursementRequest`.
//
// Expected shape from the disbursement page:
//   {
//     vendorName, gstinOfAgency, reasonForNoGstin, gstinOfSdbi,
//     sanctionedAmount, disbursedTillDate,        // vendor-profile snapshot
//     natureOfPayment,                             // auto-composed
//     invoiceDate, invoiceNumber, invoiceValue,   // MPA fills
//     tdsApplicable, tdsNotApplicableReason,      // vendor-profile snapshot
//     accountCode, complianceTerms,               // MPA fills
//     rows: [{ iaId, bseId, bseName, iaName, salaryMonth,
//              workingDays, grossSalary, pf, tds, deductions,
//              additionalAmount, additionalReason }],
//     salaryMonth, resourceCount,                 // header-level
//   }
//
// HO-owned fields (`recommendedDisbursementAmount`, `recommendation`,
// `status`, `verifiedBy`, `approvedBy`) are sent as null on create — the
// review PUT populates them.
export function toPayload(v = {}) {
  const rows = Array.isArray(v.rows) ? v.rows : []

  const invoiceValue = num(v.invoiceValue)
  const gstAmount = invoiceValue != null ? +(invoiceValue * 0.18).toFixed(2) : null
  const totalAmount = invoiceValue != null ? +(invoiceValue * 1.18).toFixed(2) : null

  // Disbursement sought = sum of Net Sal across the Annexure I table.
  const disbursementSought = rows.reduce((sum, r) => sum + netSalOf(r), 0)

  return {
    manpowerAgencyName: str(v.vendorName),
    gstinOfAgency: str(v.gstinOfAgency),
    reasonForNoGstin: str(v.reasonForNoGstin),
    gstinOfSdbi: str(v.gstinOfSdbi),
    // TODO: backend typed `sanctionedAmount` as string. Keep as-is.
    sanctionedAmount: str(v.sanctionedAmount),
    // TODO: backend typed `disbursedTillDate` as date; we send null until
    // the schema/semantics get clarified (see notes in team thread).
    disbursedTillDate: null,
    // Spec: string (not number). Send the derived total as string.
    disbursementSoughtIn: disbursementSought > 0 ? String(disbursementSought) : null,
    natureOfPayment: str(v.natureOfPayment),

    invoiceDate: toIsoDate(v.invoiceDate),
    invoiceNumber: str(v.invoiceNumber),
    invoiceValue,
    gstAmount,
    totalAmount,

    tdsApplicable: bool(v.tdsApplicable),
    tdsNotApplicableReason: v.tdsApplicable === false ? str(v.tdsNotApplicableReason) : null,

    // HO Maker owns these — sent null on create.
    recommendedDisbursementAmount: null,
    accountCode: str(v.accountCode),
    complianceTerms: yesNoLabel(v.complianceTerms),

    recommendation: null,
    status: null,
    createdBy: null,
    verifiedBy: null,
    approvedBy: null,

    details: rows.map((r) => ({
      iaId: str(r.iaId),
      bseId: str(r.bseId),
      salaryMonth: str(v.salaryMonth),          // header-level month applies to every row
      salaryDays: int(r.workingDays),           // "salary days" in the backend field
      paidDays: int(r.workingDays),             // paid == worked in the spec's flow
      additionalAmount: num(r.additionalAmount),
      additionalAmountReason: str(r.additionalReason),
      paymentToBse: netSalOf(r),
      gtAttendanceComments: str(r.gtAttendanceComments),
      gtAdditionalComments: str(r.gtAdditionalComments),
    })),
  }
}

// Net Sal = Gross - PF - TDS - Deductions. Coerces missing values to 0 so
// UI-editable rows always produce a numeric total.
export function netSalOf(row = {}) {
  const gross = numOr(row.grossSalary, 0)
  const pf = numOr(row.pf, 0)
  const tds = numOr(row.tds, 0)
  const ded = numOr(row.deductions, 0)
  const add = numOr(row.additionalAmount, 0)
  return Math.max(0, +(gross - pf - tds - ded + add).toFixed(2))
}

// ── Coercion helpers ──────────────────────────────────────────────────────
const str = (v) => (v == null || v === '' ? null : String(v).trim() || null)
const num = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const numOr = (v, fallback) => {
  const n = num(v)
  return n == null ? fallback : n
}
const int = (v) => {
  const n = num(v)
  return n == null ? null : Math.trunc(n)
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
const yesNoLabel = (v) => {
  const b = bool(v)
  if (b === true) return 'Yes'
  if (b === false) return 'No'
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
