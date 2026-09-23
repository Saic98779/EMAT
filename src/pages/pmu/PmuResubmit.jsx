import { lazy, Suspense } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Alert, Box, Button, CircularProgress, Stack, Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import { alpha, useTheme } from '@mui/material/styles'
import { PageHeader } from '../../components/shared'
import { useContentRecord } from '../../queries'
import { CONTENT_REVIEW_TYPES } from '../checker/contentReviewConfig'

// PmuResubmit
// ────────────────────────────────────────────────────────────────────────
// Route wrapper for /gt/pmu/list/:type/:id/edit.
//
// Loads the record, verifies it belongs to the GT PMU (createdBy) and is
// actually in REVERT status (only reverted records can be edited — an
// APPROVED submission is final; a PENDING one is already awaiting the
// checker), then mounts the correct create-form component in edit mode
// with the fetched record as `initialRecord`.

// Each of the nine DIA forms is lazy-loaded so the resubmit route
// doesn't drag every form's bundle into every page.
const FORMS = {
  'dia-3c-info-series':               lazy(() => import('./Dia3cInfoSeries')),
  'elearning-module-content':         lazy(() => import('./DiaElearningModule')),
  'bulk-broadcast':                   lazy(() => import('./DiaBulkBroadcast')),
  'discussion-forum':                 lazy(() => import('./DiaDiscussionForum')),
  'latest-developments':              lazy(() => import('./DiaLatestDevelopments')),
  'pop-ups':                          lazy(() => import('./DiaPopUps')),
  'surveys':                          lazy(() => import('./DiaSurvey')),
  'bdsp':                             lazy(() => import('./DiaBdspOnboarding')),
  'bds-service-providers-onboarding': lazy(() => import('./DiaPbspOnboarding')),
}

export default function PmuResubmit() {
  const { type, id } = useParams()
  const cfg = CONTENT_REVIEW_TYPES[type]
  const Form = FORMS[type]
  const recordQ = useContentRecord(type, id)
  const navigate = useNavigate()

  if (!cfg || !Form) {
    return <NotFound msg={`Unknown content type "${type}".`} type={type} />
  }

  if (recordQ.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (recordQ.error) {
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto', pt: 4 }}>
        <Alert severity="error">{recordQ.error.message || 'Failed to load the submission.'}</Alert>
      </Box>
    )
  }

  const dto = recordQ.data
  if (!dto) return <NotFound msg="Submission not found." type={type} />

  // Guard: only REVERT records can be edited. If the checker has already
  // approved / rejected, editing shouldn't be possible; bounce back to
  // the read-only view.
  if (dto.status !== 'REVERT') {
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto', pt: 4 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          This submission is <b>{dto.status || 'pending'}</b> — it can't be edited.
          You can only edit submissions the checker has reverted.
        </Alert>
        <Button
          variant="outlined"
          onClick={() => navigate(`/gt/pmu/list/${type}/${id}`)}
          sx={{ textTransform: 'none' }}
        >
          Back to submission
        </Button>
      </Box>
    )
  }

  return (
    <Suspense
      fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      }
    >
      <Box sx={{ maxWidth: 1080, mx: 'auto', pb: 10 }}>
        <RevertBanner remark={dto.remark} typeLabel={cfg.label} backTo={`/gt/pmu/list/${type}/${id}`} />
        <Form editId={id} initialRecord={dto} />
      </Box>
    </Suspense>
  )
}

// Prominent banner above the resubmit form — makes it obvious the user
// is in edit mode and surfaces the checker's remark so they know what to
// fix. Also gives an escape hatch back to the read-only view.
function RevertBanner({ remark, typeLabel, backTo }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        mt: 1, mb: 2, p: 2, borderRadius: 2,
        border: 1, borderColor: alpha(theme.palette.warning.main, 0.4),
        bgcolor: alpha(theme.palette.warning.main, 0.05),
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <HistoryRoundedIcon sx={{ fontSize: 22, color: theme.palette.warning.dark, mt: 0.15 }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: theme.palette.warning.dark }}>
            The checker sent this {typeLabel} back for changes.
          </Typography>
          {remark
            ? (
              <Typography sx={{ mt: 0.5, fontSize: 13, whiteSpace: 'pre-wrap', color: theme.palette.text.primary }}>
                <b>Checker's remark:</b> {remark}
              </Typography>
            )
            : (
              <Typography sx={{ mt: 0.5, fontSize: 12.5, color: theme.palette.text.secondary }}>
                No remark was recorded — reach out to the checker for guidance.
              </Typography>
            )}
          <Typography sx={{ mt: 0.5, fontSize: 12, color: theme.palette.text.secondary }}>
            Update the fields below and hit <b>Resubmit for Approval</b>.
          </Typography>
        </Box>
        <Button
          component={Link}
          to={backTo}
          size="small"
          sx={{ textTransform: 'none', color: 'text.secondary', flexShrink: 0 }}
        >
          Cancel
        </Button>
      </Stack>
    </Box>
  )
}

function NotFound({ msg, type }) {
  const theme = useTheme()
  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', pt: 4 }}>
      <Button
        component={Link}
        to={type ? `/gt/pmu/list/${type}` : '/gt'}
        startIcon={<ArrowBackIcon />}
        sx={{ textTransform: 'none', color: 'text.secondary', mb: 1 }}
      >
        Back
      </Button>
      <PageHeader overline="Content · DIA" title="Resubmit" />
      <Box
        sx={{
          mt: 2, p: 3, borderRadius: 2,
          border: 1, borderColor: alpha(theme.palette.text.primary, 0.09),
          bgcolor: '#fff',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{msg}</Typography>
        </Stack>
      </Box>
    </Box>
  )
}
