import { memo, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Alert, Box, Button, Chip, CircularProgress, IconButton, InputAdornment,
  Stack, Tab, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded'
import RefreshIcon from '@mui/icons-material/Refresh'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import SearchIcon from '@mui/icons-material/Search'
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined'
import PollOutlinedIcon from '@mui/icons-material/PollOutlined'
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined'
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined'
import NewReleasesOutlinedIcon from '@mui/icons-material/NewReleasesOutlined'
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import { PageHeader } from '../../components/shared'
import { useContentList } from '../../queries'
import { CONTENT_REVIEW_TYPES, CONTENT_REVIEW_ORDER } from './contentReviewConfig'
import { StatusPill } from './CheckerReview'

// CheckerQueue
// ────────────────────────────────────────────────────────────────────────
// SIDBI HO Checker's inbox. Tabbed by content type, each tab shows an
// inbox-style list of submissions with per-row status. A REVERT is treated
// as "back in the queue" — the submitter needs to fix and resubmit.

// Icon per content type so the tabs are scannable at a glance.
const TYPE_ICON = {
  'dia-3c-info-series':               ArticleOutlinedIcon,
  'elearning-module-content':         SchoolOutlinedIcon,
  'bulk-broadcast':                   CampaignOutlinedIcon,
  'discussion-forum':                 ForumOutlinedIcon,
  'latest-developments':              NewReleasesOutlinedIcon,
  'pop-ups':                          NotificationsActiveOutlinedIcon,
  'surveys':                          PollOutlinedIcon,
  'bdsp':                             HandshakeOutlinedIcon,
  'bds-service-providers-onboarding': BusinessOutlinedIcon,
}

export default function CheckerQueue() {
  const [tab, setTab] = useState(CONTENT_REVIEW_ORDER[0])
  const cfg = CONTENT_REVIEW_TYPES[tab]

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', pb: 8 }}>
      <PageHeader
        overline="Approvals"
        title="Content Approvals"
        subtitle="Review submissions from GT PMU. Approve to publish, revert to send back with remarks, or reject outright."
      />

      <QueueTabs value={tab} onChange={setTab} />

      {cfg && <QueueBody key={tab} type={tab} cfg={cfg} />}
    </Box>
  )
}

// ─── Tab strip ─────────────────────────────────────────────────────────
function QueueTabs({ value, onChange }) {
  const theme = useTheme()
  return (
    <Box sx={{ mt: 2, borderBottom: 1, borderColor: alpha(theme.palette.text.primary, 0.08) }}>
      <Tabs
        value={value}
        onChange={(_, v) => onChange(v)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        TabIndicatorProps={{
          sx: { height: 3, borderRadius: '3px 3px 0 0' },
        }}
        sx={{
          minHeight: 46,
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: 13.5,
            minHeight: 46,
            py: 1.25,
            color: theme.palette.text.secondary,
            '&.Mui-selected': { color: theme.palette.primary.main },
          },
        }}
      >
        {CONTENT_REVIEW_ORDER.map((k) => (
          <Tab
            key={k}
            value={k}
            label={<TabLabel type={k} label={CONTENT_REVIEW_TYPES[k].label} />}
          />
        ))}
      </Tabs>
    </Box>
  )
}

// Live pending-count badge. Uses the same list query the queue body uses,
// so the badge and rows share a cache and update together.
const TabLabel = memo(function TabLabel({ type, label }) {
  const q = useContentList(type)
  const pending = useMemo(() => (q.data || []).filter(isPending).length, [q.data])
  const Icon = TYPE_ICON[type]
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      {Icon && <Icon sx={{ fontSize: 16 }} />}
      <span>{label}</span>
      {pending > 0 && (
        <Chip
          size="small"
          label={pending}
          sx={{
            height: 18, fontSize: 11, fontWeight: 700, ml: 0.25,
            bgcolor: (t) => alpha(t.palette.warning.main, 0.16),
            color: (t) => t.palette.warning.dark,
            '.MuiChip-label': { px: 0.75 },
          }}
        />
      )}
    </Stack>
  )
})

