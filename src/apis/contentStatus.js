import { apiFetch } from '../api'

// Approval status enum shared across the 12 content endpoints backend
// added on 2026-09-20. Kept in one place so the checker UI and any future
// caller stays aligned when backend edits the enum.
//
// Values verified against `Update<X>StatusRequest.status` in swagger.
// Note the casing inconsistency (APPROVED past tense vs REJECT/REVERT
// imperative) — Sameer's aware, may rename later.
export const CONTENT_STATUS = {
  APPROVED: 'APPROVED',
  REJECT:   'REJECT',
  REVERT:   'REVERT',
}

// PATCH /<path>/{id}/status — universal helper.
//
//   path     the content endpoint slug, e.g. 'dia-3c-info-series'
//   id       record id (encrypted ENC:... coming back from the create
//            call is fine — apiFetch's middleware skips path encryption
//            on non-numeric segments so it flows through unchanged)
//   status   one of the CONTENT_STATUS values above
//   remarks  optional. Verified via live PATCH on 2026-09-23: backend
//            column is `remark` (singular). We accept `remarks` for
//            call-site ergonomics and translate.
export function updateContentStatus(path, id, { status, remarks } = {}) {
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
