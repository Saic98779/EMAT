import { memo, useCallback, useMemo, useRef, useState } from 'react'
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, Stack, TextField, Typography,
} from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import { alpha, useTheme } from '@mui/material/styles'

import { DECISION } from '../../../../apis/stageActions'
import {
  toUpdatePayload as toAppraisalUpdatePayload,
} from '../../../../apis/industryAssociationAppraisals'
import { updateAppraisal } from '../../../../apis/industryAssociationAppraisals'
import { uploadFilesBatch } from '../../../../apis/files'
import { encodeFilename } from '../../../../fileFieldLabels'
import AppraisalForm from '../../../../components/AppraisalForm'
import { useQueryClient } from '@tanstack/react-query'
import { keys } from '../../../../queries'

// SdeL2ReviewEdit
// ────────────────────────────────────────────────────────────────────────
// SDE's L2 review surface — editable. The previous review view showed
// every field read-only, which meant the SDE had no way to author the
// Due Diligence block (CIBIL / SMART / NABARD / NGO Darpan / Web Search /
// Holder & Beneficial-Owner DD) even though that block is squarely
// SDE-owned per the spec.
//
// Layout
//   • Hero — same "Awaiting your L2 decision" pill + IA metrics as the
//     read-only view, so the SDE knows they're at the decision point.
//   • Body — full editable AppraisalForm (stepper mode). Role is
//     SIDBI_SDE so `schemaFor('SIDBI_SDE')` gives them every non-CE
//     section, with DD editable and Cluster-Expert-only fields locked.
//   • Sticky footer — custom `SdeDecisionBar`: remarks textarea +
//     Approve L2 / Reject / Send back to GT. Each decision *atomically*
//     saves the current form values (DD + anything else the SDE typed)
//     AND advances the workflow via a single PUT to
//     /industry-association-appraisals/{id}. That way no in-progress
//     DD entry is ever lost between a Save click and an Approve click —
//     there's just one button per outcome.
//
// Props
//   iaId        Registration id
//   iaName      Display name of the IA (for hero + confirm dialog)
//   appraisal   Raw appraisal DTO (from useAppraisalByRegistration)
//   decisions   [{ kind, to, label, stageId }] — from decisionsForCurrent
//   onDone      (result) => void — parent surfaces this as a toast
export default function SdeL2ReviewEdit({
  iaId, iaName, appraisal, decisions = [], onDone,
}) {
  const theme = useTheme()
  const [justRecorded, setJustRecorded] = useState(null)
  // Parent-owned ref that AppraisalForm writes its live snapshot into on
  // every render — { values, seeded, isValid, firstProblem, collectFiles,
  // showAllErrors }. DecisionBar reads it when a decision is triggered
  // so the payload we PUT includes whatever the SDE just typed.
  const formRef = useRef(null)

  const files = 0 // not shown in hero on this surface; kept minimal
  const submittedOn = appraisal?.updatedAt || appraisal?.createdAt
  const submittedBy = appraisal?.updatedBy || appraisal?.createdBy

  return (
    <>
      <ReviewHero
        pill="Awaiting your L2 decision"
        title={iaName ? `Review appraisal for ${iaName}` : 'Review the L2 appraisal'}
        submittedOn={submittedOn}
        submittedBy={submittedBy}
        filesCount={files}
      />

      {justRecorded && (
        <RecordedBanner
          kind={justRecorded.kind}
          label={justRecorded.label}
          comments={justRecorded.comments}
        />
      )}

      {!justRecorded && (
        <Box sx={{ mt: 3 }}>
          <AppraisalForm
            registrationId={iaId}
            stepper
            formRef={formRef}
            renderFooter={
              <SdeDecisionBar
                iaName={iaName}
                iaId={iaId}
                appraisalId={appraisal?.id}
                decisions={decisions}
                formRef={formRef}
                onRecorded={setJustRecorded}
                onDone={onDone}
              />
            }
          />
        </Box>
      )}
    </>
  )
}

