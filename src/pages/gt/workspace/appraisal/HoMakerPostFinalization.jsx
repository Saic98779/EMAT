import { useCallback, useRef, useState } from 'react'
import {
  Alert, Box, Button, CircularProgress, Divider, FormControl, FormControlLabel,
  Radio, RadioGroup, Snackbar, Stack, TextField, Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded'
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded'
import { useQueryClient } from '@tanstack/react-query'

import { updateAppraisal } from '../../../../apis/industryAssociationAppraisals'
import { uploadFilesBatch, viewFile } from '../../../../apis/files'
import { encodeFilename, decodeFilename } from '../../../../fileFieldLabels'
import { stageIdOf, stageIdForStage } from '../../../../apis/stageActions'
import { keys, useAllStages, useFilesByIa } from '../../../../queries'
import ViewFileButton from '../../../../components/ViewFileButton'

// HoMakerPostFinalization
// ────────────────────────────────────────────────────────────────────────
// Shown by AppraisalTab when the IA is at
// `DETAILED_APPRAISAL_APPROVAL_BY_HO_CHECKER` and the viewer is
// SIDBI_HO_MAKER. Per UAT 2026-09-28 §5.viii / §5.ix, once HO Checker
// finalises the L2 appraisal, HO Maker gets a post-finalisation surface
// with:
//   • Generate PDF of the appraisal   (placeholder — backend not wired)
//   • Sanction Marking                { SANCTIONED | REJECTED | DEFERRED }
//   • Approved file upload            (PDF, files-controller)
//   • Committee comments              (up to 2000 chars, `committeeComments`)
//
// Workflow advances (client confirmed 2026-09-28):
//   • Deferred    → back to HO Maker's decision point (stage 14,
//                    DETAILED_APPRAISAL_CE_COMMENTS_SUBMITTED)
//   • Sanctioned  → forward to DOCUMENTATION_OF_IA (stage 19)
//   • Rejected    → forward to DOCUMENTATION_OF_IA too — closes the
//                    active workflow; rejection reason lives in
//                    `sanctionMarking` + `committeeComments`.
//
// Panel-letter upload consolidated from HO Checker → HO Maker on this
// screen (client 2026-09-28). Same `pennalApprovalLetter` DTO column
// and `panel_approval_letter` files-controller slug so an already
// uploaded letter round-trips cleanly.
const APPROVED_FILE_SLUG = 'panel_approval_letter'

const SANCTIONS = [
  { value: 'SANCTIONED', label: 'Sanctioned', tone: 'success' },
  { value: 'REJECTED',   label: 'Rejected',   tone: 'error' },
  { value: 'DEFERRED',   label: 'Deferred',   tone: 'warning' },
]

export default function HoMakerPostFinalization({ iaId, iaName, appraisal }) {
  const theme = useTheme()
  const qc = useQueryClient()
  const stagesQ = useAllStages()
  const filesQ = useFilesByIa(iaId)
  const inputRef = useRef(null)

  const [sanction, setSanction] = useState(appraisal?.sanctionMarking || '')
  const [comments, setComments] = useState(appraisal?.committeeComments || '')
  const [pending, setPending] = useState(null)   // File the user just picked
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)

  const existing = (filesQ.data || []).find((f) => {
    const name = f?.filename
    return typeof name === 'string' && name.startsWith(`${APPROVED_FILE_SLUG}__`)
  })

  const onPick = useCallback(() => inputRef.current?.click(), [])
  const onFileChange = useCallback((e) => {
    const file = e.target.files && e.target.files[0]
    if (file) setPending(file)
    e.target.value = ''
  }, [])

  const onGeneratePdf = useCallback(() => {
    setToast({ severity: 'info', msg: 'PDF generation is still under development — coming soon.' })
  }, [])

  const onSave = useCallback(async () => {
    if (!appraisal?.id) {
      setToast({ severity: 'error', msg: 'Appraisal record not loaded — try again.' })
      return
    }
    if (!sanction) {
      setToast({ severity: 'warning', msg: 'Pick a sanction outcome before saving.' })
      return
    }
    if ((sanction === 'REJECTED' || sanction === 'DEFERRED') && !comments.trim()) {
      setToast({ severity: 'warning', msg: 'Committee comments are required to reject or defer.' })
      return
    }
    setBusy(true)
    try {
      // Workflow target by outcome. Deferred bounces back to HO Maker's
      // decision stage (CE_COMMENTS_SUBMITTED); Sanctioned + Rejected
      // both advance to DOCUMENTATION_OF_IA — the active appraisal
      // workflow ends there and the rejection reason (if any) is
      // preserved on the appraisal DTO via sanctionMarking +
      // committeeComments.
      // Deferred → sub-stage under DETAILED_APPRAISAL (subStage lookup).
      // Sanctioned / Rejected → top-level DOCUMENTATION_OF_IA row, which
      // the backend emits with `subStage: null` — `stageIdOf` matches on
      // subStage and would silently return null, so we fall back to the
      // by-stage lookup for that leg. That's the bug that made the toast
      // read "advanced to Documentation" while `currentStage` never moved.
      const targetStageId = sanction === 'DEFERRED'
        ? stageIdOf(stagesQ.data, 'DETAILED_APPRAISAL_CE_COMMENTS_SUBMITTED')
        : stageIdForStage(stagesQ.data, 'DOCUMENTATION_OF_IA')
      // Missing stageId → the PUT would only write sanctionMarking and
      // leave `currentStage` untouched (silent no-op the user can't see).
      // Fail loud instead so the operator retries once the stages master
      // finishes loading.
      if (targetStageId == null) {
        setToast({ severity: 'error', msg: 'Could not resolve the target workflow stage. Please refresh and try again.' })
        setBusy(false)
        return
      }
      const stageComment = comments.trim()
        || (sanction === 'DEFERRED'  ? 'Deferred by committee for review.'
          : sanction === 'SANCTIONED' ? 'Sanctioned by committee.'
          : 'Rejected by committee.')
      // Upload the approved file FIRST so its filename can ride the
      // same PUT that records the committee decision — keeps the DTO
      // + file in one atomic HO Maker save.
      let approvedFileName = null
      if (pending) {
        const tagged = encodeFilename(pending, APPROVED_FILE_SLUG)
        try {
          await uploadFilesBatch(iaId, 'registration', iaId, [tagged])
          approvedFileName = tagged.name
        } catch (err) {
          setToast({ severity: 'warning', msg: `Uploading the approved file failed (${err.message || 'unknown error'}). Please try again.` })
          setBusy(false)
          return
        }
      }
      const body = {
        sanctionMarking: sanction,
        committeeComments: comments.trim() || null,
        // Panel-letter filename — reuses the existing `pennalApprovalLetter`
        // DTO column (previously written by HO Checker's flow). Only
        // sent when HO Maker actually picked a new file.
        ...(approvedFileName ? { pennalApprovalLetter: approvedFileName } : null),
        ...(targetStageId != null ? { stageId: targetStageId, stageComments: stageComment } : null),
      }
      await updateAppraisal(appraisal.id, body)

      qc.invalidateQueries({ queryKey: keys.appraisals.detail(appraisal.id), refetchType: 'all' })
      qc.invalidateQueries({ queryKey: keys.appraisals.byRegistration(iaId), refetchType: 'all' })
      qc.invalidateQueries({ queryKey: keys.ias.detail(iaId), refetchType: 'all' })
      qc.invalidateQueries({ queryKey: keys.ias.stageHistory(iaId), refetchType: 'all' })
      qc.invalidateQueries({ queryKey: keys.files.byScope(iaId, 'registration', iaId), refetchType: 'all' })
      setPending(null)
      const msg = sanction === 'DEFERRED'
        ? 'Deferred — returned to HO Maker for review.'
        : sanction === 'SANCTIONED' ? 'Sanctioned — advanced to Documentation.'
        : 'Rejected — recorded and closed.'
      setToast({ severity: 'success', msg })
    } catch (err) {
      setToast({ severity: 'error', msg: err?.message || 'Failed to save committee decision.' })
    } finally {
      setBusy(false)
    }
  }, [appraisal?.id, sanction, comments, pending, iaId, stagesQ.data, qc])

  const existingLabel = existing ? decodeFilename(existing.filename).name : null

  return (
    <>
      {/* Hero — L2 finalised */}
      <Box
        sx={{
          mt: 2,
          borderRadius: 2,
          border: 1,
          borderColor: alpha(theme.palette.success.main, 0.4),
          background: alpha(theme.palette.success.main, 0.08),
          px: { xs: 3, md: 4 },
          py: { xs: 2.5, md: 3 },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <CheckCircleRoundedIcon sx={{ color: theme.palette.success.dark, fontSize: 28 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: { xs: 17, md: 20 }, fontWeight: 800, color: theme.palette.success.dark, letterSpacing: '-0.01em' }}>
              L2 appraisal finalised{iaName ? ` for ${iaName}` : ''}
            </Typography>
            <Typography sx={{ mt: 0.25, fontSize: 13.5, color: theme.palette.text.secondary }}>
              HO Checker has signed off. Record the committee&rsquo;s decision below and, optionally, generate a PDF of the appraisal for the committee packet.
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* PDF generation (placeholder) */}
      <Box
        sx={{
          mt: 3, p: 2.5, borderRadius: 2,
          border: 1, borderColor: alpha(theme.palette.text.primary, 0.1),
          background: '#fff',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.palette.text.disabled }}>
              Committee packet
            </Typography>
            <Typography sx={{ mt: 0.25, fontSize: 15, fontWeight: 700, color: theme.palette.text.primary }}>
              Generate appraisal PDF
            </Typography>
            <Typography sx={{ mt: 0.25, fontSize: 12.5, color: theme.palette.text.disabled }}>
              Still under development — a snapshot of every filled section will export as a signed PDF.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            color="primary"
            disableElevation
            startIcon={<PictureAsPdfRoundedIcon />}
            onClick={onGeneratePdf}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5 }}
          >
            Generate PDF
          </Button>
        </Stack>
      </Box>

      {/* Sanction marking + committee comments + approved file */}
      <Box
        sx={{
          mt: 3, p: { xs: 2.5, md: 3 }, borderRadius: 2,
          border: 1, borderColor: alpha(theme.palette.text.primary, 0.1),
          background: '#fff',
        }}
      >
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.palette.text.disabled }}>
          Committee outcome
        </Typography>
        <Typography sx={{ mt: 0.25, fontSize: 17, fontWeight: 700, color: theme.palette.text.primary }}>
          Sanction marking
        </Typography>
        <Typography sx={{ mt: 0.5, fontSize: 13, color: theme.palette.text.secondary }}>
          Pick the committee&rsquo;s outcome. <b>Deferred</b> sends the appraisal back to HO Maker&rsquo;s decision step so it can be revised.
        </Typography>

        <FormControl sx={{ mt: 2 }}>
          <RadioGroup row value={sanction} onChange={(e) => setSanction(e.target.value)}>
            {SANCTIONS.map((s) => (
              <FormControlLabel
                key={s.value}
                value={s.value}
                control={<Radio color={s.tone} />}
                label={<Typography sx={{ fontWeight: 600 }}>{s.label}</Typography>}
                sx={{ mr: 3 }}
              />
            ))}
          </RadioGroup>
        </FormControl>

        <Divider sx={{ my: 2.5 }} />

        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.palette.text.disabled }}>
          Committee comments
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={3}
          maxRows={8}
          size="small"
          placeholder="Required to reject or defer. Optional on sanction."
          value={comments}
          onChange={(e) => setComments(e.target.value.slice(0, 2000))}
          helperText={`${comments.length} / 2000`}
          sx={{ mt: 1 }}
        />

        <Divider sx={{ my: 2.5 }} />

        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.palette.text.disabled }}>
          Approved file
        </Typography>
        <Typography sx={{ mt: 0.25, fontSize: 15, fontWeight: 700, color: theme.palette.text.primary }}>
          Upload the signed committee approval (PDF)
        </Typography>
        <Typography sx={{ mt: 0.5, fontSize: 13, color: theme.palette.text.secondary }}>
          Committee-signed sanction document. Uploaded against this IA on the backend.
        </Typography>

        {existing && !pending && (
          <Box sx={{ mt: 1.75, p: 1.5, borderRadius: 1.5, border: 1, borderColor: alpha(theme.palette.text.primary, 0.09), bgcolor: alpha(theme.palette.text.primary, 0.02) }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: theme.palette.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={existingLabel}>
                  {existingLabel}
                </Typography>
                <Typography sx={{ fontSize: 12, color: theme.palette.text.disabled }}>Uploaded on file</Typography>
              </Box>
              <ViewFileButton onView={() => viewFile(iaId, 'registration', iaId, existing.filename)} text />
            </Stack>
          </Box>
        )}
        {pending && (
          <Box sx={{ mt: 1.75, p: 1.5, borderRadius: 1.5, border: 1, borderColor: alpha(theme.palette.primary.main, 0.35), bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: theme.palette.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pending.name}>
                  {pending.name}
                </Typography>
                <Typography sx={{ fontSize: 12, color: theme.palette.text.disabled }}>Ready to upload · {formatBytes(pending.size)}</Typography>
              </Box>
              <Button size="small" onClick={() => setPending(null)} disabled={busy} sx={{ textTransform: 'none', color: 'text.secondary' }}>
                Change
              </Button>
            </Stack>
          </Box>
        )}
        <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={onFileChange} />
        <Button
          variant="outlined"
          startIcon={<CloudUploadRoundedIcon />}
          onClick={onPick}
          disabled={busy}
          sx={{ mt: 2, textTransform: 'none', fontWeight: 600, borderRadius: 1.5 }}
        >
          {existing ? 'Replace file' : 'Choose PDF'}
        </Button>

        <Divider sx={{ my: 2.5 }} />

        <Stack direction="row" justifyContent="flex-end">
          <Button
            variant="contained"
            color="success"
            disableElevation
            onClick={onSave}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ textTransform: 'none', fontWeight: 700, minWidth: 180, borderRadius: 1.5 }}
          >
            {busy ? 'Saving…' : 'Record committee decision'}
          </Button>
        </Stack>
      </Box>

      <Snackbar
        open={!!toast}
        autoHideDuration={5000}
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

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
