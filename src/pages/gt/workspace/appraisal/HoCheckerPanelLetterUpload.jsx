import { useCallback, useRef, useState } from 'react'
import {
  Alert, Box, Button, CircularProgress, Snackbar, Stack, Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded'
import { useQueryClient } from '@tanstack/react-query'

import { updateAppraisal } from '../../../../apis/industryAssociationAppraisals'
import { uploadFilesBatch, viewFile } from '../../../../apis/files'
import { encodeFilename, decodeFilename } from '../../../../fileFieldLabels'
import { keys, useFilesByIa } from '../../../../queries'
import ViewFileButton from '../../../../components/ViewFileButton'

// HoCheckerPanelLetterUpload
// ────────────────────────────────────────────────────────────────────────
// Shown by AppraisalTab when the IA is at
// `DETAILED_APPRAISAL_APPROVAL_BY_HO_CHECKER` and the viewer is
// SIDBI_HO_CHECKER. HO Checker approved the L2 on the previous screen;
// this is the dedicated post-approval step where they upload the signed
// panel approval letter.
//
// Backend model:
//   • The filename lives on the appraisal DTO as `pennalApprovalLetter`
//     (backend column spelling — do not rename).
//   • The actual file bytes upload via files-controller keyed by the
//     IA registration id + a `panel_approval_letter` slug prefix.
//
// Upload flow:
//   1. Multipart POST via `uploadFilesBatch` with the tagged filename.
//   2. On success, PUT the appraisal with `pennalApprovalLetter: <name>`.
//   3. Invalidate the IA + appraisal + file queries so the read-back
//      caches refetch and the "already uploaded" state shows on refresh.
const SLUG = 'panel_approval_letter'

export default function HoCheckerPanelLetterUpload({ iaId, iaName, appraisal }) {
  const theme = useTheme()
  const qc = useQueryClient()
  const filesQ = useFilesByIa(iaId)
  const inputRef = useRef(null)
  const [pending, setPending] = useState(null) // File the user just picked
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)

  const existing = (filesQ.data || []).find((f) => {
    const name = f?.filename
    return typeof name === 'string' && name.startsWith(`${SLUG}__`)
  })

  const onPick = useCallback(() => inputRef.current?.click(), [])
  const onChange = useCallback((e) => {
    const file = e.target.files && e.target.files[0]
    if (file) setPending(file)
    e.target.value = ''
  }, [])
  const onClear = useCallback(() => setPending(null), [])

  const onUpload = useCallback(async () => {
    if (!pending || !iaId) return
    setBusy(true)
    try {
      const tagged = encodeFilename(pending, SLUG)
      await uploadFilesBatch(iaId, 'registration', iaId, [tagged])
      // Record the filename on the appraisal so it round-trips even if
      // someone reads the appraisal DTO without the files list.
      if (appraisal?.id) {
        try {
          await updateAppraisal(appraisal.id, { pennalApprovalLetter: tagged.name })
        } catch { /* non-blocking — file is uploaded; DTO write is best-effort */ }
      }
      qc.invalidateQueries({ queryKey: keys.files.byScope(iaId, 'registration', iaId), refetchType: 'all' })
      qc.invalidateQueries({ queryKey: keys.appraisals.byRegistration(iaId), refetchType: 'all' })
      qc.invalidateQueries({ queryKey: keys.ias.detail(iaId), refetchType: 'all' })
      setPending(null)
      setToast({ severity: 'success', msg: 'Panel approval letter uploaded.' })
    } catch (err) {
      setToast({ severity: 'error', msg: err?.message || 'Upload failed. Please try again.' })
    } finally {
      setBusy(false)
    }
  }, [pending, iaId, appraisal?.id, qc])

  const label = existing ? decodeFilename(existing.filename).name : null

  return (
    <>
      {/* Confirmation hero — "Approval recorded". Sets the tone that
          the workflow-level decision is DONE; the letter upload below
          is a separate follow-up action. */}
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
              L2 appraisal approved{iaName ? ` for ${iaName}` : ''}
            </Typography>
            <Typography sx={{ mt: 0.25, fontSize: 13.5, color: theme.palette.text.secondary }}>
              Final HO Checker sign-off recorded. Upload the signed panel approval letter below to complete the workflow.
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* Upload panel */}
      <Box
        sx={{
          mt: 3,
          borderRadius: 2,
          border: 1,
          borderColor: alpha(theme.palette.text.primary, 0.1),
          background: '#fff',
          px: { xs: 3, md: 4 },
          py: { xs: 3, md: 3.5 },
        }}
      >
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.palette.text.disabled }}>
          Panel Approval Letter
        </Typography>
        <Typography sx={{ mt: 0.5, fontSize: 16, fontWeight: 700, color: theme.palette.text.primary }}>
          {existing ? 'Letter on file' : 'Upload the signed panel approval letter'}
        </Typography>
        <Typography sx={{ mt: 0.5, fontSize: 13.5, color: theme.palette.text.secondary }}>
          {existing
            ? 'You can replace it if a corrected version arrives.'
            : 'PDF of the letter signed by the panel committee. Filed against this IA on the backend.'}
        </Typography>

        {existing && !pending && (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: 1.5,
              border: 1,
              borderColor: alpha(theme.palette.text.primary, 0.09),
              bgcolor: alpha(theme.palette.text.primary, 0.02),
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: theme.palette.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={label}>
                  {label}
                </Typography>
                <Typography sx={{ fontSize: 12, color: theme.palette.text.disabled }}>
                  Uploaded on file
                </Typography>
              </Box>
              <ViewFileButton onView={() => viewFile(iaId, 'registration', iaId, existing.filename)} text />
            </Stack>
          </Box>
        )}

        {pending && (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: 1.5,
              border: 1,
              borderColor: alpha(theme.palette.primary.main, 0.35),
              bgcolor: alpha(theme.palette.primary.main, 0.04),
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: theme.palette.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pending.name}>
                  {pending.name}
                </Typography>
                <Typography sx={{ fontSize: 12, color: theme.palette.text.disabled }}>
                  Ready to upload · {formatBytes(pending.size)}
                </Typography>
              </Box>
              <Button size="small" onClick={onClear} disabled={busy} sx={{ textTransform: 'none', color: 'text.secondary' }}>
                Change
              </Button>
            </Stack>
          </Box>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,image/*"
          style={{ display: 'none' }}
          onChange={onChange}
        />

        <Stack direction="row" spacing={1.5} sx={{ mt: 2.5 }}>
          <Button
            variant="outlined"
            startIcon={<CloudUploadRoundedIcon />}
            onClick={onPick}
            disabled={busy}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5 }}
          >
            {existing ? 'Replace letter' : 'Choose file'}
          </Button>
          <Button
            variant="contained"
            color="success"
            disableElevation
            onClick={onUpload}
            disabled={!pending || busy}
            startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5 }}
          >
            {busy ? 'Uploading…' : 'Upload letter'}
          </Button>
        </Stack>
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

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
