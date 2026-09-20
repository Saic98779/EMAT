import { useCallback, useMemo, useState, useTransition } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import EventNoteIcon from '@mui/icons-material/EventNote'
import { PageHeader } from '../../components/shared'
import { useAuth } from '../../auth'
import { useActionPlans } from '../../queries'
import { StatusPill } from '../checker/CheckerReview'

// ActionPlansList
// ────────────────────────────────────────────────────────────────────────
// GT's list of every action plan they've submitted. Kept intentionally
// simple: a search box, a refresh button, a "New Action Plan" CTA in the
// header, and a stack of rows. No KPI strip, no filter toggles, no
// colored left-stripe on rows.

export default function ActionPlansList() {
  const theme = useTheme()
  const navigate = useNavigate()
  const { user } = useAuth()
  const username = user?.username || ''

  const [q, setQ] = useState('')
  const query = useActionPlans()

  // `useTransition` lets us mark the navigate as low-priority — the
  // button flips to a "loading" state the instant it's clicked, giving
  // the user immediate feedback while React mounts the (heavy) form.
  const [isNavigating, startNav] = useTransition()
  const goToNew = useCallback(() => {
    startNav(() => navigate('/gt/action-plan'))
  }, [navigate])

  const mine = useMemo(() => {
    if (!username) return query.data || []
    const lc = username.toLowerCase()
    return (query.data || []).filter((r) => String(r.createdBy || '').toLowerCase() === lc)
  }, [query.data, username])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = term
      ? mine.filter((r) => (
          String(r.industryAssociationName || '').toLowerCase().includes(term) ||
          String(r.state || '').toLowerCase().includes(term)
        ))
      : mine
    return list.slice().sort((a, b) => {
      const at = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const bt = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return bt - at
    })
  }, [mine, q])

  return (
    <Box sx={{ maxWidth: 1120, mx: 'auto', pb: 6 }}>
      <PageHeader
        overline="Industry Association"
        title="Action Plans"
        subtitle="Every action plan you've submitted."
        action={
          <Button
            variant="contained"
            disableElevation
            startIcon={isNavigating ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
            onClick={goToNew}
            disabled={isNavigating}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {isNavigating ? 'Opening…' : 'New Action Plan'}
          </Button>
        }
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mt: 2.5, mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search by IA name or state…"
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
        <Alert severity="error" sx={{ mb: 2 }}>{query.error.message || 'Failed to load action plans.'}</Alert>
      )}

      {query.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={24} />
        </Box>
      ) : filtered.length === 0 ? (
        <EmptyState anyPlans={mine.length > 0} query={q} />
      ) : (
        <Stack spacing={1.25}>
          {filtered.map((row, i) => <PlanRow key={row.id ?? i} row={row} />)}
        </Stack>
      )}
    </Box>
  )
}

// ─── Row ───────────────────────────────────────────────────────────────
function PlanRow({ row }) {
  const theme = useTheme()
  const status = row.status || null
  const activityCount = Array.isArray(row.activities) ? row.activities.length : 0

  return (
    <Box
      component={Link}
      to={`/gt/action-plans/${encodeURIComponent(row.id)}`}
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
            {row.industryAssociationName || 'Untitled IA'}
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
            {row.state && (
              <Chip
                icon={<LocationOnOutlinedIcon sx={{ fontSize: 12 }} />}
                label={row.state}
                size="small"
                sx={{
                  height: 20, fontSize: 12,
                  bgcolor: alpha(theme.palette.text.primary, 0.04),
                  color: theme.palette.text.primary,
                  '.MuiChip-icon': { color: theme.palette.text.disabled },
                  '.MuiChip-label': { px: 0.75 },
                }}
              />
            )}
            <Chip
              icon={<EventNoteIcon sx={{ fontSize: 12 }} />}
              label={`${activityCount} ${activityCount === 1 ? 'activity' : 'activities'}`}
              size="small"
              sx={{
                height: 20, fontSize: 12,
                bgcolor: alpha(theme.palette.text.primary, 0.04),
                color: theme.palette.text.primary,
                '.MuiChip-icon': { color: theme.palette.text.disabled },
                '.MuiChip-label': { px: 0.75 },
              }}
            />
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
function EmptyState({ anyPlans, query }) {
  const theme = useTheme()
  const navigate = useNavigate()
  const copy = query.trim()
    ? { title: 'No matches', body: 'Try a different search term.', cta: false }
    : anyPlans
      ? { title: 'No action plans yet', body: 'Your submissions will appear here.', cta: false }
      : {
          title: "You haven't submitted any action plans yet",
          body: 'Head over to the Action Plan form to file one — it will show up here after you submit.',
          cta: true,
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
        <EventNoteIcon />
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
          onClick={() => navigate('/gt/action-plan')}
          sx={{ mt: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Create Action Plan
        </Button>
      )}
    </Box>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────
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
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
