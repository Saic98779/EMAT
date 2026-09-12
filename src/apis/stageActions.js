// Stage transition catalogue for reviewer decisions. Maps a
// (currentSubStage, viewerRole) tuple to the list of decisions the
// viewer can take here, each pointing at the destination sub-stage id
// they'd write into `stageId` on the approve endpoint.
//
// The map is expressed as an array of records so a single sub-stage
// can be reachable by multiple roles (e.g. HO Maker reviewing after
// SDE approval). Callers iterate the array and filter by the current
// (subStage, role) pair.
//
// Field notes
//   • Sub-stage enum values come straight from the backend
//     `/industry-association-registrations/stages` endpoint.
//   • Role values are the uppercase `rawRole` strings — matches the
//     backend user role enum without a translation step.
//   • `destinationStageId` is the sub-stage this decision advances /
//     rejects / reverts TO. The frontend looks it up at runtime from
//     the master `useAllStages()` list so a backend id renumber won't
//     break the map.

// Decision "kinds" — used to pick a button style / label in the UI.
export const DECISION = Object.freeze({
  APPROVE: 'APPROVE',
  REJECT:  'REJECT',
  REVERT:  'REVERT',
  COMMENT: 'COMMENT',
})

// Viewer roles that carry decision affordances. Kept as an enum so
// the UI can render a friendly label without duplicating strings.
export const REVIEWER_ROLES = Object.freeze({
  SIDBI_SDE:      'SIDBI_SDE',
  CLUSTER_EXPERT: 'CLUSTER_EXPERT',
  SIDBI_HO_MAKER: 'SIDBI_HO_MAKER',
})

// Master transition table. Read as:
//   "When the record sits at `at` and the viewer's rawRole matches
//    `role`, they can trigger the listed decisions."
//
// Any sub-stage not listed here means: no decision affordance for any
// role at that position (viewer just sees the read-only workflow).
const TRANSITIONS = [
  // ── In-Principle Approval — SDE decides at SUBMITTED ─────────────────
  {
    at: 'IN_PRINCIPLE_APPROVAL_OF_IA_SUBMITTED',
    role: REVIEWER_ROLES.SIDBI_SDE,
    decisions: [
      { kind: DECISION.APPROVE, to: 'IN_PRINCIPLE_APPROVAL_OF_IA_SDE_APPROVAL', label: 'Approve L1' },
      { kind: DECISION.REJECT,  to: 'IN_PRINCIPLE_APPROVAL_OF_IA_SDE_REJECTED', label: 'Reject' },
      { kind: DECISION.REVERT,  to: 'IN_PRINCIPLE_APPROVAL_OF_IA_SDE_REVERTED', label: 'Send back to GT' },
    ],
  },

  // ── Action Plan — Cluster Expert reviews ────────────────────────────
  {
    at: 'ACTION_PLAN_SUBMITTED',
    role: REVIEWER_ROLES.CLUSTER_EXPERT,
    decisions: [
      { kind: DECISION.APPROVE, to: 'CLUSTER_EXPERT_APPROVED', label: 'Approve action plan' },
      { kind: DECISION.REVERT,  to: 'CLUSTER_EXPERT_REVERTED', label: 'Send back to GT' },
    ],
  },

  // ── Detailed Appraisal — SDE decides at SUBMITTED ───────────────────
  {
    at: 'DETAILED_APPRAISAL_SUBMITTED',
    role: REVIEWER_ROLES.SIDBI_SDE,
    decisions: [
      { kind: DECISION.APPROVE, to: 'DETAILED_APPRAISAL_APPROVAL_BY_SDE', label: 'Approve L2' },
      { kind: DECISION.REJECT,  to: 'DETAILED_APPRAISAL_REJECTED_BY_SDE', label: 'Reject' },
      { kind: DECISION.REVERT,  to: 'DETAILED_APPRAISAL_REVERTED_BY_SDE', label: 'Send back to GT' },
    ],
  },

  // ── Detailed Appraisal — CE comments (advisory, not gate) ───────────
  {
    at: 'DETAILED_APPRAISAL_APPROVAL_BY_SDE',
    role: REVIEWER_ROLES.CLUSTER_EXPERT,
    decisions: [
      { kind: DECISION.COMMENT, to: 'DETAILED_APPRAISAL_CE_COMMENTS_SUBMITTED', label: 'Submit CE comments' },
    ],
  },

  // ── Detailed Appraisal — HO Maker final call ────────────────────────
  {
    at: 'DETAILED_APPRAISAL_CE_COMMENTS_SUBMITTED',
    role: REVIEWER_ROLES.SIDBI_HO_MAKER,
    decisions: [
      { kind: DECISION.APPROVE, to: 'DETAILED_APPRAISAL_APPROVAL_BY_HO_MAKER', label: 'Approve (HO Maker)' },
      { kind: DECISION.REJECT,  to: 'DETAILED_APPRAISAL_REJECTED_BY_HO_MAKER', label: 'Reject' },
      { kind: DECISION.REVERT,  to: 'DETAILED_APPRAISAL_REVERTED_BY_HO_MAKER', label: 'Send back for revisions' },
    ],
  },
]

// Decisions that don't have a backend endpoint yet — filtered out
// everywhere until the API lands. Add / remove entries here to gate
// specific decision kinds without touching the transitions table.
// Revert is fully supported now — same PUT /{id} the approve/reject
// path uses, just with the revert sub-stage id (5, 9, 13, 17). Verified
// live 2026-09-10.
const UNSUPPORTED_KINDS = new Set()

// Returns the decision records available to `viewerRole` when the IA sits
// at `currentSubStage`. Result is always an array (empty if none).
export function decisionsFor(currentSubStage, viewerRole) {
  if (!currentSubStage || !viewerRole) return []
  return TRANSITIONS
    .filter((t) => t.at === currentSubStage && t.role === viewerRole)
    .flatMap((t) => t.decisions)
    .filter((d) => !UNSUPPORTED_KINDS.has(d.kind))
}

// Convenience: `true` when a given viewerRole has *any* decisions at
// the current sub-stage. Cheap check used by the stage cards to show/
// hide the whole decision panel.
export function hasAnyDecision(currentSubStage, viewerRole) {
  return decisionsFor(currentSubStage, viewerRole).length > 0
}

// Look up the numeric backend id for a destination sub-stage. Runs
// against the master list returned by `useAllStages()`.
export function stageIdOf(allStages, subStageKey) {
  if (!Array.isArray(allStages)) return null
  const row = allStages.find((s) => s.subStage === subStageKey)
  return row?.id ?? null
}

// Look up the numeric backend id for a stage, optionally preferring a
// specific sub-stage. Used by the matrix create flows where the client
// needs to stamp `stageId` on the POST so the backend can advance the
// workflow + write a history row.
//
// Lookup order:
//   1. row where subStage === preferredSubStage (exact match)
//   2. row where stage === stageKey and subStage is null / absent
//   3. any row where stage === stageKey (last-resort fallback so a
//      backend enum tweak doesn't break the submit path outright)
export function stageIdForStage(allStages, stageKey, preferredSubStage = null) {
  if (!Array.isArray(allStages) || !stageKey) return null
  if (preferredSubStage) {
    const exact = allStages.find((s) => s.subStage === preferredSubStage)
    if (exact) return exact.id
  }
  const nullSub = allStages.find((s) => s.stage === stageKey && !s.subStage)
  if (nullSub) return nullSub.id
  const anyForStage = allStages.find((s) => s.stage === stageKey)
  return anyForStage?.id ?? null
}
