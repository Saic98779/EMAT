import { apiFetch } from '../api'

// Approval status enum shared across the 10 content endpoints. Backend
// split the single `status` column into `makerStatus` + `checkerStatus`
// on 2026-09-25 — see LATEST_CHANGES_FOR_FRONTEND.md. Verified live on
// 2026-09-26:
//   • The old single `status` field is gone from every request/response.
//   • The two new fields carry the SAME enum values (APPROVED / REJECT /
//     REVERT). There is no `PENDING` value.
export const CONTENT_STATUS = {
  APPROVED: 'APPROVED',
  REJECT:   'REJECT',
  REVERT:   'REVERT',
}

// UI-derived status buckets. The backend record has two fields; the UI
// wants to talk in terms of a single lifecycle state per row. This is
// the one place we translate. Every list/detail/badge/chip reads from
// `deriveStatus(row)`, so a future workflow tweak lives here alone.
export const DERIVED_STATUS = {
  PENDING:      'PENDING',       // fresh submission, nobody has decided
  WITH_CHECKER: 'WITH_CHECKER',  // maker approved, checker hasn't acted
  APPROVED:     'APPROVED',      // checker approved
  REJECT:       'REJECT',        // rejected at maker OR checker level
  REVERT:       'REVERT',        // reverted at maker OR checker level (back to GT PMU)
}

// Two-field → one-bucket. Rules:
//   (null, null)                     → PENDING (untouched or pre-migration)
//   (maker, null)                    → WITH_CHECKER when maker approved,
//                                       otherwise the maker's decision
//                                       is final (REJECT / REVERT stop
//                                       the chain — no need to go to
//                                       checker per client 2026-09-26)
//   (null, checker)                  → defensive; treat as checker's word
//   (maker, checker)                 → checker had the final say
//                                       (checker's value wins)
//
// NOTE: today (2026-09-26) backend still requires both PATCH fields to
// be non-null, so the "(maker, null)" case doesn't yet occur from
// production data. Once backend accepts null on the counterpart, this
// helper handles it without further code changes.
export function deriveStatus(row = {}) {
  const maker   = row.makerStatus   || null
  const checker = row.checkerStatus || null
  if (!maker && !checker) return DERIVED_STATUS.PENDING
  if (checker) {
    if (checker === CONTENT_STATUS.APPROVED) return DERIVED_STATUS.APPROVED
    if (checker === CONTENT_STATUS.REJECT)   return DERIVED_STATUS.REJECT
    if (checker === CONTENT_STATUS.REVERT)   return DERIVED_STATUS.REVERT
  }
  // Only maker has decided.
  if (maker === CONTENT_STATUS.APPROVED) return DERIVED_STATUS.WITH_CHECKER
  if (maker === CONTENT_STATUS.REJECT)   return DERIVED_STATUS.REJECT
  if (maker === CONTENT_STATUS.REVERT)   return DERIVED_STATUS.REVERT
  return DERIVED_STATUS.PENDING
}

// Convenience predicates for the queue / lists.
//
// Maker's queue = rows nobody has decided (PENDING). Once Maker approves,
// they leave Maker's queue and enter Checker's.
//
// Checker's queue = rows Maker has approved but Checker hasn't (WITH_CHECKER).
// PENDING rows are deliberately NOT here — backend rejects a Checker
// approval on a null makerStatus (Checker can't sign off before Maker
// acts), so surfacing them would let Checker click Approve and hit a
// 400. Wait for Maker first.
export const isPendingForMaker   = (row) => deriveStatus(row) === DERIVED_STATUS.PENDING
export const isPendingForChecker = (row) => deriveStatus(row) === DERIVED_STATUS.WITH_CHECKER

// PATCH /<path>/{id}/status — universal helper.
//
//   path     the content endpoint slug, e.g. 'dia-3c-info-series'
//   id       record id (encrypted ENC:... coming back from the create
//            call is fine — apiFetch's middleware skips path encryption
//            on non-numeric segments so it flows through unchanged)
//   makerStatus / checkerStatus  one of the CONTENT_STATUS values above.
//                                Current backend (2026-09-26) requires
//                                BOTH to be non-null on every PATCH.
//                                Backend team is fixing this; once they
//                                do, either field may be null to signal
//                                "don't change" for that actor. Callers
//                                pass whatever they want persisted; the
//                                helper doesn't fill in defaults.
//   remarks  optional. Verified via live PATCH on 2026-09-23: backend
//            column is `remark` (singular). We accept `remarks` for
//            call-site ergonomics and translate.
export function updateContentStatus(path, id, { makerStatus, checkerStatus, remarks } = {}) {
  const body = { makerStatus, checkerStatus }
  if (remarks) body.remark = remarks
  return apiFetch(`/${path}/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body,
  })
}

// Legacy single-`status` PATCH for the two Capacity Building
// disbursement note controllers, which were explicitly NOT migrated to
// the maker/checker split. Confirmed live 2026-09-26: GET on
// `/disbursement-note-capacity-building-ia` still returns `status` +
// `remark` on the row, not the new pair. Backend team will migrate
// these separately at a later date.
export function updateLegacyContentStatus(path, id, { status, remarks } = {}) {
  const body = { status }
  if (remarks) body.remark = remarks
  return apiFetch(`/${path}/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body,
  })
}

// Content endpoint slugs the checker workspace surfaces. Mirrors
// DIA_ENDPOINTS in diaContent.js but adds the two capacity-building
// disbursement types the checker also reviews.
export const CONTENT_TYPES = {
  INFO_SERIES:      'dia-3c-info-series',
  ELEARNING:        'elearning-module-content',
  BROADCAST:        'bulk-broadcast',
  FORUM:            'discussion-forum',
  LATEST_DEV:       'latest-developments',
  POPUPS:           'pop-ups',
  SURVEY:           'surveys',
  BDSP:             'bdsp',
  PBSP:             'bds-service-providers-onboarding',
  ACTION_PLAN:      'action-plans',
  CAP_BUILDING_IA:  'disbursement-note-capacity-building-ia',
  CAP_BUILDING_OFF: 'disbursement-note-capacity-building-ia-officials',
}

// Simple pass-through list fetcher — used by the checker queue tabs.
export function listContent(path, { signal } = {}) {
  return apiFetch(`/${path}`, { signal })
}

// Single record fetcher — used by the review detail page.
export function getContent(path, id, { signal } = {}) {
  return apiFetch(`/${path}/${encodeURIComponent(id)}`, { signal })
}
