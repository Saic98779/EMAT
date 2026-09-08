import { STAGE, STAGE_LABELS, STAGE_ORDER } from './registrationStages'

// Pure workflow derivation. Given the raw backend inputs, returns a
// structured tree the UI can render without further computation:
//
//   {
//     overall:  { completed, total, percent },
//     stages: [
//       { key, label, status, progress: { completed, total },
//         score?, comment?, subStages: [ { id, label, status, completedOn,
//         completedBy, remarks, kind } ] }
//     ],
//   }
//
// The mapping is opinionated because the raw enum data doesn't 1:1 match
// the mock's semantic sub-stages. Here's the shape of that opinion:
//
//   • Six top-level stages (STAGE_ORDER) map to six cards.
//   • Each stage exposes a hand-crafted list of "positive-path" sub-stages
//     (see STAGE_TEMPLATE below). Terminal failures (REJECTED / REVERTED)
//     surface as **status** on the containing stage, never as their own
//     row in the sub-stage table.
//   • A sub-stage's completion is derived from `stageHistory`: the latest
//     history entry whose `subStage` matches the template's `keys` wins.
//     The parent stage's status is the aggregate — done / in-progress /
//     reverted / rejected / locked.
//
// Inputs
//   ia             IndustryAssociationRegistrationResponse | null
//   allStages      [{ id, stage, subStage }] — from /stages
//   history        [{ id, registrationId, stage, subStage, time,
//                     createdBy, comment }] — sorted server-side ascending
//   eligibility    EligibilityMatrixResponse | null — presence alone is
//                  enough to mark the Eligibility card done, because the
//                  backend sometimes omits `isEligibleMatricsAdded` on
//                  the IA DTO even after the matrix was created.
//
// Any missing input returns a locked workflow so the caller can render
// even before data arrives.
export function deriveWorkflow({ ia, allStages, history, eligibility } = {}) {
  // Normalise the DTO once so every comparison downstream uses the same
  // shape. Backend sometimes returns `currentStage` as the bare sub-stage
  // enum ("IN_PRINCIPLE_APPROVAL_OF_IA_SUBMITTED") and sometimes as the
  // dotted "STAGE.SUB_STAGE" form — normaliseCurrentStage collapses both
  // into the bare sub-stage key.
  const iaN = ia ? { ...ia, currentStage: normaliseCurrentStage(ia.currentStage) } : ia
  const historyN = (history || []).map((h) => ({
    ...h,
    subStage: normaliseCurrentStage(h.subStage),
  }))
  const stages = STAGE_ORDER.map((stageKey) =>
    deriveStage(stageKey, iaN, allStages, historyN, eligibility),
  )
  const overall = computeOverall(stages)
  return { overall, stages }
}

// Backend inconsistency guard: some endpoints emit `"STAGE.SUB_STAGE"`
// (e.g. "IN_PRINCIPLE_APPROVAL_OF_IA.IN_PRINCIPLE_APPROVAL_OF_IA_SUBMITTED")
// while others emit just `"SUB_STAGE"`. Strip the leading `STAGE.` prefix
// so downstream comparisons see the bare sub-stage key everywhere.
function normaliseCurrentStage(raw) {
  if (!raw || typeof raw !== 'string') return raw || ''
  const dot = raw.indexOf('.')
  return dot >= 0 ? raw.slice(dot + 1) : raw
}

// ── Stage / sub-stage status values ────────────────────────────────────
// Kept as an enum so the UI can pattern-match without magic strings.
export const STATUS = Object.freeze({
  COMPLETED:   'COMPLETED',    // sub-stage / stage fully done
  IN_PROGRESS: 'IN_PROGRESS',  // currently the IA's live position
  REVERTED:    'REVERTED',     // sent back to a previous role (still actionable)
  REJECTED:    'REJECTED',     // terminal failure at this stage
  NOT_STARTED: 'NOT_STARTED',  // upstream stages not yet complete
})

