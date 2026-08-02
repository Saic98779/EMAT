import { useCallback, useEffect, useState } from 'react'
import {
  Card, CardContent, Stack, Typography, Button, Chip, Box, Avatar,
  CircularProgress, Alert, IconButton, Tooltip,
} from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import DownloadIcon from '@mui/icons-material/Download'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { listFiles, uploadFile, deleteFile, downloadFile } from '../apis/files'
import { decodeFilename } from '../fileFieldLabels'

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
  // Review-only roles (e.g. CLUSTER_EXPERT) may open/download the documents
  // but must not attach new ones or delete what others uploaded.
  readOnly = false,
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
      // Backend response is *usually* a bare `UploadedFileResponse[]`, but
      // Spring Page (`{content: [...]}`) or `{items: []}` / `{files: []}`
      // shapes have shown up too — accept all of them.
      const list = Array.isArray(data)
        ? data
        : (Array.isArray(data?.content) ? data.content
          : (Array.isArray(data?.items) ? data.items
            : (Array.isArray(data?.files) ? data.files : [])))
      setFiles(list)
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
  // Decode slug-prefixed filenames into { label, name } so each chip can show
  // "Incorporation Certificate · mycert.pdf" instead of the raw stored name.
  const items = apiMode
    ? files.map((f) => {
        const { label: slotLabel, name } = decodeFilename(f.filename)
        return { key: f.id ?? f.filename, slotLabel, name, meta: f }
      })
    : (docs || []).map((raw, i) => {
        const { label: slotLabel, name } = decodeFilename(raw)
        return { key: `${raw}-${i}`, slotLabel, name, meta: null }
      })

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
          {readOnly
            ? 'Documents submitted with this application. Click any file to download.'
            : 'Attach the Invoice and any supporting files (PDF, images, spreadsheets).'}
        </Typography>

        {!readOnly && (
          <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} disabled={busy}>
            {busy ? 'Uploading…' : 'Attach documents'}
            <input type="file" hidden multiple onChange={onPick} />
          </Button>
        )}

        {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {items.length > 0 && (
          <Stack spacing={1} sx={{ mt: 2 }}>
            {items.map((it, i) => {
              const sizePart = apiMode && it.meta?.size ? ` · ${formatSize(it.meta.size)}` : ''
              return (
                <Box
                  key={it.key}
                  onClick={apiMode ? () => download(it.meta) : undefined}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.25,
                    p: 1, pl: 1.25, borderRadius: 1,
                    border: '1px solid', borderColor: 'divider',
                    cursor: apiMode ? 'pointer' : 'default',
                    transition: 'background-color .12s, border-color .12s',
                    ':hover': apiMode ? { bgcolor: 'action.hover', borderColor: 'primary.light' } : undefined,
                  }}
                >
                  <DescriptionOutlinedIcon color="action" fontSize="small" />
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    {it.slotLabel && (
                      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                        {it.slotLabel}
                      </Typography>
                    )}
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {it.name}{sizePart}
                    </Typography>
                  </Box>
                  {!readOnly && (
                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => { e.stopPropagation(); remove(i, it.meta ?? { filename: it.name }) }}
                      aria-label="Delete file"
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              )
            })}
          </Stack>
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
