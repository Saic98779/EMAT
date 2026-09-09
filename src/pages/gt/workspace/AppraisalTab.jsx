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
  // Gate: Detailed Appraisal opens only once Sustainability Matrix is
  // submitted. Otherwise a GT user typing the URL could POST an appraisal
  // shell before the workflow reaches that stage.
  const sustStage = ws.workflow?.stages?.find((s) => s.key === STAGE.SUSTAINABILITY_MATRIX)
  if (sustStage?.status !== STATUS.COMPLETED) {
    return (
      <Notice
        title="Sustainability Matrix required first"
        body="Submit the Sustainability Matrix before starting the Detailed Appraisal. The tab unlocks automatically once that step is done."
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

  // Reviewer path: SDE / CE / HO Maker arriving at their turn on L2. Only
  // render the review surface when an appraisal actually exists — until
  // GT has submitted, there's nothing to review.
  const decisions = ws.decisionsForCurrent || []
  const isReviewer = decisions.length > 0 && !!appraisalQ.data?.id

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
          appraisal={appraisalQ.data}
          viewerRole={ws.viewerRole}
          decisions={decisions}
          onDone={(result) => result && setToast(result)}
        />
      ) : (
        <>
          <Header />
          <AppraisalForm
            registrationId={ws.iaId}
            onSaved={onSaved}
            stepper
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
