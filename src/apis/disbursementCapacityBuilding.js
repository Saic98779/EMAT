import { apiFetch } from '../api'

// Backend `disbursement-note-capacity-building-ia-controller`. Owns per-IA
// "Capacity Building of IA members" disbursement notes: BSE raises the
// request → GT Field Manager records comments on the event and its impact
// (via PUT) → SIDBI SDE records amount recommended + recommendation (also
// via PUT).
//
// Sibling endpoint `/disbursement-note-capacity-building-ia-officials` carries
// the same format for agency-run events (keyed on an event management agency
// rather than the IA itself) and is NOT handled here.
//
// Field names below mirror the backend DTO exactly — no renaming — so the
// pages can read raw list rows and form values with one vocabulary.
const PATH = '/disbursement-note-capacity-building-ia'

// Frontend-enforced constants — fixed for every note, never user-entered.
export const SIDBI_GSTIN = '09AABCS3480N5ZS'
export const DEFAULT_ACCOUNT_CODE = 'EX1909010'

// `recommendation` is a free-text column on the backend; these are the only
// two values the UI writes.
export const RECOMMENDED = 'Recommended'
export const NOT_RECOMMENDED = 'Not Recommended'

// GET /disbursement-note-capacity-building-ia → all notes.
export function listDisbursementCapacityBuilding({ signal } = {}) {
  return apiFetch(PATH, { signal })
}