// ── Decision bar ─────────────────────────────────────────────────────────
// Isolated so remarks-textarea keystrokes don't force the (heavy) stepper
// form above it to re-render. Every decision path does the same three
// things in order: validate the form → save form values + workflow keys
// in a single PUT → upload any pending file inputs. On approve /
// reject / revert the parent's `onRecorded` fires so the tab swaps to a
// bold status banner while the workflow refetches.
const SdeDecisionBar = memo(function SdeDecisionBar({
  iaName, iaId, appraisalId, decisions, formRef, onRecorded, onDone,
}) {
  const theme = useTheme()
  const qc = useQueryClient()
  const [comments, setComments] = useState('')
  const [busyKind, setBusyKind] = useState(null)
  const [pendingDecision, setPendingDecision] = useState(null)

  const requestDecision = useCallback((d) => {
    const trimmed = comments.trim()
    if (d.kind === DECISION.REJECT && !trimmed) {
      onDone?.({ severity: 'warning', msg: 'Please add remarks explaining the rejection.' })
      return
    }
    if (d.kind === DECISION.REVERT && !trimmed) {
      onDone?.({ severity: 'warning', msg: 'Please add remarks telling GT what needs to change.' })
      return
    }
    setPendingDecision(d)
  }, [comments, onDone])

  const confirm = useCallback(async () => {
    const d = pendingDecision
    if (!d) return
    if (!appraisalId) {
      onDone?.({ severity: 'error', msg: 'Appraisal record not loaded yet — try again in a moment.' })
      return
    }
    const snapshot = formRef?.current
    if (!snapshot || !snapshot.seeded) {
      onDone?.({ severity: 'warning', msg: 'Form is still loading — please wait a moment.' })
      return
    }
    // Cheap validation gate. DD is technically optional per schema, so
    // this mainly catches typos in the numeric/pattern fields the SDE
    // might have touched. If invalid, light up the inline errors so the
    // reviewer can see which field to fix.
    if (!snapshot.isValid()) {
      snapshot.showAllErrors()
      onDone?.({ severity: 'warning', msg: 'Please fix the highlighted fields before ' + d.label.toLowerCase() + '.' })
      return
    }

    setBusyKind(d.kind)
    try {
      const values = snapshot.values || {}
      // Only APPROVE / REJECT flip `isSidbeApproved`. REVERT leaves the
      // flag untouched — same contract the AppraisalReviewView uses so a
      // "send back" doesn't silently un-approve.
      const isSidbeApproved =
        d.kind === DECISION.APPROVE ? true
        : d.kind === DECISION.REJECT ? false
        : null

      // Atomic PUT: full form snapshot + workflow keys + optional flag.
      // Backend merges (per the appraisal endpoint contract), so DD
      // fields the SDE just typed persist alongside the stage advance
      // and history row.
      const body = {
        ...toAppraisalUpdatePayload(
          { ...values, stageId: d.stageId, stageComments: comments.trim() || undefined },
          iaId,
        ),
        ...(isSidbeApproved != null ? { isSidbeApproved } : null),
      }
      await updateAppraisal(appraisalId, body)

      // Upload any pending file inputs the SDE picked in the DD section.
      const pending = snapshot.collectFiles ? snapshot.collectFiles() : []
      if (pending.length) {
        const tagged = pending.map(({ file, slug }) => encodeFilename(file, slug))
        try {
          await uploadFilesBatch(iaId, 'registration', iaId, tagged)
        } catch (err) {
          onDone?.({
            severity: 'warning',
            msg: `Decision recorded — but ${pending.length} file${pending.length === 1 ? '' : 's'} failed to upload (${err.message || 'unknown error'}).`,
          })
        }
      }

      // Invalidate every surface that reads off this appraisal / IA so
      // the workspace refetches and the next render shows the new state.
      qc.invalidateQueries({ queryKey: keys.appraisals.detail(appraisalId), refetchType: 'all' })
      qc.invalidateQueries({ queryKey: keys.appraisals.byRegistration(iaId), refetchType: 'all' })
      qc.invalidateQueries({ queryKey: keys.appraisals.lists(), refetchType: 'all' })
      qc.invalidateQueries({ queryKey: keys.ias.detail(iaId), refetchType: 'all' })
      qc.invalidateQueries({ queryKey: keys.ias.stageHistory(iaId) })
      qc.invalidateQueries({ queryKey: keys.ias.lists(), refetchType: 'all' })

      onRecorded?.({ kind: d.kind, label: d.label, comments: comments.trim() })
      onDone?.({ severity: 'success', msg: `${d.label} · recorded.` })
      setComments('')
      setPendingDecision(null)
    } catch (err) {
      onDone?.({ severity: 'error', msg: err?.message || 'Failed to record decision.' })
    } finally {
      setBusyKind(null)
    }
  }, [pendingDecision, comments, formRef, appraisalId, iaId, onRecorded, onDone, qc])

  return (
    <>
      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          mt: 3,
          background: theme.palette.background.paper,
          borderTop: 1,
          borderColor: alpha(theme.palette.text.primary, 0.09),
          px: { xs: 2.5, md: 4 },
          py: 2.25,
          zIndex: 10,
          boxShadow: '0 -6px 20px rgba(0,0,0,0.06)',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={{ xs: 1.5, md: 3 }}
          alignItems={{ md: 'center' }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: theme.palette.text.disabled,
                mb: 0.5,
              }}
            >
              Approval remarks
            </Typography>
            <TextField
              value={comments}
              onChange={(e) => setComments(e.target.value.slice(0, 1000))}
              placeholder="Optional — required if rejecting or sending back to GT"
              fullWidth
              size="small"
              multiline
              minRows={1}
              maxRows={4}
              slotProps={{
                input: {
                  sx: {
                    borderRadius: 1.5,
                    background: alpha(theme.palette.text.primary, 0.025),
                    '& fieldset': { borderColor: alpha(theme.palette.text.primary, 0.12) },
                  },
                },
              }}
            />
          </Box>
          <Stack
            direction="row"
            spacing={1}
            sx={{ flexShrink: 0, alignSelf: { xs: 'flex-end', md: 'auto' } }}
          >
            {decisions.map((d) => {
              const busy = busyKind === d.kind
              const disabled = busyKind !== null
              const variant = d.kind === DECISION.APPROVE ? 'contained' : 'outlined'
              const color =
                d.kind === DECISION.APPROVE ? 'success'
                : d.kind === DECISION.REJECT ? 'error'
                : 'warning'
              return (
                <Button
                  key={d.kind + d.to}
                  onClick={() => requestDecision(d)}
                  disabled={disabled}
                  variant={variant}
                  color={color}
                  disableElevation
                  startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    minWidth: 148,
                    py: 1,
                    borderRadius: 1.5,
                  }}
                >
                  {busy ? 'Recording…' : d.label}
                </Button>
              )
            })}
          </Stack>
        </Stack>
      </Box>

      <ConfirmDialog
        pending={pendingDecision}
        iaName={iaName}
        comments={comments}
        busy={busyKind !== null}
        onCancel={() => (busyKind === null ? setPendingDecision(null) : null)}
        onConfirm={confirm}
      />
    </>
  )
})

