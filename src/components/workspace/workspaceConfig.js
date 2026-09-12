// Workspace tab registry — a flat list of tab slugs used by the layout
// to resolve the active route from `location.pathname`.
//
// This file used to also derive stage state for the old horizontal
// StageTracker (deriveStageStates, STAGES, STAGE_STATE, tabDotColor).
// All of that is dead now — the workflow visualisation runs off the
// backend stage/sub-stage APIs via `apis/workflow.js#deriveWorkflow`.
// Only the tab list survives here since it's still needed by the URL
// resolver in `IaWorkspaceLayout`.

export const TABS = [
  { key: 'overview',       label: 'Overview'          },
  { key: 'eligibility',    label: 'Eligibility Matrix'},
  { key: 'l1',             label: 'Registration (L1)' },
  { key: 'sustainability', label: 'Sustainability'    },
  { key: 'action-plan',    label: 'Action Plan'       },
  { key: 'appraisal',      label: 'Detailed Appraisal'},
  { key: 'documents',      label: 'Documents'         },
  { key: 'activity',       label: 'Activity'          },
]