// GET /disbursement-note-capacity-building-ia/{id}
export function getDisbursementCapacityBuilding(id, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}`, { signal })
}

// GET /disbursement-note-capacity-building-ia/registration/{registrationId}
// → all notes raised against a specific IA. Drives the BSE form's autofills.
export function listDisbursementCapacityBuildingByRegistration(registrationId, { signal } = {}) {
  return apiFetch(
    `${PATH}/registration/${encodeURIComponent(registrationId)}`,
    { signal },
  )
}

// POST /disbursement-note-capacity-building-ia — feeds `BseCapacityBuilding.jsx`.
export function createDisbursementCapacityBuilding(values, { signal } = {}) {
  return apiFetch(PATH, { method: 'POST', body: toPayload(values), signal })
}

// PUT /disbursement-note-capacity-building-ia/{id} — used by GT (event
// comments) and SDE (amendments + amount + recommendation). Full-record
// replacement, so callers spread the existing record before their own edits.
export function updateDisbursementCapacityBuilding(id, values, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: toPayload(values),
    signal,
  })
}

// DELETE /disbursement-note-capacity-building-ia/{id}
export function deleteDisbursementCapacityBuilding(id, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    signal,
  })
}

// ── Payload adapter ────────────────────────────────────────────────────────
// Frontend values → `CreateDisbursementNoteCapacityBuildingIaRequest`
// (the update request carries the same fields).
//
// Fields owned by each role, by row on the note format:
//   BSE  →  1-6, 7 (nature of payment), 8 (invoice), 9 (TDS), 13 (compliance)
//   GT   →  12 (gtCommentsOnEventOutcomeImpact)
//   SDE  →  10 (amountRecommendedForDisbursement), 11 (accountCodeForPayment),
//           14 (recommendation) — plus the right to amend the BSE rows the
//           format marks "modifiable at SDE level": 7, 8 and 13.
//
// GT/SDE fields are sent as null on create and populated later via PUT.
// `toPayload` accepts a merged object (existing DTO + edits) so all three
// roles share the same adapter.
export function toPayload(v = {}) {
  const value = num(v.valueOfServiceItemsSupplied)
  const igst = value != null ? +(value * 0.18).toFixed(2) : num(v.igstAt18Percent)
  const total = value != null ? +(value * 1.18).toFixed(2) : num(v.totalAmount)

  return {
    registrationId: int(v.registrationId),
    industryAssociationName: str(v.industryAssociationName),

    // ── GSTIN ─────────────────────────────────────────────────────────────
    // There's no "not applicable" boolean on the backend — a non-empty
    // reason IS the flag.
    gstinOfIa: str(v.gstinOfIa),
    gstinNotApplicableReason: str(v.gstinNotApplicableReason),
    gstinOfSidbi: str(v.gstinOfSidbi) || SIDBI_GSTIN,

    // ── Grant / disbursement running totals ───────────────────────────────
    sanctionedAmount: num(v.sanctionedAmount),
    disbursedTillDate: num(v.disbursedTillDate),
    disbursementSought: total != null ? total : num(v.disbursementSought),

    // ── Nature of payment (narrative) ─────────────────────────────────────
    natureOfPayment: str(v.natureOfPayment),

    // ── Invoice ───────────────────────────────────────────────────────────
    invoiceDate: toIsoDate(v.invoiceDate),
    invoiceNumber: str(v.invoiceNumber),
    valueOfServiceItemsSupplied: value,
    igstAt18Percent: igst,
    totalAmount: total,

    // ── TDS ───────────────────────────────────────────────────────────────
    tdsApplicable: bool(v.tdsApplicable),
    tdsNotApplicableReason:
      v.tdsApplicable === false ? str(v.tdsNotApplicableReason) : null,

    // ── BSE-owned compliance ──────────────────────────────────────────────
    compliancePreDisbursementTerms: str(v.compliancePreDisbursementTerms),

    // ── GT-owned (null on create) ─────────────────────────────────────────
    gtCommentsOnEventOutcomeImpact: str(v.gtCommentsOnEventOutcomeImpact),

    // ── SDE-owned (null on create) ────────────────────────────────────────
    amountRecommendedForDisbursement: num(v.amountRecommendedForDisbursement),
    accountCodeForPayment: str(v.accountCodeForPayment) || DEFAULT_ACCOUNT_CODE,
    recommendation: str(v.recommendation),
  }
}

// Backend DTO → form values. Used by the GT + SDE review screens to prefill
// their drafts with what BSE (and any prior reviewer) submitted.
export function toFormValues(dto = {}) {
  return {
    id: dto.id,
    registrationId: dto.registrationId ?? '',
    industryAssociationName: dto.industryAssociationName ?? dto.registrationName ?? '',
    gstinOfIa: dto.gstinOfIa ?? '',
    gstinNotApplicableReason: dto.gstinNotApplicableReason ?? '',
    gstinOfSidbi: dto.gstinOfSidbi ?? SIDBI_GSTIN,
    sanctionedAmount: dto.sanctionedAmount ?? '',
    disbursedTillDate: dto.disbursedTillDate ?? '',
    disbursementSought: dto.disbursementSought ?? '',
    natureOfPayment: dto.natureOfPayment ?? '',
    invoiceDate: dto.invoiceDate ?? '',
    invoiceNumber: dto.invoiceNumber ?? '',
    valueOfServiceItemsSupplied: dto.valueOfServiceItemsSupplied ?? '',
    igstAt18Percent: dto.igstAt18Percent ?? '',
    totalAmount: dto.totalAmount ?? '',
    tdsApplicable: dto.tdsApplicable,
    tdsNotApplicableReason: dto.tdsNotApplicableReason ?? '',
    compliancePreDisbursementTerms: dto.compliancePreDisbursementTerms ?? '',
    gtCommentsOnEventOutcomeImpact: dto.gtCommentsOnEventOutcomeImpact ?? '',
    amountRecommendedForDisbursement: dto.amountRecommendedForDisbursement ?? '',
    accountCodeForPayment: dto.accountCodeForPayment ?? DEFAULT_ACCOUNT_CODE,
    recommendation: dto.recommendation ?? '',
  }
}

// Lifecycle stage derived from the mutable review columns, since the backend
// doesn't expose a status enum for these notes.
//   • BSE Submitted    — no GT comments, no SDE recommendation
//   • GT Commented     — GT comments present, SDE recommendation missing
//   • Recommended / Not Recommended — SDE has decided
export function stageOf(dto = {}) {
  const rec = String(dto.recommendation || '').trim().toLowerCase()
  if (rec === RECOMMENDED.toLowerCase()) return RECOMMENDED
  if (rec) return NOT_RECOMMENDED
  if (dto.gtCommentsOnEventOutcomeImpact) return 'GT Commented'
  return 'BSE Submitted'
}

// ── Coercion helpers ──────────────────────────────────────────────────────
const str = (v) => (v == null || v === '' ? null : String(v).trim() || null)
const num = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
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