// ── Stage template — the mock's "positive-path" sub-stage list ─────────
// For each stage, define the ordered rows that render in the expanded
// table. `keys` are the raw `subStage` enum values from the backend that
// count as "this row is complete when we see one of these in history".
// `rejectionKeys` / `revertKeys` flip the parent stage's status only —
// they do not add table rows.
//
// If a stage has no sub-stages in the backend enum (Eligibility Matrix,
// Documentation of IA), we still show a single row so users see a
// consistent shape across all six cards.
const STAGE_TEMPLATE = {
  [STAGE.ELIGIBILITY_MATRIX]: {
    subStages: [
      { label: 'Eligibility Matrix', keys: [], derivedFrom: 'eligibility-matrix-present' },
    ],
    rejectionKeys: [],
    revertKeys: [],
  },

  [STAGE.IN_PRINCIPLE_APPROVAL_OF_IA]: {
    subStages: [
      { label: 'In Principle Registration', keys: [], derivedFrom: 'registration-present' },
      { label: 'Submission', keys: ['IN_PRINCIPLE_APPROVAL_OF_IA_SUBMITTED'] },
      { label: 'SDE Approval', keys: ['IN_PRINCIPLE_APPROVAL_OF_IA_SDE_APPROVAL'] },
    ],
    rejectionKeys: ['IN_PRINCIPLE_APPROVAL_OF_IA_SDE_REJECTED'],
    revertKeys:    ['IN_PRINCIPLE_APPROVAL_OF_IA_SDE_REVERTED'],
  },

  [STAGE.SUSTAINABILITY_MATRIX]: {
    subStages: [
      { label: 'Sustainability Matrix Submission', keys: ['SUSTAINABILITY_MATRIX_SUBMITTED'] },
    ],
    rejectionKeys: [],
    revertKeys: [],
  },

  [STAGE.ACTION_PLAN]: {
    subStages: [
      { label: 'Action Plan Submission', keys: ['ACTION_PLAN_SUBMITTED'] },
      { label: 'Cluster Expert Approval', keys: ['CLUSTER_EXPERT_APPROVED'] },
    ],
    rejectionKeys: [],
    revertKeys:    ['CLUSTER_EXPERT_REVERTED'],
  },

  [STAGE.DETAILED_APPRAISAL]: {
    subStages: [
      { label: 'Detailed Appraisal Submission', keys: ['DETAILED_APPRAISAL_SUBMITTED'] },
      { label: 'SDE Approval',                  keys: ['DETAILED_APPRAISAL_APPROVAL_BY_SDE'] },
      { label: 'Cluster Expert Comments',       keys: ['DETAILED_APPRAISAL_CE_COMMENTS_SUBMITTED'] },
      { label: 'HO Maker Approval',             keys: ['DETAILED_APPRAISAL_APPROVAL_BY_HO_MAKER'] },
      { label: 'Panel Submission',              keys: ['DETAILED_APPRAISAL_SUBMITTED_BY_PANEL'] },
    ],
    rejectionKeys: [
      'DETAILED_APPRAISAL_REJECTED_BY_SDE',
      'DETAILED_APPRAISAL_REJECTED_BY_HO_MAKER',
    ],
    revertKeys: [
      'DETAILED_APPRAISAL_REVERTED_BY_SDE',
      'DETAILED_APPRAISAL_REVERTED_BY_HO_MAKER',
    ],
  },

  [STAGE.DOCUMENTATION_OF_IA]: {
    subStages: [
      { label: 'Documentation of IA', keys: [], derivedFrom: 'documentation-current' },
    ],
    rejectionKeys: [],
    revertKeys: [],
  },
}

// ── Internals ──────────────────────────────────────────────────────────

function deriveStage(stageKey, ia, allStages, history, eligibility) {
  const tmpl = STAGE_TEMPLATE[stageKey] || { subStages: [], rejectionKeys: [], revertKeys: [] }
  const stageHistory = (history || []).filter((h) => h.stage === stageKey)

  const subStages = tmpl.subStages.map((row, i) =>
    deriveSubStage({ row, index: i, stageKey, ia, allStages, stageHistory, eligibility }),
  )

  const currentStage = ia?.currentStage || ''
  const hasReject = tmpl.rejectionKeys.some((k) => currentStage === k || stageHistoryHas(stageHistory, k))
  const hasRevert = tmpl.revertKeys.some((k) => currentStage === k || stageHistoryHas(stageHistory, k))
  const inFlight  = currentStage.startsWith(stageKey)

  const completed = subStages.filter((s) => s.status === STATUS.COMPLETED).length

  let status
  if (hasReject) status = STATUS.REJECTED
  else if (hasRevert) status = STATUS.REVERTED
  else if (completed === subStages.length && subStages.length > 0) status = STATUS.COMPLETED
  else if (inFlight || completed > 0) status = STATUS.IN_PROGRESS
  else status = STATUS.NOT_STARTED

  return {
    key: stageKey,
    label: STAGE_LABELS[stageKey] || stageKey,
    status,
    progress: { completed, total: subStages.length },
    // Surface the latest reviewer comment for the card body (mock shows it
    // when a stage was reverted / rejected).
    comment: latestCommentFor(stageHistory, [...tmpl.rejectionKeys, ...tmpl.revertKeys])
      || (status === STATUS.IN_PROGRESS ? ia?.comments : null)
      || null,
    subStages,
  }
}

