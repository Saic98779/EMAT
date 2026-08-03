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
import { useBseList } from '../../queries'

const ACTION_SX = { whiteSpace: 'nowrap', minWidth: 0, textTransform: 'none' }

// Workflow gate: PMU only sees records that GT has RECOMMENDED and that PMU
// hasn't decided yet. Applied client-side because the `/pmu-recommendation/
// {status}` endpoint doesn't currently express "pending" (see notes on the
// backend enum discussion).
function isPmuPending(r) {
  const gt = String(r.raw?.gtRecommendation || '').toLowerCase()
  const pmu = String(r.raw?.pmuRecommendation || '').trim()
  return gt === 'recommended' && !pmu
}

// BSE recommendations waiting for the GT PMU's decision. Row click opens
// PmuReview for the record.
export default function PmuQueue() {
  const navigate = useNavigate()
  const { data: all = [], isLoading, isFetching, error, refetch } = useBseList()
  const [q, setQ] = useState('')

  const rows = useMemo(() => all.filter(isPmuPending), [all])

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
        subtitle={initialLoading ? 'Loading…' : `${filtered.length} candidate${filtered.length === 1 ? '' : 's'} awaiting your review`}
        action={
          <Button variant="outlined" startIcon={refetching ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={() => refetch()} disabled={isLoading}>
            {refetching ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
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
                <TableRow key={r.uuid} hover onClick={() => navigate(`/gt/pmu/${r.uuid}`)} sx={{ cursor: 'pointer' }}>
                  <TableCell>
                    <Typography fontWeight={700} fontSize="0.95rem">{r.name}</Typography>
                    <Mono>{r.mobile} · {r.email}</Mono>
                  </TableCell>
                  <TableCell><Typography variant="body2">{r.ia}</Typography></TableCell>
                  <TableCell>
                    <Chip size="small" color="success" label={r.raw?.gtRecommendation || 'Recommended'} sx={{ fontWeight: 600 }} />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="outlined" startIcon={<VisibilityOutlinedIcon />}
                      onClick={(e) => { e.stopPropagation(); navigate(`/gt/pmu/${r.uuid}`) }} sx={ACTION_SX}>
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