// ── Confirm dialog ─────────────────────────────────────────────────────
function ConfirmDialog({ pending, iaName, comments, busy, onCancel, onConfirm }) {
  const theme = useTheme()
  if (!pending) return null
  const kind = pending.kind
  const tone = toneFor(kind, theme)
  const title = confirmTitle(kind, iaName)
  const body = confirmBody(kind)
  const buttonColor =
    kind === DECISION.APPROVE ? 'success'
    : kind === DECISION.REJECT ? 'error'
    : 'warning'
  return (
    <Dialog open onClose={busy ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 13.5, color: theme.palette.text.secondary, mb: 1.5 }}>
          {body}
        </DialogContentText>
        {comments && (
          <Box
            sx={{
              border: 1,
              borderColor: alpha(tone.main, 0.35),
              background: alpha(tone.main, 0.06),
              borderRadius: 1.25,
              px: 1.5,
              py: 1,
            }}
          >
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: tone.dark, mb: 0.25 }}>
              Your remarks
            </Typography>
            <Typography sx={{ fontSize: 13, color: theme.palette.text.primary, whiteSpace: 'pre-wrap' }}>
              {comments}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={busy} color="inherit" sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={busy}
          variant="contained"
          color={buttonColor}
          disableElevation
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          {busy ? 'Recording…' : confirmAction(kind)}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Post-decision banner ────────────────────────────────────────────────
function RecordedBanner({ kind, label, comments }) {
  const theme = useTheme()
  const tone = toneFor(kind, theme)
  const title =
    kind === DECISION.APPROVE ? 'Approval recorded'
    : kind === DECISION.REJECT ? 'Rejection recorded'
    : kind === DECISION.REVERT ? 'L2 sent back to GT'
    : 'Decision recorded'
  return (
    <Box
      sx={{
        mt: 2,
        borderRadius: 2,
        border: 1,
        borderColor: alpha(tone.main, 0.4),
        background: alpha(tone.main, 0.08),
        px: { xs: 3, md: 4 },
        py: { xs: 2.25, md: 2.75 },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <CheckCircleRoundedIcon sx={{ color: tone.dark, fontSize: 26 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: { xs: 17, md: 19 }, fontWeight: 800, color: tone.dark, letterSpacing: '-0.01em' }}>
            {title}
          </Typography>
          <Typography sx={{ mt: 0.25, fontSize: 13, color: theme.palette.text.secondary }}>
            {label} · workflow refreshing…
          </Typography>
        </Box>
      </Stack>
      {comments && (
        <Typography sx={{ mt: 1.5, fontSize: 13, color: theme.palette.text.secondary, whiteSpace: 'pre-wrap' }}>
          Remarks: {comments}
        </Typography>
      )}
    </Box>
  )
}

// ── Hero (same visual language as AppraisalReviewView) ─────────────────
function ReviewHero({ pill, title, submittedBy, submittedOn, filesCount }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        mt: 2,
        borderRadius: 2,
        border: 1,
        borderColor: alpha(theme.palette.info.main, 0.35),
        background: alpha(theme.palette.info.main, 0.06),
        px: { xs: 3, md: 4 },
        py: { xs: 2.5, md: 3 },
      }}
    >
      <Typography sx={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.palette.info.dark }}>
        {pill}
      </Typography>
      <Typography sx={{ mt: 0.75, fontSize: { xs: 22, md: 26 }, fontWeight: 800, color: theme.palette.text.primary, letterSpacing: '-0.02em' }}>
        {title}
      </Typography>
      <Stack direction="row" spacing={3} flexWrap="wrap" sx={{ mt: 1.5 }}>
        <Metric label="Filed by" value={submittedBy || '—'} />
        <Metric label="Received" value={submittedOn ? formatDate(submittedOn) : '—'} />
        {filesCount > 0 && <Metric label="Documents" value={`${filesCount} attached`} />}
      </Stack>
    </Box>
  )
}

