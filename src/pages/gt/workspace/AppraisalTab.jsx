import { useCallback, useState } from 'react'
import { Alert, Box, CircularProgress, Snackbar, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { useIaWorkspace } from '../../../components/workspace/IaWorkspaceLayout'
import AppraisalForm from '../../../components/AppraisalForm'
import AppraisalReviewView from './appraisal/AppraisalReviewView'
import { STAGE } from '../../../apis/registrationStages'
import { STATUS } from '../../../apis/workflow'
import { useAppraisalByRegistration } from '../../../queries'

// AppraisalTab
// ────────────────────────────────────────────────────────────────────────
// The L2 Detailed Appraisal form embedded inside the IA workspace shell.
// Reuses the shared `AppraisalForm` component (also used by the SDE
// review page) — the tab just supplies the surrounding chrome + toast
// wiring, and lets the form render itself with a sticky footer.
export default function AppraisalTab() {
  const ws = useIaWorkspace()
  const [toast, setToast] = useState(null)

  const onSaved = useCallback((msg, severity) => {
    setToast({ msg, severity: severity || 'info' })
  }, [])

  if (ws.isNew) {
    return <Notice title="Detailed Appraisal unlocks after eligibility" body="Head to the Eligibility Matrix tab first." />
  }
  if (!ws.iaId) {
    return <Notice title="IA not found" body="This IA could not be loaded." />
  }
  // Gate: Detailed Appraisal opens only after the Cluster Expert has
  // approved the Action Plan (stage 4 COMPLETED). Earlier stages have
  // their own guards too, but this is the one that changed with the
  // Annexure IV rollout — GT used to jump from Sustainability straight
  // into L2, and now must clear CE first. A direct-URL bypass would
  // still submit an appraisal shell against a workflow that isn't there
  // yet, which the backend rejects; the notice stops the user sooner.
  const sustStage = ws.workflow?.stages?.find((s) => s.key === STAGE.SUSTAINABILITY_MATRIX)
  const actionPlanStage = ws.workflow?.stages?.find((s) => s.key === STAGE.ACTION_PLAN)
  if (sustStage?.status !== STATUS.COMPLETED) {
    return (
      <Notice
        title="Sustainability Matrix required first"
        body="Submit the Sustainability Matrix before starting the Detailed Appraisal."
      />
    )
  }
  if (actionPlanStage?.status !== STATUS.COMPLETED) {
    const inFlight = actionPlanStage?.status === STATUS.IN_PROGRESS
      || actionPlanStage?.status === STATUS.REVERTED
    return (
      <Notice
        title={inFlight ? 'Action Plan is still with the Cluster Expert' : 'Submit the Action Plan first'}
        body={inFlight
          ? 'Detailed Appraisal opens once the Cluster Expert approves the Action Plan.'
          : 'Fill and submit the Action Plan tab — Detailed Appraisal opens once the Cluster Expert approves it.'}
      />
    )
  }

  return (
    <AppraisalTabBody ws={ws} toast={toast} setToast={setToast} onSaved={onSaved} />
  )
}

// Split out so we can hook additional queries (appraisal record for the
// reviewer branch) without adding hooks above the tab's early-return guards.
function AppraisalTabBody({ ws, toast, setToast, onSaved }) {
  const appraisalQ = useAppraisalByRegistration(ws.iaId)

  const decisions = ws.decisionsForCurrent || []
  const appraisal = appraisalQ.data

  // Reviewer path: SDE / CE / HO Maker arriving at their turn on L2.
  const isReviewer = decisions.length > 0 && !!appraisal?.id

  // GT-locked path: appraisal is submitted (or beyond) and this viewer
  // has no reviewer decisions to make. Show a summary banner instead of
  // the editable form so GT isn't looking at their own submission
  // thinking it never went through. Detect "submitted" from the
  // Submission sub-row on the L2 stage (mirrors the L1 lock in
  // RegistrationTab — parent-stage status alone would flag as locked
  // the moment the appraisal shell exists).
  const l2Stage = ws.workflow?.stages?.find((s) => s.key === STAGE.DETAILED_APPRAISAL)
  const submissionSub = (l2Stage?.subStages || []).find(
    (s) => s.label === 'Detailed Appraisal Submission',
  )
  const l2Submitted = submissionSub?.status === STATUS.IN_PROGRESS
    || submissionSub?.status === STATUS.COMPLETED
  const l2Approved = l2Stage?.status === STATUS.COMPLETED
  // Revert carve-out: when the SDE or HO Maker sends L2 back to GT, the
  // stage-level status flips to REVERTED. Unlock the form so GT can
  // revise and resubmit.
  const l2Reverted = l2Stage?.status === STATUS.REVERTED
  const isGtLocked = !isReviewer && !!appraisal?.id && l2Submitted && !l2Reverted
  const revertRemark = l2Reverted ? l2Stage?.comment : null

  if (appraisalQ.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <>
      {isReviewer ? (
        <AppraisalReviewView
          iaId={ws.iaId}
          iaName={ws.ia?.name}
          appraisal={appraisal}
          viewerRole={ws.viewerRole}
          decisions={decisions}
          onDone={(result) => result && setToast(result)}
        />
      ) : (
        // GT view — editable form until submission, read-only form
        // afterwards. `isGtLocked` cascades a `readOnly` flag into the
        // AppraisalForm which flips every field non-editable and hides
        // the submit footer. Same visual shell either way.
        <>
          <Header />
          {l2Reverted && <RevertedBanner remark={revertRemark} />}
          <AppraisalForm
            registrationId={ws.iaId}
            onSaved={onSaved}
            stepper
            readOnly={isGtLocked}
          />
        </>
      )}
      <Snackbar
        open={!!toast}
        autoHideDuration={4200}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert severity={toast.severity} variant="filled" onClose={() => setToast(null)}>
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  )
}

// Bold hero-sized banner shown to GT once they've submitted the L2
// appraisal. Same visual language as the L1 SubmittedBanner in
// RegistrationTab — makes it obvious the submission landed and GT no
// longer has anything to do here until the reviewer chain responds.
function SubmittedBanner({ approved, submittedOn, submittedBy }) {
  const theme = useTheme()
  const tone = approved ? theme.palette.success : theme.palette.info
  const title = approved ? 'Detailed Appraisal approved' : 'Submitted for L2 review'
  const body = approved
    ? 'The SDE / HO Maker chain has cleared this appraisal.'
    : 'This appraisal is now with the SDE for review. You’ll see the outcome here as soon as it’s recorded.'
  return (
    <Box
      sx={{
        mt: 2,
        borderRadius: 2,
        border: 1,
        borderColor: alpha(tone.main, 0.35),
        background: alpha(tone.main, 0.07),
        px: { xs: 3, md: 5 },
        py: { xs: 4, md: 6 },
        textAlign: 'center',
      }}
    >
      <Typography
        sx={{
          fontSize: { xs: 24, md: 32 },
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: tone.dark,
          lineHeight: 1.15,
        }}
      >
        {title}
      </Typography>
      <Typography
        sx={{
          mt: 1.5,
          fontSize: { xs: 14, md: 15.5 },
          color: theme.palette.text.secondary,
          maxWidth: 640,
          mx: 'auto',
        }}
      >
        {body}
      </Typography>
      {(submittedBy || submittedOn) && (
        <Typography
          sx={{
            mt: 3,
            fontSize: 12.5,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: theme.palette.text.disabled,
          }}
        >
          {submittedBy ? `Filed by ${submittedBy}` : ''}
          {submittedBy && submittedOn ? ' · ' : ''}
          {submittedOn ? formatDate(submittedOn) : ''}
        </Typography>
      )}
    </Box>
  )
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.valueOf())) return ''
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// RevertedBanner
// ────────────────────────────────────────────────────────────────────────
// Shown above the appraisal form when a reviewer (SDE or HO Maker) has
// sent L2 back to GT for revisions. Surfaces the reviewer's remarks so
// GT knows exactly what to fix before resubmitting.
function RevertedBanner({ remark }) {
  const theme = useTheme()
  const tone = theme.palette.warning
  return (
    <Box
      sx={{
        mt: 1,
        mb: 2,
        borderRadius: 2,
        border: 1,
        borderColor: alpha(tone.main, 0.4),
        background: alpha(tone.main, 0.08),
        px: { xs: 3, md: 4 },
        py: { xs: 2, md: 2.5 },
      }}
    >
      <Typography
        sx={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: tone.dark,
        }}
      >
        Sent back for revisions
      </Typography>
      <Typography sx={{ mt: 0.5, fontSize: 15, fontWeight: 700, color: theme.palette.text.primary, letterSpacing: '-0.01em' }}>
        The reviewer has asked for changes before L2 can move forward.
      </Typography>
      {remark ? (
        <Box
          sx={{
            mt: 1.5,
            borderRadius: 1.25,
            border: 1,
            borderColor: alpha(tone.main, 0.3),
            background: '#fff',
            px: 1.75,
            py: 1.25,
          }}
        >
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: tone.dark, mb: 0.25 }}>
            Reviewer remarks
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: theme.palette.text.primary, whiteSpace: 'pre-wrap' }}>
            {remark}
          </Typography>
        </Box>
      ) : (
        <Typography sx={{ mt: 0.75, fontSize: 13, color: theme.palette.text.secondary }}>
          No specific remarks were left — reach out to the reviewer for guidance.
        </Typography>
      )}
    </Box>
  )
}

function Header() {
  const theme = useTheme()
  return (
    <Box sx={{ mb: 3, pb: 2, borderBottom: 1, borderColor: alpha(theme.palette.text.primary, 0.08) }}>
      <Typography sx={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.015em' }}>
        Detailed Appraisal
      </Typography>
      <Typography sx={{ fontSize: 13.5, color: theme.palette.text.secondary, mt: 0.75 }}>
        Fill the full L2 form — Cluster Expert comments and the SDE / HO Maker sign-offs attach to this appraisal.
      </Typography>
    </Box>
  )
}

function Notice({ title, body }) {
  return (
    <Box sx={{ maxWidth: 540, mx: 'auto', mt: 4, p: 4, border: 1, borderColor: 'divider', borderRadius: 2, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{title}</Typography>
      <Typography sx={{ fontSize: 13.5, color: 'text.secondary', mt: 1 }}>{body}</Typography>
    </Box>
  )
}
