import { useCallback, useMemo, useState, useTransition } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  Alert, Box, Button, Chip, CircularProgress, IconButton, InputAdornment,
  Stack, TextField, Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import RefreshIcon from '@mui/icons-material/Refresh'
import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import { PageHeader } from '../../components/shared'
import { useAuth } from '../../auth'
import { useContentList } from '../../queries'
import { CONTENT_REVIEW_TYPES } from '../checker/contentReviewConfig'
import { StatusPill } from '../checker/CheckerReview'

// ContentTypeList
// ────────────────────────────────────────────────────────────────────────
// GT PMU's per-type inbox — one page per DIA content type (3C, Survey,
// BDSP …). Reads the type from the URL (:type must be a valid key of
// CONTENT_REVIEW_TYPES) and shows the user's own submissions of that
// type. "New" button in the header opens the corresponding create form.

export default function ContentTypeList() {
  const theme = useTheme()
  const navigate = useNavigate()
  const { type } = useParams()
  const cfg = CONTENT_REVIEW_TYPES[type]
  const { user } = useAuth()
  const username = user?.username || ''

  const [q, setQ] = useState('')
  const query = useContentList(type, { enabled: !!cfg })

  const [isNavigating, startNav] = useTransition()
  const goToNew = useCallback(() => {
    if (!cfg?.createRoute) return
    startNav(() => navigate(cfg.createRoute))
  }, [navigate, cfg])

  const mine = useMemo(() => {
    const rows = query.data || []
    if (!username) return rows
    const lc = username.toLowerCase()
    return rows.filter((r) => String(r.createdBy || '').toLowerCase() === lc)
  }, [query.data, username])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = term
      ? mine.filter((r) => (cfg?.columns || []).some((c) => String(r[c.key] || '').toLowerCase().includes(term)))
      : mine
    return list.slice().sort((a, b) => {
      const at = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const bt = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return bt - at
    })
  }, [mine, q, cfg])

  // Unknown :type → bounce to dashboard rather than render an empty shell.
  if (!cfg) return <Navigate to="/gt" replace />

  return (
    <Box sx={{ maxWidth: 1120, mx: 'auto', pb: 6 }}>
      <PageHeader
        overline={cfg.overline}
        title={cfg.label}
        subtitle={`Every ${cfg.label.toLowerCase()} you've submitted.`}
        action={cfg.createRoute && (
          <Button
            variant="contained"
            disableElevation
            startIcon={isNavigating ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
            onClick={goToNew}
            disabled={isNavigating}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {isNavigating ? 'Opening…' : `New ${cfg.label}`}
          </Button>
        )}
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mt: 2.5, mb: 2 }}>
        <TextField
          size="small"
          placeholder={`Search ${cfg.label.toLowerCase()}…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ maxWidth: 360, flex: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />
        <Box sx={{ flex: 1 }} />
        <IconButton
          size="small"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          aria-label="Refresh"
          sx={{ border: 1, borderColor: alpha(theme.palette.text.primary, 0.14) }}
        >
          {query.isFetching ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
        </IconButton>
      </Stack>

      {query.error && (
        <Alert severity="error" sx={{ mb: 2 }}>{query.error.message || 'Failed to load submissions.'}</Alert>
      )}

      {query.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={24} />
        </Box>
      ) : filtered.length === 0 ? (
        <EmptyState cfg={cfg} anySubmissions={mine.length > 0} query={q} onCreate={goToNew} />
      ) : (
        <Stack spacing={1.25}>
          {filtered.map((row, i) => <ContentRow key={row.id ?? i} type={type} cfg={cfg} row={row} />)}
        </Stack>
      )}
    </Box>
  )
}

// ─── Row ───────────────────────────────────────────────────────────────
function ContentRow({ type, cfg, row }) {
  const theme = useTheme()
  const status = row.status || null
  const primaryKey = cfg.columns[0]?.key
  const secondaryCols = cfg.columns.slice(1)
  const isRevert = status === 'REVERT'

  return (
    <Box
      component={Link}
      to={`/gt/pmu/list/${type}/${encodeURIComponent(row.id)}`}
      sx={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        borderRadius: 2,
        border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        bgcolor: '#fff',
        px: 2.25, py: 1.75,
        transition: 'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease',
        '&:hover': {
          borderColor: alpha(theme.palette.primary.main, 0.35),
          boxShadow: `0 6px 20px ${alpha(theme.palette.text.primary, 0.06)}`,
          transform: 'translateY(-1px)',
        },
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.005em',
              color: theme.palette.text.primary,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {formatCellValue(cfg.columns[0], row[primaryKey]) || '—'}
          </Typography>
          <Stack direction="row" alignItems="center" spacing={0.5} flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
            {secondaryCols.map((c) => {
              const v = formatCellValue(c, row[c.key])
              if (!v || v === '—') return null
              return (
                <Chip
                  key={c.key}
                  label={<><Box component="span" sx={{ color: theme.palette.text.disabled, mr: 0.5 }}>{c.label}</Box>{v}</>}
                  size="small"
                  sx={{
                    height: 20, fontSize: 12,
                    bgcolor: alpha(theme.palette.text.primary, 0.04),
                    color: theme.palette.text.primary,
                    '.MuiChip-label': { px: 1 },
                  }}
                />
              )
            })}
            <AttachmentChip row={row} />
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.75 }}>
            <AccessTimeRoundedIcon sx={{ fontSize: 12, color: theme.palette.text.disabled }} />
            <Typography sx={{ fontSize: 11.5, color: theme.palette.text.disabled }}>
              Submitted {timeAgo(row.createdAt)}
              {row.updatedAt && row.updatedAt !== row.createdAt
                ? ` · updated ${timeAgo(row.updatedAt)}`
                : ''}
            </Typography>
          </Stack>
          {isRevert && (
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.75 }}>
              <HistoryRoundedIcon sx={{ fontSize: 13, color: theme.palette.warning.dark }} />
              <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: theme.palette.warning.dark }}>
                Sent back for changes — open to review remarks.
              </Typography>
            </Stack>
          )}
        </Box>

        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexShrink: 0 }}>
          <StatusPill status={status} />
          <ArrowForwardRoundedIcon sx={{ fontSize: 16, color: theme.palette.text.disabled }} />
        </Stack>
      </Stack>
    </Box>
  )
}

// ─── Empty state ───────────────────────────────────────────────────────
function EmptyState({ cfg, anySubmissions, query, onCreate }) {
  const theme = useTheme()
  const copy = query.trim()
    ? { title: 'No matches', body: 'Try a different search term.', cta: false }
    : anySubmissions
      ? { title: 'No submissions yet', body: 'Your submissions will appear here.', cta: false }
      : {
          title: `You haven't submitted any ${cfg.label.toLowerCase()} yet`,
          body: `Open the ${cfg.label} form to file one — it will show up here after you submit.`,
          cta: !!cfg.createRoute,
        }

  return (
    <Box
      sx={{
        border: 1, borderColor: alpha(theme.palette.text.primary, 0.09),
        borderRadius: 2, bgcolor: '#fff', textAlign: 'center',
        py: 6, px: 3,
      }}
    >
      <Box
        sx={{
          width: 44, height: 44, borderRadius: '50%', mx: 'auto', mb: 1.5,
          display: 'grid', placeItems: 'center',
          bgcolor: alpha(theme.palette.text.primary, 0.05),
          color: theme.palette.text.disabled,
        }}
      >
        <InboxOutlinedIcon />
      </Box>
      <Typography sx={{ fontSize: 15, fontWeight: 700, color: theme.palette.text.primary }}>
        {copy.title}
      </Typography>
      <Typography sx={{ mt: 0.5, fontSize: 13, color: theme.palette.text.secondary, maxWidth: 460, mx: 'auto' }}>
        {copy.body}
      </Typography>
      {copy.cta && (
        <Button
          variant="contained"
          disableElevation
          startIcon={<AddIcon />}
          onClick={onCreate}
          sx={{ mt: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Create {cfg.label}
        </Button>
      )}
    </Box>
  )
}

// ─── Attachment chip ───────────────────────────────────────────────────
// Shows a "1 file / 3 files" pill on the row when the record carries any
// attachment. Clicking the pill opens the first file in a new tab — one
// click, no need to enter the detail view just to see what was uploaded.
function AttachmentChip({ row }) {
  const theme = useTheme()
  const urls = collectAttachmentUrls(row)
  if (urls.length === 0) return null
  const first = urls[0]
  return (
    <Chip
      icon={<AttachFileRoundedIcon sx={{ fontSize: 12 }} />}
      component="a"
      href={first}
      target="_blank"
      rel="noreferrer"
      clickable
      onClick={(e) => e.stopPropagation()}
      label={urls.length === 1 ? 'File' : `${urls.length} files`}
      size="small"
      sx={{
        height: 20, fontSize: 12,
        bgcolor: alpha(theme.palette.primary.main, 0.08),
        color: theme.palette.primary.dark,
        '.MuiChip-icon': { color: theme.palette.primary.main },
        '.MuiChip-label': { px: 0.75, fontWeight: 600 },
      }}
    />
  )
}

// Widen this list if more attachment field names appear on the DTOs.
const ATTACHMENT_KEYS = ['attachment', 'attachments', 'file', 'files']
function collectAttachmentUrls(row) {
  const out = []
  for (const k of ATTACHMENT_KEYS) {
    const v = row?.[k]
    if (!v) continue
    if (Array.isArray(v)) v.forEach((x) => { if (typeof x === 'string' && x) out.push(x) })
    else if (typeof v === 'string' && v) out.push(v)
  }
  return out
}

// ─── Helpers ───────────────────────────────────────────────────────────
function formatCellValue(col, v) {
  if (v == null || v === '') return '—'
  if (col.type === 'date') return formatDate(v)
  if (col.type === 'number') return Number(v).toLocaleString('en-IN')
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

function formatDate(v) {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function timeAgo(iso) {
  if (!iso) return 'just now'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return String(iso)
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  const days = Math.round(hrs / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(iso)
}
