import { useEffect, useState } from 'react'
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Stack, TextField, Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { DECISION } from '../../apis/stageActions'
import { useApproveIA } from '../../queries'

// DecisionDialog
// ────────────────────────────────────────────────────────────────────────
// Modal invoked when a reviewer picks Approve / Reject / Revert / Comment
// on a stage sub-row. Collects mandatory comments for reject + revert
// and hits the `PATCH /industry-association-registrations/{id}/approve`
// endpoint with the correct `stageId` for the destination sub-stage.
//
// Props
//   open           Boolean
//   onClose        () => void
//   iaId           Registration id
//   decision       { kind, to, label, stageId } — the selected decision
//   stageLabel     Human name of the current stage (used in the modal title)
//   onDone         (result) => void  — result: { severity, msg }
function DecisionDialog({ open, onClose, iaId, decision, stageLabel, onDone }) {
  const theme = useTheme()
  const approve = useApproveIA()

  const [comments, setComments] = useState('')

  useEffect(() => {
    if (open) setComments('') // reset on every re-open
  }, [open])

  if (!decision) return null

  const kind = decision.kind
  const tone = kindTone(kind, theme)
  const needsComments = kind === DECISION.REJECT || kind === DECISION.REVERT || kind === DECISION.COMMENT
  const canSubmit = !approve.isPending && (needsComments ? comments.trim().length > 0 : true)

  const submit = async () => {
    if (!iaId || !decision.stageId) {
      onDone?.({ severity: 'error', msg: 'Missing IA id or destination stage.' })
      return
    }
    try {
      await approve.mutateAsync({
        id: iaId,
        isSidbeApproved: kind === DECISION.APPROVE,
        stageId: decision.stageId,
        stageComments: comments.trim() || undefined,
      })
      onDone?.({ severity: 'success', msg: `${decision.label} · recorded.` })
      onClose?.()
    } catch (err) {
      onDone?.({ severity: 'error', msg: err?.message || 'Failed to submit decision.' })
    }
  }

  return (
    <Dialog open={open} onClose={approve.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          borderBottom: 1,
          borderColor: alpha(theme.palette.text.primary, 0.09),
          pb: 1.5,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            sx={{
              width: 8,
              height: 24,
              borderRadius: 1,
              background: tone.accent,
            }}
          />
          <Box>
            <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{decision.label}</Typography>
            {stageLabel && (
              <Typography sx={{ fontSize: 12.5, color: theme.palette.text.disabled }}>
                {stageLabel}
              </Typography>
            )}
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={2}>
          <Alert severity={tone.severity} variant="outlined" sx={{ borderColor: alpha(tone.accent, 0.35) }}>
            {kindDescription(kind)}
          </Alert>

          <TextField
            label={needsComments ? 'Comments (required)' : 'Comments (optional)'}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            multiline
            minRows={3}
            fullWidth
            size="small"
            placeholder={commentPlaceholder(kind)}
            disabled={approve.isPending}
            helperText={needsComments ? 'Explain what needs revising / why you rejected.' : ' '}
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={approve.isPending} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          disableElevation
          disabled={!canSubmit}
          onClick={submit}
          sx={{
            background: tone.accent,
            '&:hover': { background: tone.accentDark },
          }}
          startIcon={approve.isPending ? <CircularProgress size={14} color="inherit" /> : null}
        >
          {approve.isPending ? 'Recording…' : `Confirm — ${decision.label}`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default DecisionDialog

// ── Helpers ────────────────────────────────────────────────────────────

function kindTone(kind, theme) {
  switch (kind) {
    case DECISION.APPROVE:
      return { accent: theme.palette.success.main, accentDark: theme.palette.success.dark, severity: 'success' }
    case DECISION.REJECT:
      return { accent: theme.palette.error.main, accentDark: theme.palette.error.dark, severity: 'error' }
    case DECISION.REVERT:
      return { accent: theme.palette.warning.main, accentDark: theme.palette.warning.dark, severity: 'warning' }
    default:
      return { accent: theme.palette.primary.main, accentDark: theme.palette.primary.dark, severity: 'info' }
  }
}

function kindDescription(kind) {
  switch (kind) {
    case DECISION.APPROVE: return 'Advances the IA to the next sub-stage. This action is recorded in the audit trail.'
    case DECISION.REJECT:  return 'Rejects the IA at this stage. The workflow terminates here — comments are mandatory.'
    case DECISION.REVERT:  return 'Sends the IA back to the previous role for revisions. Comments are mandatory.'
    default:               return 'Records your comments against this sub-stage.'
  }
}

function commentPlaceholder(kind) {
  switch (kind) {
    case DECISION.APPROVE: return 'Optional remarks…'
    case DECISION.REJECT:  return 'Reason for rejection…'
    case DECISION.REVERT:  return 'What needs to be corrected before resubmission…'
    default:               return 'Your observations…'
  }
}
