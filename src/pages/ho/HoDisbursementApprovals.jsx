import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Table, TableHead, TableBody, TableRow, TableCell, Box, Typography,
  Button, Alert, CircularProgress, Stack, TextField, InputAdornment, Chip,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { PageHeader, Mono } from '../../components/shared'
import { useVendorDisbursements } from '../../queries'

const ACTION_SX = { whiteSpace: 'nowrap', minWidth: 0, textTransform: 'none' }

// HO Maker's queue for vendor disbursement requests raised by Manpower
// Agencies. "Pending" = no `recommendation` recorded yet by HO.
export default function HoDisbursementApprovals() {
  const navigate = useNavigate()
  const { data: rows = [], isLoading, isFetching, error, refetch } = useVendorDisbursements()
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((r) => [r.manpowerAgencyName, r.invoiceNumber, r.gstinOfAgency, r.natureOfPayment]
      .some((f) => (f || '').toLowerCase().includes(term)))
  }, [rows, q])

  const initialLoading = isLoading && rows.length === 0
  const refetching = isFetching && rows.length > 0

  return (
    <Box>
      <PageHeader
        title="Vendor Disbursements"
        subtitle={initialLoading ? 'Loading…' : `${filtered.length} disbursement${filtered.length === 1 ? '' : 's'} raised by Manpower Agencies`}
        action={
          <Button variant="outlined" startIcon={refetching ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={() => refetch()} disabled={isLoading}>
            {refetching ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />

      <TextField
        size="small" placeholder="Search agency, invoice, GSTIN…" value={q}
        onChange={(e) => setQ(e.target.value)}
        sx={{ mb: 2, maxWidth: 380 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => refetch()}>Retry</Button>}>
          {error.message || 'Failed to load vendor disbursements'}
        </Alert>
      )}

      {initialLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <Card>
          <Table sx={{ '& tbody tr:last-of-type td': { border: 0 } }}>
            <TableHead>
              <TableRow>
                <TableCell>Manpower Agency</TableCell>
                <TableCell>Invoice</TableCell>
                <TableCell align="right">Amount Sought</TableCell>
                <TableCell align="right">Total (₹)</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Recommendation</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 && !error && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">
                      {q ? `No disbursements match “${q}”.` : 'No vendor disbursement requests yet.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id} hover onClick={() => navigate(`/sde/vendor-disbursements/${r.id}`)} sx={{ cursor: 'pointer' }}>
                  <TableCell>
                    <Typography fontWeight={700} fontSize="0.95rem">{r.manpowerAgencyName || '—'}</Typography>
                    <Mono>{r.gstinOfAgency || '—'}</Mono>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{r.invoiceNumber || '—'}</Typography>
                    <Mono>{formatDate(r.invoiceDate)}</Mono>
                  </TableCell>
                  <TableCell align="right"><Mono>{formatMoney(r.disbursementSoughtIn)}</Mono></TableCell>
                  <TableCell align="right"><Mono>{formatMoney(r.totalAmount)}</Mono></TableCell>
                  <TableCell>
                    <Chip size="small"
                      color={r.status ? 'success' : 'default'}
                      variant={r.status ? 'filled' : 'outlined'}
                      label={r.status || 'Pending'} />
                  </TableCell>
                  <TableCell>
                    {r.recommendation
                      ? <Chip size="small" color={r.recommendation === 'Recommended' ? 'success' : 'error'} label={r.recommendation} sx={{ fontWeight: 600 }} />
                      : <Typography variant="body2" color="text.secondary">—</Typography>}
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="outlined" startIcon={<VisibilityOutlinedIcon />}
                      onClick={(e) => { e.stopPropagation(); navigate(`/sde/vendor-disbursements/${r.id}`) }} sx={ACTION_SX}>
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

function formatMoney(v) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  return `₹${n.toLocaleString('en-IN')}`
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
