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

// Workflow bucket helpers driving the filter chips (UAT 2026-09-28).
const pmuOf = (r) => String(r?.raw?.pmuRecommendation || '').toLowerCase()
const hoOf  = (r) => String(r?.raw?.hoRecommendation  || '').toLowerCase()
function isHoPending(r) { return pmuOf(r) === 'recommended' && !hoOf(r) }
function isHoApproved(r) { return hoOf(r) === 'recommended' }
function isHoRejected(r) { return hoOf(r) === 'not recommended' || hoOf(r) === 'rejected' }
function isHoSentBack(r) { return hoOf(r) === 'sent back' || hoOf(r) === 'reverted' }
function isPmuPending(r) { return !pmuOf(r) || pmuOf(r) === 'draft' }

const BSE_FILTERS = [
  { key: 'pending',    label: 'Pending my review', tone: 'warning', match: isHoPending },
  { key: 'approved',   label: 'I approved',        tone: 'success', match: isHoApproved },
  { key: 'rejected',   label: 'I rejected',        tone: 'error',   match: isHoRejected },
  { key: 'sent_back',  label: 'Sent back',         tone: 'warning', match: isHoSentBack },
  { key: 'pmu_pending',label: 'PMU review pending',tone: 'info',    match: isPmuPending },
  { key: 'all',        label: 'All',               tone: 'default', match: null },
]

// BSE recommendations waiting for the SIDBI HO Maker's decision. Row click
// (or "Review") opens the HoBseReview page for the record.
export default function HoBseApprovals() {
  const navigate = useNavigate()
  const { data: all = [], isLoading, isFetching, error, refetch } = useBseList()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('pending')

  const counts = useMemo(() => {
    const out = {}
    for (const f of BSE_FILTERS) out[f.key] = f.match ? all.filter(f.match).length : all.length
    return out
  }, [all])

  const activeFilter = BSE_FILTERS.find((f) => f.key === filter) || BSE_FILTERS[0]
  const rows = useMemo(
    () => (activeFilter.match ? all.filter(activeFilter.match) : all),
    [all, activeFilter],
  )

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
        title="BSE Approvals"
        subtitle={initialLoading ? 'Loading…' : `${filtered.length} candidate${filtered.length === 1 ? '' : 's'} awaiting your review`}
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
                <TableCell>Upstream</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 && !error && (
                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">
                    {q ? `No candidates match “${q}”.` : 'Nothing pending your review.'}
                  </Typography>
                </TableCell></TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id} hover onClick={() => navigate(`/sde/bse/${r.id}/ho-review`)} sx={{ cursor: 'pointer' }}>
                  <TableCell>
                    <Typography fontWeight={700} fontSize="0.95rem">{r.name}</Typography>
                    <Mono>{r.mobile} · {r.email}</Mono>
                  </TableCell>
                  <TableCell><Typography variant="body2">{r.ia}</Typography></TableCell>
                  <TableCell>
                    <Chip size="small" color="success"
                      label={`PMU · ${r.raw?.pmuRecommendation || 'Recommended'}`}
                      sx={{ fontWeight: 600 }} />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="outlined" startIcon={<VisibilityOutlinedIcon />}
                      onClick={(e) => { e.stopPropagation(); navigate(`/sde/bse/${r.id}/ho-review`) }} sx={ACTION_SX}>
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </Box>
  )
}
