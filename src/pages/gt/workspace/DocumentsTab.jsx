import { memo, useMemo, useState } from 'react'
import {
  Alert, Box, Button, CircularProgress, IconButton, Snackbar, Stack, Typography,
} from '@mui/material'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import { alpha, useTheme } from '@mui/material/styles'
import { useFilesByRegistration } from '../../../queries'
import { useIaWorkspace } from '../../../components/workspace/IaWorkspaceLayout'
import { downloadFile } from '../../../apis/files'
import { FILE_FIELD_LABELS, decodeFilename } from '../../../fileFieldLabels'

// DocumentsTab
// ────────────────────────────────────────────────────────────────────────
// Every file uploaded against this IA, grouped by upload slot. Backend
// returns a flat list; the frontend decodes the `<slug>__<original>`
// naming convention to attribute each file to a named slot ("Address
// Proof", "Apex ID", etc.). Files without a known slug get bucketed
// under "Other".
export default function DocumentsTab() {
  const ws = useIaWorkspace()
  const filesQ = useFilesByRegistration(ws.iaId)
  const [toast, setToast] = useState(null)

  const groups = useMemo(() => groupBySlot(filesQ.data || []), [filesQ.data])

  const onDownload = async (filename) => {
    try {
      await downloadFile(ws.iaId, filename)
    } catch (err) {
      setToast({ severity: 'error', msg: err?.message || 'Download failed.' })
    }
  }

  if (ws.isNew) {
    return <EmptyState line="Documents show up once files are uploaded through the stage forms." />
  }
  if (filesQ.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={22} />
      </Box>
    )
  }
  if (!filesQ.data?.length) {
    return <EmptyState line="No documents uploaded on this IA yet." />
  }

  return (
    <Box sx={{ maxWidth: 820 }}>
      <Stack direction="row" alignItems="baseline" spacing={2} sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: 15.5, fontWeight: 700 }}>Documents</Typography>
        <Typography sx={{ fontSize: 12.5, color: 'text.disabled' }}>
          {filesQ.data.length} file{filesQ.data.length === 1 ? '' : 's'} across {groups.length} slot{groups.length === 1 ? '' : 's'}
        </Typography>
      </Stack>

      <Stack spacing={2}>
        {groups.map((group) => (
          <DocGroup key={group.slug} group={group} onDownload={onDownload} />
        ))}
      </Stack>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {toast ? (
          <Alert severity={toast.severity} variant="filled" onClose={() => setToast(null)}>
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  )
}

// ── Slot group ─────────────────────────────────────────────────────────

const DocGroup = memo(function DocGroup({ group, onDownload }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        borderRadius: 2,
        background: '#fff',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{
          px: 2.25,
          py: 1.5,
          borderBottom: 1,
          borderColor: alpha(theme.palette.text.primary, 0.06),
          background: alpha(theme.palette.text.primary, 0.02),
        }}
      >
        <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{group.label}</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>
          {group.files.length} file{group.files.length === 1 ? '' : 's'}
        </Typography>
      </Stack>
      <Stack>
        {group.files.map((f) => (
          <FileRow key={f.filename} file={f} onDownload={onDownload} />
        ))}
      </Stack>
    </Box>
  )
})

function FileRow({ file, onDownload }) {
  const theme = useTheme()
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{
        px: 2.25,
        py: 1.25,
        borderBottom: 1,
        borderColor: alpha(theme.palette.text.primary, 0.06),
        '&:last-of-type': { borderBottom: 0 },
      }}
    >
      <InsertDriveFileRoundedIcon sx={{ color: theme.palette.text.disabled, fontSize: 20 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13.5, color: theme.palette.text.primary, overflowWrap: 'anywhere' }}>
          {file.displayName}
        </Typography>
        <Typography sx={{ fontSize: 12, color: theme.palette.text.disabled }}>
          {formatSize(file.size)} {file.uploadedAt ? `· uploaded ${formatDate(file.uploadedAt)}` : ''}
        </Typography>
      </Box>
      <IconButton
        size="small"
        onClick={() => onDownload(file.filename)}
        aria-label="Download file"
      >
        <DownloadRoundedIcon sx={{ fontSize: 20 }} />
      </IconButton>
    </Stack>
  )
}

// ── Empty state ────────────────────────────────────────────────────────

function EmptyState({ line }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        maxWidth: 520,
        mx: 'auto',
        mt: 4,
        p: 4,
        border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        borderRadius: 2,
        background: '#fff',
        textAlign: 'center',
      }}
    >
      <Typography sx={{ fontSize: 14, color: theme.palette.text.secondary }}>{line}</Typography>
    </Box>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────

// Group files by their decoded slug so each upload slot renders as its
// own card. Unknown slugs fall into an "Other" bucket.
function groupBySlot(files) {
  const bySlug = new Map()
  const others = []
  for (const raw of files) {
    const filename = raw?.filename || raw?.name || ''
    if (!filename) continue
    const { label, name, slug } = decodeAndTag(filename)
    const enriched = {
      filename,
      displayName: name || filename,
      size: raw.size,
      uploadedAt: raw.uploadedAt || raw.createdAt,
    }
    if (slug && FILE_FIELD_LABELS[slug]) {
      const bucket = bySlug.get(slug) || { slug, label: label || FILE_FIELD_LABELS[slug], files: [] }
      bucket.files.push(enriched)
      bySlug.set(slug, bucket)
    } else {
      others.push(enriched)
    }
  }

  const groups = [...bySlug.values()]
  if (others.length) groups.push({ slug: '__other', label: 'Other files', files: others })
  return groups
}

function decodeAndTag(filename) {
  const decoded = decodeFilename(filename) // { label, name }
  const idx = String(filename).indexOf('__')
  const slug = idx > 0 ? filename.slice(0, idx) : ''
  return { label: decoded.label, name: decoded.name, slug }
}

function formatSize(bytes) {
  if (bytes == null || Number.isNaN(Number(bytes))) return ''
  const n = Number(bytes)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