function deriveSubStage({ row, index, stageKey, ia, allStages, stageHistory, eligibility }) {
  // Special-case: derived rows (Eligibility "matrix present", Registration
  // "IA record exists", Documentation "currentStage reached").
  if (row.derivedFrom === 'eligibility-matrix-present') {
    // Presence of the fetched matrix record is proof enough — the backend
    // doesn't always echo `isEligibleMatricsAdded` on the IA DTO after the
    // matrix is created, so relying on that flag alone leaves this row
    // stuck at NOT_STARTED even when the matrix is clearly on record.
    const matrixPresent = !!ia?.isEligibleMatricsAdded || !!eligibility?.id
    return finaliseRow({
      row, index, stageKey, allStages,
      status: matrixPresent ? STATUS.COMPLETED : STATUS.NOT_STARTED,
      // Synthesise a history entry from the matrix record so the row's
      // "Completed On" column shows the actual submission timestamp
      // instead of an em-dash.
      historyEntry: matrixPresent
        ? { time: eligibility?.createdAt || ia?.updatedAt || null, createdBy: eligibility?.createdBy || ia?.createdBy || null, comment: null }
        : null,
      kind: 'derived',
    })
  }
  if (row.derivedFrom === 'registration-present') {
    return finaliseRow({
      row, index, stageKey, allStages,
      status: ia?.id != null ? STATUS.COMPLETED : STATUS.NOT_STARTED,
      historyEntry: {
        // Synthetic history — the IA record itself is proof.
        time: ia?.createdAt,
        createdBy: ia?.createdBy || 'Applicant',
        comment: ia?.id != null ? 'Registration completed successfully.' : null,
      },
      kind: 'derived',
    })
  }
  if (row.derivedFrom === 'documentation-current') {
    const done = ia?.currentStage === STAGE.DOCUMENTATION_OF_IA
    return finaliseRow({
      row, index, stageKey, allStages,
      status: done ? STATUS.COMPLETED : STATUS.NOT_STARTED,
      historyEntry: null,
      kind: 'derived',
    })
  }

  // Regular sub-stage — status is driven by history + currentStage.
  const historyEntry = stageHistory
    .filter((h) => row.keys.includes(h.subStage))
    .slice(-1)[0] || null // latest matching transition

  let status = STATUS.NOT_STARTED
  if (historyEntry) status = STATUS.COMPLETED
  else if (row.keys.includes(ia?.currentStage)) status = STATUS.IN_PROGRESS

  return finaliseRow({
    row, index, stageKey, allStages, status, historyEntry, kind: 'transition',
  })
}

function finaliseRow({ row, index, stageKey, allStages, status, historyEntry, kind }) {
  // Find the numeric stageId — needed by the approve endpoint when the
  // reviewer acts on this sub-stage. Falls back to null for derived rows
  // that don't correspond to a real transition entry.
  const backendRow = row.keys.length && allStages
    ? allStages.find((s) => s.stage === stageKey && row.keys.includes(s.subStage))
    : null

  return {
    // Numeric position within the stage — e.g. 2.1, 2.2, 2.3.
    index: index + 1,
    label: row.label,
    status,
    kind,
    // id of the backend sub-stage (for approve calls). null when derived.
    stageId: backendRow?.id ?? null,
    completedOn: historyEntry?.time ?? null,
    completedBy: historyEntry?.createdBy ?? null,
    remarks: historyEntry?.comment ?? null,
  }
}

function stageHistoryHas(history, subStageKey) {
  return history.some((h) => h.subStage === subStageKey)
}

function latestCommentFor(history, subStageKeys) {
  if (!subStageKeys.length) return null
  const match = [...history]
    .filter((h) => subStageKeys.includes(h.subStage))
    .sort((a, b) => (a.time > b.time ? -1 : 1))[0]
  return match?.comment || null
}

function computeOverall(stages) {
  let completed = 0
  let total = 0
  for (const s of stages) {
    completed += s.progress.completed
    total += s.progress.total
  }
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  return { completed, total, percent }
}