function Metric({ label, value }) {
  const theme = useTheme()
  return (
    <Box>
      <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.palette.text.disabled }}>
        {label}
      </Typography>
      <Typography sx={{ mt: 0.25, fontSize: 13.5, fontWeight: 600, color: theme.palette.text.primary }}>
        {value}
      </Typography>
    </Box>
  )
}

// ── Copy helpers ───────────────────────────────────────────────────────
function toneFor(kind, theme) {
  if (kind === DECISION.APPROVE) return theme.palette.success
  if (kind === DECISION.REJECT) return theme.palette.error
  return theme.palette.warning
}
function confirmTitle(kind, iaName) {
  const suffix = iaName ? ` for ${iaName}?` : '?'
  if (kind === DECISION.APPROVE) return `Approve L2${suffix}`
  if (kind === DECISION.REJECT) return `Reject L2${suffix}`
  if (kind === DECISION.REVERT) return `Send L2 back to GT${suffix}`
  return `Confirm decision${suffix}`
}
function confirmBody(kind) {
  if (kind === DECISION.APPROVE) return 'This saves the review notes you filled in above, records SDE approval, and advances the workflow to Cluster Expert comments. Recorded in the audit trail.'
  if (kind === DECISION.REJECT) return 'This saves your review notes, marks the L2 as rejected, and closes the workflow. Your remarks will be shown to GT.'
  if (kind === DECISION.REVERT) return 'This saves your review notes and sends the L2 back to GT for revisions. GT will be able to edit + resubmit — your remarks below are shown to them so they know what to fix.'
  return 'Recorded in the audit trail.'
}
function confirmAction(kind) {
  if (kind === DECISION.APPROVE) return 'Confirm approval'
  if (kind === DECISION.REJECT) return 'Confirm rejection'
  if (kind === DECISION.REVERT) return 'Send back to GT'
  return 'Confirm'
}
function formatDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.valueOf())) return String(iso)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
