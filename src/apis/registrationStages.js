import { apiFetch } from '../api'

// Backend `industry-association-registrations` — the stage / sub-stage
// workflow layer. Introduced Sep '26 alongside the workflow redesign.
//
// Concepts
//   • A **stage** is one of six top-level workflow buckets on an IA:
//     ELIGIBILITY_MATRIX, IN_PRINCIPLE_APPROVAL_OF_IA, SUSTAINABILITY_MATRIX,
//     ACTION_PLAN, DETAILED_APPRAISAL, DOCUMENTATION_OF_IA.
//   • A **sub-stage** is a discrete transition within a stage (e.g.
//     `IN_PRINCIPLE_APPROVAL_OF_IA_SUBMITTED`). Backend stores every
//     transition as an audit row keyed by the sub-stage's numeric id.
//   • The **current position** of an IA is `currentStage` on the DTO
//     — a single string identifying the *last completed* sub-stage.
//
// This module is the read side (list of stages + history). Writes (which
// happen through `PATCH …/approve` with `stageId`) live in
// `industryAssociations.js` so the approve flow stays in one file.
const PATH = '/industry-association-registrations'

// ── Stage enum ─────────────────────────────────────────────────────────
// Matches the backend `stage` column verbatim. Exported so callers can
// switch on stage without magic strings.
export const STAGE = Object.freeze({
  ELIGIBILITY_MATRIX:          'ELIGIBILITY_MATRIX',
  IN_PRINCIPLE_APPROVAL_OF_IA: 'IN_PRINCIPLE_APPROVAL_OF_IA',
  SUSTAINABILITY_MATRIX:       'SUSTAINABILITY_MATRIX',
  ACTION_PLAN:                 'ACTION_PLAN',
  DETAILED_APPRAISAL:          'DETAILED_APPRAISAL',
  DOCUMENTATION_OF_IA:         'DOCUMENTATION_OF_IA',
})

// Order the six stages should render in (top-level workflow order).
// Kept as data rather than derived at call time — the backend `/stages`
// list isn't sorted by workflow position.
export const STAGE_ORDER = Object.freeze([
  STAGE.ELIGIBILITY_MATRIX,
  STAGE.IN_PRINCIPLE_APPROVAL_OF_IA,
  STAGE.SUSTAINABILITY_MATRIX,
  STAGE.ACTION_PLAN,
  STAGE.DETAILED_APPRAISAL,
  STAGE.DOCUMENTATION_OF_IA,
])

// Human-facing labels — used by the UI when rendering stage cards.
// Backend has no labels API today; kept here as the single source of
// truth so labels stay consistent across every screen.
export const STAGE_LABELS = Object.freeze({
  [STAGE.ELIGIBILITY_MATRIX]:          'Eligibility Matrix',
  [STAGE.IN_PRINCIPLE_APPROVAL_OF_IA]: 'In Principle Approval of IA',
  [STAGE.SUSTAINABILITY_MATRIX]:       'Sustainability Matrix',
  [STAGE.ACTION_PLAN]:                 'Action Plan',
  [STAGE.DETAILED_APPRAISAL]:          'Detailed Appraisal',
  [STAGE.DOCUMENTATION_OF_IA]:         'Documentation of IA',
})

// ── Endpoints ──────────────────────────────────────────────────────────
// The envelope `{status, message, data}` is unwrapped by `apiFetch`
// itself; every function below receives the raw payload.

// GET /industry-association-registrations/stages
// Returns the master list of every stage / sub-stage the backend knows
// about — `[{ id, stage, subStage }]`.
export function listAllStages({ signal } = {}) {
  return apiFetch(`${PATH}/stages`, { signal })
}

// GET /industry-association-registrations/{registrationId}/stage-history
// Returns every sub-stage transition for a single IA in ascending time
// order — `[{ id, registrationId, stage, subStage, time, createdBy, comment }]`.
// Used to render the "who did what, when" audit trail and to derive
// per-sub-stage completion status.
export function getStageHistory(registrationId, { signal } = {}) {
  return apiFetch(
    `${PATH}/${encodeURIComponent(registrationId)}/stage-history`,
    { signal },
  )
}

// GET /industry-association-registrations/stage/{stageId}
// Returns every IA currently sitting at a given sub-stage — used by
// reviewer queues (SDE pending L1, CE pending appraisal etc.). Response
// items follow the standard IA registration DTO shape.
export function listRegistrationsByStage(stageId, { signal } = {}) {
  return apiFetch(
    `${PATH}/stage/${encodeURIComponent(stageId)}`,
    { signal },
  )
}
