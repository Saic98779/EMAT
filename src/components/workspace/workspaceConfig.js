// Static config for the IA Workspace shell — stages that appear in the
// horizontal tracker, tabs in the tab rail, and helpers to derive per-
// stage state (done / current / needs-action / locked) from a live IA
// record.
//
// Kept as plain data so the layout component stays declarative and every
// consumer (dashboards, breadcrumbs, notifications) reads from the same
// source of truth.

// ── Stages (horizontal tracker) ──────────────────────────────────────────
// The 7 canonical steps of an IA's onboarding journey. Order = display
// order. `tab` is the tab-rail slug the step deep-links into.
export const STAGES = [
  { key: 'eligibility',    label: 'Eligibility',      tab: 'eligibility'    },
  { key: 'registration',   label: 'Registration',     tab: 'l1'             },
  { key: 'sustainability', label: 'Sustainability',   tab: 'sustainability' },
  { key: 'appraisal',      label: 'Appraisal',        tab: 'appraisal'      },
  { key: 'ceReview',       label: 'CE Review',        tab: 'appraisal'      },
  { key: 'sdeL2',          label: 'SDE L2',           tab: 'appraisal'      },
  { key: 'hoFinal',        label: 'HO Final',         tab: 'appraisal'      },
]

// ── Tabs (in-workspace navigation) ───────────────────────────────────────
// The horizontal tab rail below the stage tracker.
export const TABS = [
  { key: 'overview',       label: 'Overview'          },
  { key: 'eligibility',    label: 'Eligibility Matrix'},
  { key: 'l1',             label: 'Registration (L1)' },
  { key: 'sustainability', label: 'Sustainability'    },
  { key: 'appraisal',      label: 'Detailed Appraisal'},
  { key: 'documents',      label: 'Documents'         },
  { key: 'activity',       label: 'Activity'          },
]

// Stage lifecycle values driving the tracker's visual state.
//   done    — completed step (green check)
//   current — in progress at this stage (blue ring)
//   action  — needs THIS user's action (amber ring)
//   locked  — not yet reached (gray)
export const STAGE_STATE = {
  DONE: 'done',
  CURRENT: 'current',
  ACTION: 'action',
  LOCKED: 'locked',
}

// Derive per-stage state from an IA workspace snapshot. Kept intentionally
// pure so callers can memoise it and unit-test the transitions.
//
// `ctx` shape:
//   { ia, hasEligibility, hasRegistrationDraft, hasRegistrationSubmitted,
//     l1Approved, l1Rejected, hasSustainability, hasAppraisalDraft,
//     hasAppraisalSubmitted, ceDecided, l2Approved, l2Rejected,
//     hoApproved, hoRejected, viewerRole }
//
// Missing keys are treated as false — a brand-new IA with only identity
// captured returns Eligibility=current and everything else locked.
export function deriveStageStates(ctx = {}) {
  const {
    hasEligibility = false,
    hasRegistrationSubmitted = false,
    l1Approved = false,
    l1Rejected = false,
    hasSustainability = false,
    hasAppraisalSubmitted = false,
    ceDecided = false,
    l2Approved = false,
    l2Rejected = false,
    hoApproved = false,
    hoRejected = false,
  } = ctx

  const states = {}

  // Eligibility
  if (hasEligibility) states.eligibility = STAGE_STATE.DONE
  else states.eligibility = STAGE_STATE.CURRENT

  // Registration (L1)
  if (l1Approved) states.registration = STAGE_STATE.DONE
  else if (l1Rejected) states.registration = STAGE_STATE.ACTION
  else if (hasRegistrationSubmitted) states.registration = STAGE_STATE.CURRENT
  else if (hasEligibility) states.registration = STAGE_STATE.ACTION
  else states.registration = STAGE_STATE.LOCKED

  // Sustainability
  if (hasSustainability) states.sustainability = STAGE_STATE.DONE
  else if (l1Approved) states.sustainability = STAGE_STATE.ACTION
  else states.sustainability = STAGE_STATE.LOCKED

  // Detailed Appraisal
  if (hasAppraisalSubmitted) states.appraisal = STAGE_STATE.DONE
  else if (hasSustainability) states.appraisal = STAGE_STATE.ACTION
  else states.appraisal = STAGE_STATE.LOCKED

  // CE Review
  if (ceDecided) states.ceReview = STAGE_STATE.DONE
  else if (hasAppraisalSubmitted) states.ceReview = STAGE_STATE.CURRENT
  else states.ceReview = STAGE_STATE.LOCKED

  // SDE L2
  if (l2Approved) states.sdeL2 = STAGE_STATE.DONE
  else if (l2Rejected) states.sdeL2 = STAGE_STATE.ACTION
  else if (ceDecided) states.sdeL2 = STAGE_STATE.CURRENT
  else states.sdeL2 = STAGE_STATE.LOCKED

  // HO Final
  if (hoApproved) states.hoFinal = STAGE_STATE.DONE
  else if (hoRejected) states.hoFinal = STAGE_STATE.ACTION
  else if (l2Approved) states.hoFinal = STAGE_STATE.CURRENT
  else states.hoFinal = STAGE_STATE.LOCKED

  return states
}

// Per-tab status dot color derived from stage states. Mirrors the tracker
// so users see the same signal in both the tab rail and the tracker.
export function tabDotColor(tabKey, stageStates = {}, theme) {
  const mapping = {
    eligibility: 'eligibility',
    l1: 'registration',
    sustainability: 'sustainability',
    appraisal: 'appraisal',
  }
  const stageKey = mapping[tabKey]
  if (!stageKey) return null
  const state = stageStates[stageKey]
  if (state === STAGE_STATE.DONE) return theme.palette.success.main
  if (state === STAGE_STATE.ACTION) return theme.palette.warning.main
  if (state === STAGE_STATE.CURRENT) return theme.palette.primary.main
  return null
}
