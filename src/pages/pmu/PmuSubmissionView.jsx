import { Link, useParams } from 'react-router-dom'
import { Button } from '@mui/material'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import CheckerReview from '../checker/CheckerReview'
import { CONTENT_REVIEW_TYPES } from '../checker/contentReviewConfig'

// PmuSubmissionView
// ────────────────────────────────────────────────────────────────────────
// Thin wrapper — the read-only render lives in CheckerReview (with the
// `readOnly` prop it drops its decision bar). Back button points at the
// per-type list page the user came from.
//
// When the checker has REVERTed the record, we surface an "Edit &
// Resubmit" CTA in the hero so the GT PMU can jump straight to the edit
// form and address the checker's remarks.
export default function PmuSubmissionView() {
  const { type, id } = useParams()
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
      heroAction={(dto) => (dto?.status === 'REVERT' ? <ResubmitButton type={type} id={id} /> : null)}
    />
  )
}

function ResubmitButton({ type, id }) {
  return (
    <Button
      component={Link}
      to={`/gt/pmu/list/${type}/${id}/edit`}
      variant="contained"
      disableElevation
      size="small"
      startIcon={<EditRoundedIcon sx={{ fontSize: 16 }} />}
      sx={{ textTransform: 'none', fontWeight: 600 }}
    >
      Edit & Resubmit
    </Button>
  )
}
