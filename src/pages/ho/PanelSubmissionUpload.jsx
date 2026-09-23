import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Alert, Box, Button, Chip, CircularProgress, Snackbar, Stack, Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import SaveIcon from '@mui/icons-material/Save'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { PageHeader } from '../../components/shared'
import { useBse, useUpdateBse } from '../../queries'
import { uploadFile, downloadFile } from '../../apis/files'
import { toUpdatePayload } from '../../apis/bseRecommendations'

// PanelSubmissionUpload
// ────────────────────────────────────────────────────────────────────────
// Standalone per-candidate page. Shows only the panel-approval-letter
// field + a compact context strip (candidate name, IA, committee
// decision) so the uploader confirms they're on the right record. No
// candidate profile, no recommendation history, no onboarding block —
// that's HoBseReview's job. This page exists so someone other than the
// HO Maker can complete the upload step without needing (or being
// distracted by) the rest of the review workspace.

const PANEL_ACCEPT = '.pdf,.doc,.docx,.png,.jpg,.jpeg'

export default function PanelSubmissionUpload() {
  const { uuid } = useParams()
  const navigate = useNavigate()
  const bseQ = useBse(uuid)
  const updateM = useUpdateBse()
  const dto = bseQ.data
  const [pending, setPending] = useState('') // filename waiting to be saved
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const inputRef = useRef(null)

  const savedFilename = dto?.committeeMom || ''
  const currentFilename = pending || savedFilename
  const dirty = pending && pending !== savedFilename

  const committeeReady = !!dto?.committeeRecommendation

  const onFileChosen = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (inputRef.current) inputRef.current.value = ''
    if (!file) return
    if (!uuid) return
    setBusy(true)
    try {
      const res = await uploadFile(uuid, 'bse', uuid, file)
      const filename = res?.filename || file.name
      setPending(filename)
      setToast({ severity: 'success', msg: `Uploaded ${filename}. Click "Save panel submission" to attach it.` })
    } catch (err) {
      setToast({ severity: 'error', msg: err?.message || 'Upload failed.' })
    } finally {
      setBusy(false)
    }
  }, [uuid])

  const open = useCallback(async () => {
    if (!currentFilename || !uuid) return
    setDownloading(true)
    try { await downloadFile(uuid, 'bse', uuid, currentFilename) }
    catch (err) { setToast({ severity: 'error', msg: err?.message || 'Could not open the file.' }) }
    finally { setDownloading(false) }
  }, [uuid, currentFilename])

  const save = useCallback(async () => {
    if (!dirty || !uuid) return
    setSaving(true)
    try {
      const patch = toUpdatePayload({ committeeMom: pending })
      await updateM.mutateAsync({ id: uuid, patch })
      setPending('')
      setToast({ severity: 'success', msg: 'Panel approval letter attached to the record.' })
    } catch (err) {
      setToast({ severity: 'error', msg: err?.message || 'Failed to save.' })
    } finally {
      setSaving(false)
    }
  }, [dirty, uuid, pending, updateM])

  const pick = () => inputRef.current?.click()

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', pb: 6 }}>
      <Button
        component={Link}
        to="/sde/panel-submissions"
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 1, textTransform: 'none', color: 'text.secondary' }}
      >
        Panel Submissions
      </Button>

      <PageHeader
        overline="BSE · Panel submission"
        title="Upload panel approval letter"
        subtitle="Attach the signed letter for this candidate. This is the only step handled on this page."
      />

      {bseQ.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : bseQ.error ? (
        <Alert severity="error" sx={{ mt: 2 }}>{bseQ.error.message || 'Failed to load candidate.'}</Alert>
      ) : !dto ? (
        <Alert severity="warning" sx={{ mt: 2 }}>Candidate not found.</Alert>
      ) : !committeeReady ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          The committee hasn't recorded a decision yet — the panel approval letter can't be uploaded until they do.
        </Alert>
      ) : (
        <Stack spacing={2} sx={{ mt: 2 }}>
          <CandidateStrip dto={dto} />
          <UploadCard
            currentFilename={currentFilename}
            savedFilename={savedFilename}
            busy={busy}
            downloading={downloading}
            saving={saving}
            dirty={!!dirty}
            onPick={pick}
            onOpen={open}
            onSave={save}
          />
          <input ref={inputRef} type="file" hidden accept={PANEL_ACCEPT} onChange={onFileChosen} />
        </Stack>
      )}

      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert severity={toast.severity} onClose={() => setToast(null)} variant="filled">
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  )
}

