import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Table, TableHead, TableBody, TableRow, TableCell, Box, Typography,
  Button, Alert, CircularProgress, TextField, InputAdornment, Chip,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { PageHeader, Mono } from '../../components/shared'
import StatusFilterBar from '../../components/StatusFilterBar'
import { useBseList } from '../../queries'

const ACTION_SX = { whiteSpace: 'nowrap', minWidth: 0, textTransform: 'none' }

// Workflow bucket helpers driving the filter chips (UAT 2026-09-30 —
// PMU previously only had a "pending my review" view; once they acted,
// the row vanished with no way to look back at what they'd
// recommended / not recommended. Mirrors the same segmented filter the
// HO Maker's BSE Approvals screen already uses).
const gtOf  = (r) => String(r?.raw?.gtRecommendation  || '').trim().toLowerCase()
const pmuOf = (r) => String(r?.raw?.pmuRecommendation || '').trim().toLowerCase()

// Only rows GT has forwarded (gt === recommended) are eligible for the
// PMU's queue — otherwise the row belongs upstream. That's the base
// filter every chip further narrows.
const isGtForwarded    = (r) => gtOf(r) === 'recommended'
const isPmuPending     = (r) => isGtForwarded(r) && !pmuOf(r)
const isPmuRecommended = (r) => pmuOf(r) === 'recommended'
const isPmuRejected    = (r) => pmuOf(r) === 'not recommended' || pmuOf(r) === 'rejected'

const BSE_FILTERS = [
  { key: 'pending',      label: 'Pending my review', tone: 'warning', match: isPmuPending },
  { key: 'recommended',  label: 'I recommended',     tone: 'success', match: isPmuRecommended },
  { key: 'not_recommended', label: 'I did not recommend', tone: 'error', match: isPmuRejected },
  { key: 'all',          label: 'All',               tone: 'default', match: isGtForwarded },
]

// Row can only reach this queue when GT === "Recommended", but keep the
// mapping defensive in case backend adds new decision values.
function gtChipColor(v) {
  const s = String(v || '').trim().toLowerCase()
  if (s === 'recommended') return 'success'
  if (s === 'not recommended') return 'error'
  return 'default'
}

function pmuChipColor(v) {
  const s = String(v || '').trim().toLowerCase()
  if (s === 'recommended') return 'success'
  if (s === 'not recommended' || s === 'rejected') return 'error'
  return 'default'
}

// BSE recommendations for the GT PMU. Default view is "Pending my
// review"; other tabs surface the PMU's own past decisions and the
// overall universe of rows GT has forwarded, so the PMU has a place
// to look back at everything they've acted on.
export default function PmuQueue() {
  const navigate = useNavigate()
  const { data: all = [], isLoading, isFetching, error, refetch } = useBseList()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('pending')

  const counts = useMemo(() => {
    const out = {}
    for (const f of BSE_FILTERS) out[f.key] = all.filter(f.match).length
    return out
  }, [all])

  const activeFilter = BSE_FILTERS.find((f) => f.key === filter) || BSE_FILTERS[0]
  const rows = useMemo(() => all.filter(activeFilter.match), [all, activeFilter])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((r) =>
      (r.name || '').toLowerCase().includes(term) ||
      (r.ia || '').toLowerCase().includes(term))
  }, [rows, q])

  const initialLoading = isLoading && all.length === 0
  const refetching = isFetching && all.length > 0

  return (
    <Box>
      <PageHeader
        title="BSE PMU Queue"
        subtitle={initialLoading ? 'Loading…' : subtitleFor(filter, filtered.length)}
        action={
          <Button variant="outlined" startIcon={refetching ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={() => refetch()} disabled={isLoading}>
            {refetching ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />

      <StatusFilterBar
        label="Filter"
        value={filter}
        onChange={setFilter}
        filters={BSE_FILTERS.map((f) => ({ key: f.key, label: f.label, tone: f.tone, count: counts[f.key] }))}
      />

      <TextField
        size="small" placeholder="Search by candidate or IA…" value={q}
        onChange={(e) => setQ(e.target.value)}
        sx={{ mb: 2, maxWidth: 360 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => refetch()}>Retry</Button>}>
          {error.message || 'Failed to load BSE recommendations'}
        </Alert>
      )}

      {initialLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <Card>
          <Table sx={{ '& tbody tr:last-of-type td': { border: 0 } }}>
            <TableHead>
              <TableRow>
                <TableCell>Candidate</TableCell>
                <TableCell>Industry Association</TableCell>
                <TableCell>GT decision</TableCell>
                <TableCell>My decision</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 && !error && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">
                    {q ? `No candidates match “${q}”.` : emptyLineFor(filter)}
                  </Typography>
                </TableCell></TableRow>
              )}
              {filtered.map((r) => {
                const myDecision = r.raw?.pmuRecommendation
                const acted = !!(myDecision && String(myDecision).trim())
                return (
                  <TableRow key={r.id} hover onClick={() => navigate(`/gt/pmu/${r.id}`)} sx={{ cursor: 'pointer' }}>
                    <TableCell>
                      <Typography fontWeight={700} fontSize="0.95rem">{r.name}</Typography>
                      <Mono>{r.mobile} · {r.email}</Mono>
                    </TableCell>
                    <TableCell><Typography variant="body2">{r.ia}</Typography></TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={gtChipColor(r.raw?.gtRecommendation)}
                        label={r.raw?.gtRecommendation || '—'}
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>
                      {acted
                        ? (
                          <Chip
                            size="small"
                            color={pmuChipColor(myDecision)}
                            label={myDecision}
                            sx={{ fontWeight: 600 }}
                          />
                        )
                        : <Typography variant="body2" color="text.secondary">Pending</Typography>}
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="outlined" startIcon={<VisibilityOutlinedIcon />}
                        onClick={(e) => { e.stopPropagation(); navigate(`/gt/pmu/${r.id}`) }} sx={ACTION_SX}>
                        {acted ? 'View' : 'Review'}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </Box>
  )
}

// Filter-aware subtitle and empty-state copy so the same page reads
// naturally regardless of which slice the user is looking at.
function subtitleFor(filter, n) {
  const count = `${n} candidate${n === 1 ? '' : 's'}`
  switch (filter) {
    case 'pending':          return `${count} awaiting your review`
    case 'recommended':      return `${count} you recommended`
    case 'not_recommended':  return `${count} you did not recommend`
    case 'all':              return `${count} in your queue`
    default:                 return count
  }
}

function emptyLineFor(filter) {
  switch (filter) {
    case 'pending':          return 'Nothing pending your review.'
    case 'recommended':      return "You haven't recommended any candidates yet."
    case 'not_recommended':  return "You haven't marked any candidate as Not Recommended yet."
    case 'all':              return 'No candidates have been forwarded by GT yet.'
    default:                 return 'No records to show.'
  }
}
