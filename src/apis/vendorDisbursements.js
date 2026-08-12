import { apiFetch } from '../api'

// Backend `bse-salary-controller`. Owns the per-BSE monthly salary
// disbursement notes (created by MPA login, reviewed by SIDBI HO).
//
// Renamed from `/vendor-disbursements` — semantically each note is now
// scoped to ONE BSE (not one vendor's whole roster). The `details[]` array
// holds per-month rows for that BSE (supports arrears / catch-up runs).
const PATH = '/bse-salary'

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

// PUT /bse-salary/{id} for reviewers (GT / HO). Sends ONLY the fields the
// reviewer changed — no re-echoing of financials, no `toPayload` round-trip.
// Assumes backend applies non-null fields to the existing entity (Spring-
// style merge-on-PUT). If backend turns out to hard-replace, financial
// fields would null out on the next GET — swap this for the full-record
// merge in `toReviewerPayload` below.
export function reviewerUpdateVendorDisbursement(id, patch, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: patch,
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
//     gstinOfAgency, reasonForNoGstin, gstinOfSdbi,
//     sanctionedAmount, disbursedTillDate,        // vendor-profile snapshot
//     natureOfPayment,                             // auto-composed
//     invoiceDate, invoiceNumber, invoiceValue,   // MPA fills
//     tdsApplicable, tdsNotApplicableReason,      // MPA fills
//     accountCode, complianceTerms,               // MPA fills
//     rows: [{ bseId, bseName, iaName, salaryMonth, workingDays,
//              grossSalary, pf, tds, deductions, additionalAmount,
//              additionalReason }],
//     salaryMonth,                                // header-level month tag
//   }
//
// New backend schema (Aug '26): `bseId` lives inside each `details[]` row,
// so a single note can carry multiple BSEs at once. No `registrationUuid`
// / top-level `bseId` anymore.
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
    detailsOfItems: str(v.detailsOfItems),
    gstAmount,
    totalAmount,

    tdsApplicable: bool(v.tdsApplicable),
    tdsNotApplicableReason: v.tdsApplicable === false ? str(v.tdsNotApplicableReason) : null,

    // Reviewer-owned fields. Passed through so PUT can set them; POST leaves
    // them at null (caller doesn't set them on create).
    recommendedDisbursementAmount: num(v.recommendedDisbursementAmount),
    accountCode: str(v.accountCode),
    complianceTerms: yesNoLabel(v.complianceTerms),

    recommendation: bool(v.recommendation),
    status: str(v.status),
    createdBy: str(v.createdBy),
    verifiedBy: str(v.verifiedBy),      // GT stamps this on verification
    approvedBy: str(v.approvedBy),      // HO stamps this on approval

    // One detail row per BSE. `bseId` identifies the BSE for POST (new
    // rows); `id` is the salary-detail row's own PK, sent on PUT so the
    // backend can match existing rows without needing bseId (which the
    // backend GET currently doesn't return — see monthlySalaryDetails
    // schema). `id` is omitted when null so POST payloads stay clean.
    details: rows.map((r) => {
      const detailId = int(r.id)
      const row = {
        bseId: str(r.bseId),
        salaryMonth: str(r.salaryMonth || v.salaryMonth),
        salaryDays: int(r.workingDays),
        paidDays: int(r.workingDays),
        additionalAmount: num(r.additionalAmount),
        additionalAmountReason: str(r.additionalReason),
        paymentToBse: netSalOf(r),
        gtAttendanceComments: str(r.gtAttendanceComments),
        gtAdditionalComments: str(r.gtAdditionalComments),
        monthlySalary: num(r.grossSalary),
      }
      if (detailId != null) row.id = detailId
      return row
    }),
  }
}

// ── Reviewer-only payload ─────────────────────────────────────────────────
// The regular `toPayload` above is fine for the creator (MPA) — it starts
// from the full form values and (re)computes every derived field. That's
// exactly what we DON'T want on a reviewer PUT: reviewers only ever change
// a handful of fields, and the GET response the frontend uses as its
// starting point is lossy (backend doesn't return `monthlySalary` /
// `bseId` on the detail rows, so recomputing `paymentToBse` from the GET'd
// row yields `additionalAmount` only → the ₹49,797 → ₹2,000 corruption bug
// we saw on the GT dialog).
//
// This adapter sends the existing DTO verbatim and overlays ONLY the fields
// each reviewer role owns:
//   patch = {
//     // Any top-level fields the reviewer wants to change:
//     verifiedBy, approvedBy, status, recommendation,
//     recommendedDisbursementAmount, complianceTerms,
//     // HO can also edit invoice — gstAmount/totalAmount will be recomputed
//     // ONLY when invoiceValue is in the patch:
//     invoiceDate, invoiceNumber, invoiceValue,
//     // Per-detail-row edits, keyed by row id (never by index — indexes
//     // aren't stable across GETs):
//     detailPatches: {
//       [id]: { gtAttendanceComments, gtAdditionalComments },
//     },
//   }
//
// Everything else on the DTO passes through untouched. `paymentToBse`,
// `disbursementSoughtIn`, per-row `monthlySalary`, `bseId`, etc. are
// preserved as the backend gave them to us.
export function toReviewerPayload(existingDto = {}, patch = {}) {
  const {
    invoiceDate, invoiceNumber, invoiceValue,
    detailPatches,
    ...topPatch
  } = patch

  // Invoice value edits (HO only) → recompute the two derived amounts. If
  // the value isn't in the patch, leave the existing DTO's values alone.
  const derived = {}
  if (invoiceValue !== undefined) {
    const v = num(invoiceValue)
    derived.invoiceValue = v
    derived.gstAmount = v != null ? +(v * 0.18).toFixed(2) : null
    derived.totalAmount = v != null ? +(v * 1.18).toFixed(2) : null
  }
  if (invoiceDate !== undefined) derived.invoiceDate = toIsoDate(invoiceDate)
  if (invoiceNumber !== undefined) derived.invoiceNumber = str(invoiceNumber)

  // Preserve the detail rows verbatim; overlay only per-row comment patches
  // matched on `id`. Backend gives us `monthlySalaryDetails`; older builds
  // used `details`. Look at both.
  const existingRows = Array.isArray(existingDto.monthlySalaryDetails)
    ? existingDto.monthlySalaryDetails
    : Array.isArray(existingDto.details)
      ? existingDto.details
      : []
  const detailPatchMap = detailPatches || {}

  const details = existingRows.map((row) => {
    const p = row.id != null ? detailPatchMap[row.id] : null
    if (!p) return row
    return { ...row, ...p }
  })

  return {
    ...existingDto,
    ...topPatch,
    ...derived,
    details,
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
