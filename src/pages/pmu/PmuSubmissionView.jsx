import { useParams } from 'react-router-dom'
import CheckerReview from '../checker/CheckerReview'
import { CONTENT_REVIEW_TYPES } from '../checker/contentReviewConfig'

// PmuSubmissionView
// ────────────────────────────────────────────────────────────────────────
// Thin wrapper — the read-only render lives in CheckerReview (with the
// `readOnly` prop it drops its decision bar). Back button points at the
// per-type list page the user came from.
export default function PmuSubmissionView() {
  const { type } = useParams()
  const cfg = CONTENT_REVIEW_TYPES[type]
  const label = cfg?.label || 'Submissions'
  return (
    <CheckerReview
      readOnly
      backTo={`/gt/pmu/list/${type}`}
      backLabel={label}
      overline={cfg?.overline || 'Content · DIA'}
      title="Submission details"
      subtitle="Read-only view of your submitted entry and its current status."
    />
  )
}
