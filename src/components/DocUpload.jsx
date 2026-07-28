import { useCallback, useEffect, useState } from 'react'
import {
  Card, CardContent, Stack, Typography, Button, Chip, Box, Avatar,
  CircularProgress, Alert, IconButton, Tooltip,
} from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import DownloadIcon from '@mui/icons-material/Download'
import { listFiles, uploadFile, deleteFile, downloadFile } from '../apis/files'

// Attach supporting documents (Invoice, attendance, etc.).
//
// Two modes:
// 1. Backed by the `file-controller` API when `registrationUuid` is provided.
//    Uploads, listing, delete, and download all go through the backend and the
//    server-side UploadedFileResponse[] is the source of truth.
// 2. Local-only fallback (no `registrationUuid`) — keeps the original demo
//    behaviour of tracking picked file names in a parent-owned array. Used
//    while a parent record is still being drafted and has no UUID yet.
export default function DocUpload({
  docs,
  setDocs,
  registrationUuid = null,
  accent = 'primary',
}) {
  const apiMode = Boolean(registrationUuid)

  // ── API-mode state ────────────────────────────────────────────────────────
  const [files, setFiles] = useState([])   // UploadedFileResponse[]
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)  // upload/delete in flight
  const [error, setError] = useState('')

  const refresh = useCallback(async (signal) => {
    if (!apiMode) return
    setLoading(true)
    setError('')
    try {
      const data = await listFiles(registrationUuid, { signal })
      setFiles(Array.isArray(data) ? data : [])
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message || 'Failed to load files')
    } finally {
      setLoading(false)
    }
  }, [apiMode, registrationUuid])

  useEffect(() => {
    if (!apiMode) return
    const ctrl = new AbortController()
    refresh(ctrl.signal)
    return () => ctrl.abort()
  }, [apiMode, refresh])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const onPick = async (e) => {
    const picked = Array.from(e.target.files || [])
    e.target.value = ''
    if (!picked.length) return

    if (!apiMode) {
      setDocs?.((prev) => [...prev, ...picked.map((f) => f.name)])
      return
    }

    setBusy(true)
    setError('')
    try {
      const uploaded = []
      for (const f of picked) {
        const res = await uploadFile(registrationUuid, f)
        if (res) uploaded.push(res)
      }
      // Trust the returned records, but re-fetch to stay canonical.
      setFiles((prev) => mergeByFilename(prev, uploaded))
      await refresh()
    } catch (err) {
      setError(err.message || 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (idx, item) => {
    if (!apiMode) {
      setDocs?.((prev) => prev.filter((_, i) => i !== idx))
      return
    }
    setBusy(true)
    setError('')
    try {
      await deleteFile(registrationUuid, item.filename)
      setFiles((prev) => prev.filter((f) => f.filename !== item.filename))
    } catch (err) {
      setError(err.message || 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const download = async (item) => {
    try {
      await downloadFile(registrationUuid, item.filename)
    } catch (err) {
      setError(err.message || 'Download failed')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const items = apiMode
    ? files.map((f) => ({ key: f.id ?? f.filename, label: f.filename, meta: f }))
    : (docs || []).map((name, i) => ({ key: `${name}-${i}`, label: name, meta: null }))

  return (
    <Card sx={{ overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" spacing={1.5}
        sx={{ px: 2.5, py: 1.25, bgcolor: (t) => `${t.palette[accent].main}14`, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Avatar sx={{ bgcolor: `${accent}.main`, color: '#fff', width: 28, height: 28 }}><UploadFileIcon sx={{ fontSize: 18 }} /></Avatar>
        <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>Supporting Documents</Typography>
        {apiMode && (loading || busy) && <CircularProgress size={18} />}
      </Stack>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Attach the Invoice and any supporting files (PDF, images, spreadsheets).
        </Typography>

        <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} disabled={busy}>
          {busy ? 'Uploading…' : 'Attach documents'}
          <input type="file" hidden multiple onChange={onPick} />
        </Button>

        {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {items.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
            {items.map((it, i) => (
              <Chip
                key={it.key}
                icon={<DescriptionOutlinedIcon />}
                label={apiMode ? `${it.label}${it.meta?.size ? ` · ${formatSize(it.meta.size)}` : ''}` : it.label}
                onDelete={() => remove(i, it.meta ?? { filename: it.label })}
                deleteIcon={apiMode ? undefined : undefined}
                variant="outlined"
                onClick={apiMode ? () => download(it.meta) : undefined}
                sx={apiMode ? { cursor: 'pointer' } : undefined}
              />
            ))}
          </Box>
        )}

        {apiMode && items.length > 0 && (
          <Tooltip title="Tip: click a file to download">
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1.5, color: 'text.secondary', fontSize: 12 }}>
              <DownloadIcon fontSize="inherit" /> Click any file to download
            </Box>
          </Tooltip>
        )}
      </CardContent>
    </Card>
  )
}

function mergeByFilename(prev, incoming) {
  const byName = new Map(prev.map((f) => [f.filename, f]))
  for (const f of incoming) byName.set(f.filename, f)
  return Array.from(byName.values())
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