// ─── One tab body ──────────────────────────────────────────────────────
function QueueBody({ type, cfg }) {
  const theme = useTheme()
  const [filter, setFilter] = useState('pending')      // pending | all | approved | rejected
  const [q, setQ] = useState('')
  const query = useContentList(type)

  const rows = query.data || []
  const counts = useMemo(() => ({
    pending:  rows.filter(isPending).length,
    approved: rows.filter((r) => r.status === 'APPROVED').length,
    rejected: rows.filter((r) => r.status === 'REJECT').length,
    reverted: rows.filter((r) => r.status === 'REVERT').length,
    total:    rows.length,
  }), [rows])

  const filtered = useMemo(() => {
    let list = rows
    // Pending includes fresh submissions AND revert'd items the GT-PMU
    // has resubmitted since (they need re-review). See isPending() below.
    if (filter === 'pending')  list = rows.filter(isPending)
    if (filter === 'approved') list = rows.filter((r) => r.status === 'APPROVED')
    if (filter === 'rejected') list = rows.filter((r) => r.status === 'REJECT')
    if (filter === 'reverted') list = rows.filter((r) => r.status === 'REVERT')
    const term = q.trim().toLowerCase()
    if (term) {
      list = list.filter((r) => {
        const s = cfg.columns.map((c) => String(r[c.key] || '')).join(' ')
        return s.toLowerCase().includes(term)
      })
    }
    return list.slice().sort((a, b) => {
      const at = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const bt = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return bt - at
    })
  }, [rows, filter, q, cfg.columns])

  return (
    <Box sx={{ pt: 2.5 }}>
      {/* Filter toolbar */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filter}
          onChange={(_, v) => v && setFilter(v)}
          sx={{
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              fontWeight: 600,
              px: 1.75,
              py: 0.5,
              borderColor: alpha(theme.palette.text.primary, 0.14),
              color: theme.palette.text.secondary,
            },
            '& .Mui-selected': {
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.dark,
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.16) },
            },
          }}
        >
          <ToggleButton value="pending">Pending ({counts.pending})</ToggleButton>
          <ToggleButton value="reverted">Reverted ({counts.reverted})</ToggleButton>
          <ToggleButton value="approved">Approved ({counts.approved})</ToggleButton>
          <ToggleButton value="rejected">Rejected ({counts.rejected})</ToggleButton>
          <ToggleButton value="all">All ({counts.total})</ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ flex: 1 }} />

        <TextField
          size="small"
          placeholder={`Search ${cfg.label.toLowerCase()}…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ minWidth: { sm: 260 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />
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
        <Alert severity="error" sx={{ mb: 2 }}>{query.error.message || 'Failed to load records.'}</Alert>
      )}

      {query.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={24} />
        </Box>
      ) : filtered.length === 0 ? (
        <EmptyState filter={filter} typeLabel={cfg.label} totalCount={counts.total} />
      ) : (
        <Stack spacing={1.25}>
          {filtered.map((row, i) => (
            <QueueRow key={row.id ?? i} cfg={cfg} row={row} />
          ))}
        </Stack>
      )}
    </Box>
  )
}

// ─── One queue row (inbox card) ────────────────────────────────────────
function QueueRow({ cfg, row }) {
  const theme = useTheme()
  const status = row.status || null
  const primaryKey = cfg.columns[0]?.key
  const secondaryCols = cfg.columns.slice(1)

  return (
    <Box
      component={Link}
      to={cfg.detailRoute(encodeURIComponent(row.id))}
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
        {/* Primary field + secondary chips */}
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
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
            {secondaryCols.map((c) => {
              const v = formatCellValue(c, row[c.key])
              if (!v || v === '—') return null
              return (
                <Chip
                  key={c.key}
                  label={<><Box component="span" sx={{ color: theme.palette.text.disabled, mr: 0.5 }}>{c.label}</Box>{v}</>}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: 12,
                    bgcolor: alpha(theme.palette.text.primary, 0.04),
                    color: theme.palette.text.primary,
                    '.MuiChip-label': { px: 1 },
                  }}
                />
              )
            })}
            <AttachmentChip row={row} />
            {wasResubmitted(row) && (
              <Chip
                label="Resubmitted"
                size="small"
                sx={{
                  height: 20, fontSize: 12, fontWeight: 700,
                  bgcolor: (t) => alpha(t.palette.info.main, 0.14),
                  color: (t) => t.palette.info.dark,
                  '.MuiChip-label': { px: 0.9 },
                }}
              />
            )}
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.75 }}>
            <AccessTimeRoundedIcon sx={{ fontSize: 12, color: theme.palette.text.disabled }} />
            <Typography sx={{ fontSize: 11.5, color: theme.palette.text.disabled }}>
              {row.createdBy || 'Unknown'} · submitted {timeAgo(row.createdAt)}
              {row.updatedAt && row.updatedAt !== row.createdAt && ` · updated ${timeAgo(row.updatedAt)}`}
            </Typography>
          </Stack>
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
function EmptyState({ filter, typeLabel, totalCount }) {
  const theme = useTheme()
  const copy = (() => {
    if (totalCount === 0) return {
      title: `No ${typeLabel.toLowerCase()} submissions yet`,
      body: 'When GT PMU submits one, it will appear here for your review.',
    }
    if (filter === 'pending') return {
      title: 'Inbox zero — nothing pending',
      body: 'Every submission on this tab has been decided. Switch filter to browse decided items.',
    }
    if (filter === 'reverted') return {
      title: 'No reverted items',
      body: 'Items you sent back for changes will appear here.',
    }
    if (filter === 'approved') return {
      title: 'Nothing approved on this tab yet',
      body: 'Approved items will appear here after you record a decision.',
    }
    if (filter === 'rejected') return {
      title: 'Nothing rejected on this tab',
      body: 'Rejected items will appear here after you record a decision.',
    }
    return {
      title: 'No matches',
      body: 'Try a different search term.',
    }
  })()

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
      <Typography sx={{ mt: 0.5, fontSize: 13, color: theme.palette.text.secondary, maxWidth: 420, mx: 'auto' }}>
        {copy.body}
      </Typography>
    </Box>
  )
}

// ─── Attachment chip ───────────────────────────────────────────────────
// Same treatment as the ContentTypeList row — one-click access to the
// first attachment on a queue row, so the reviewer can peek without
// opening the detail page.
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
// A row is "pending" if:
//   • It's never been touched by the checker (`status == null`), OR
//   • It was REVERTed and the GT-PMU has since edited it (a resubmit).
//
// Detection for the second case relies on the audit fields: when the
// checker PATCHes /status, backend writes `updatedBy = sidbi_ho_checker`
// while `createdBy` stays as the original PMU. When the PMU resubmits
// via PUT, `updatedBy` flips back to their username (typically equal to
// `createdBy`). So `status === 'REVERT' && updatedBy === createdBy`
// means "waiting for me to re-review" as opposed to "waiting for the
// PMU to act".
export function wasResubmitted(row) {
  if (row.status !== 'REVERT') return false
  const created = String(row.createdBy || '').toLowerCase()
  const updated = String(row.updatedBy || '').toLowerCase()
  return !!created && created === updated
}

function isPending(row) {
  return !row.status || wasResubmitted(row)
}

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
