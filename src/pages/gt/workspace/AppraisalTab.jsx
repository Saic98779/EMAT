import { useCallback, useState } from 'react'
import { Alert, Box, Snackbar, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { useIaWorkspace } from '../../../components/workspace/IaWorkspaceLayout'
import { stackedLabelSx } from '../../../components/workspace/formStyles'
import AppraisalForm from '../../../components/AppraisalForm'

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

  return (
    <>
      <Header />
      <Box sx={stackedLabelSx}>
        <AppraisalForm
          registrationId={ws.iaId}
          onSaved={onSaved}
          stickyFooter
        />
      </Box>
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
