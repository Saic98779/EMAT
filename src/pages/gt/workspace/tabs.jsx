import PlaceholderTab from './PlaceholderTab'

// Placeholder tab exports. Real screens replace these in follow-up ports.
// Kept as tiny wrappers so the router doesn't need to know which tabs are
// implemented — it just imports from here and swaps them out later.

export const OverviewTab = () => (
  <PlaceholderTab
    title="Overview"
    summary="A digest of who owns this IA, the current stage, latest activity, and quick links into each stage tab."
  />
)

export const RegistrationTab = () => (
  <PlaceholderTab
    title="Registration (L1)"
    summary="The full In-Principle Approval form — pre-filled from the Eligibility Matrix. Ports next after the workspace shell is verified."
  />
)

export const SustainabilityTab = () => (
  <PlaceholderTab
    title="Sustainability Matrix"
    summary="A scoring pass on the IA's sustainability posture. Unlocks after the SDE grants L1 approval."
  />
)

export const AppraisalTab = () => (
  <PlaceholderTab
    title="Detailed Appraisal"
    summary="The L2 appraisal form. Cluster Expert comments and SDE / HO decisions attach to this tab."
  />
)

export const DocumentsTab = () => (
  <PlaceholderTab
    title="Documents"
    summary="A unified view of every file uploaded across stages, grouped by upload slot."
  />
)

export const ActivityTab = () => (
  <PlaceholderTab
    title="Activity"
    summary="The full audit timeline for this IA — every submit, approve, comment, and revision, filterable by role and action."
  />
)