// Compact context strip so the uploader confirms they're on the right
// candidate — deliberately terse; the full profile is on HoBseReview.
function CandidateStrip({ dto }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        borderRadius: 2, border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        bgcolor: '#fff',
        px: 3, py: 2,
      }}
    >
      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.palette.text.disabled }}>
        Candidate
      </Typography>
      <Typography sx={{ mt: 0.25, fontSize: 18, fontWeight: 700, letterSpacing: '-0.005em' }}>
        {dto.bseName || '—'}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
        {dto.industryAssociationName && (
          <Chip
            size="small"
            label={<><Box component="span" sx={{ color: theme.palette.text.disabled, mr: 0.5 }}>IA</Box>{dto.industryAssociationName}</>}
            sx={{ height: 22, fontSize: 12, bgcolor: alpha(theme.palette.text.primary, 0.04), '.MuiChip-label': { px: 1 } }}
          />
        )}
        <Chip
          size="small"
          color={dto.committeeRecommendation === 'Recommended' ? 'success' : 'default'}
          variant="outlined"
          label={<><Box component="span" sx={{ color: theme.palette.text.disabled, mr: 0.5 }}>Committee</Box>{dto.committeeRecommendation}</>}
          sx={{ height: 22, fontSize: 12, fontWeight: 600, '.MuiChip-label': { px: 1 } }}
        />
        {dto.committeeDate && (
          <Typography sx={{ fontSize: 12, color: theme.palette.text.disabled }}>
            · {dto.committeeDate}
          </Typography>
        )}
      </Stack>
    </Box>
  )
}

function UploadCard({
  currentFilename, savedFilename, busy, downloading, saving, dirty,
  onPick, onOpen, onSave,
}) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        borderRadius: 2, border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        bgcolor: '#fff',
        px: 3, py: 2.5,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700 }}>Panel approval letter</Typography>
        {savedFilename && !dirty && (
          <Chip size="small" color="success" icon={<CheckCircleOutlineIcon />} label="Uploaded" sx={{ fontWeight: 600 }} />
        )}
        {dirty && (
          <Chip size="small" color="warning" label="Unsaved" sx={{ fontWeight: 600 }} />
        )}
      </Stack>

      {currentFilename ? (
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{
            p: 1.25, borderRadius: 1,
            border: 1, borderColor: alpha(theme.palette.text.primary, 0.14),
            bgcolor: alpha(theme.palette.primary.main, 0.04),
          }}
        >
          <DescriptionOutlinedIcon sx={{ fontSize: 20, color: 'primary.main', flexShrink: 0 }} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              sx={{
                fontSize: 13.5, fontWeight: 600, color: 'text.primary',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
              title={currentFilename}
            >
              {currentFilename}
            </Typography>
          </Box>
          <Button size="small" onClick={onOpen} disabled={downloading} sx={{ textTransform: 'none' }}>
            {downloading ? '…' : 'Open'}
          </Button>
          <Button size="small" onClick={onPick} disabled={busy} sx={{ textTransform: 'none' }}>
            {busy ? 'Uploading…' : 'Replace'}
          </Button>
        </Stack>
      ) : (
        <Button
          variant="outlined"
          startIcon={busy ? <CircularProgress size={14} /> : <UploadFileOutlinedIcon />}
          onClick={onPick}
          disabled={busy}
          sx={{ textTransform: 'none' }}
          fullWidth
        >
          {busy ? 'Uploading…' : 'Upload panel approval letter'}
        </Button>
      )}
      <Typography sx={{ mt: 1, fontSize: 12, color: 'text.disabled' }}>
        PDF / Word / image. Once uploaded, click Save to attach it to this candidate's record.
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mt: 2.5 }} justifyContent="flex-end">
        <Button
          variant="contained"
          disableElevation
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={onSave}
          disabled={!dirty || saving}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          {saving ? 'Saving…' : 'Save panel submission'}
        </Button>
      </Stack>
    </Box>
  )
}
