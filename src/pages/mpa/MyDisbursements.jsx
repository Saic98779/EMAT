import { useMemo, useState } from 'react'
import {
  Box, Card, Table, TableHead, TableBody, TableRow, TableCell, Typography, Button,
  Alert, CircularProgress, TextField, InputAdornment, Chip, Collapse, IconButton,
  Stack, Grid, Paper,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import { PageHeader, Mono } from '../../components/shared'
import { useAuth } from '../../auth'
import { useMyVendorDisbursements } from '../../queries'

// Manpower Agency — "Disbursement Notes".
// Lists every disbursement note the logged-in vendor has raised, with the
// current review state at a glance. Row-expandable so the user can see the
// Annexure I details without navigating away.
//
// Source: GET /vendor-disbursements, filtered client-side by `createdBy` on
// `useMyVendorDisbursements(user.username)`. When backend ships a `/mine`
// endpoint, swap the hook internals — no UI change.

export default function MyDisbursements() {
  const { user } = useAuth()
  const { data: rows = [], isLoading, isFetching, error, refetch } = useMyVendorDisbursements(user?.username)
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((r) =>
      [r.invoiceNumber, r.natureOfPayment, r.status, r.recommendation]
        .some((f) => (f || '').toLowerCase().includes(term)))
  }, [rows, q])

  // Newest first — createdBy line has no timestamp on the DTO, so we sort by
  // invoiceDate (falling back to id) as a reasonable proxy.
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const da = a.invoiceDate || ''
    const db = b.invoiceDate || ''
    if (da !== db) return db.localeCompare(da)
    return (b.id ?? 0) - (a.id ?? 0)
  }), [filtered])

  const toggleRow = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const initialLoading = isLoading && rows.length === 0
  const refetching = isFetching && rows.length > 0

  return (
    <Box>
      <PageHeader
        title="Disbursement Notes"
        subtitle={initialLoading
          ? 'Loading…'
          : `${sorted.length} disbursement note${sorted.length === 1 ? '' : 's'} raised by you`}
        action={
          <Button variant="outlined"
            startIcon={refetching ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={() => refetch()} disabled={isLoading}>
            {refetching ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />

      <TextField
        size="small" placeholder="Search invoice, status, recommendation…" value={q}
        onChange={(e) => setQ(e.target.value)}
        sx={{ mb: 2, maxWidth: 380 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => refetch()}>Retry</Button>}>
          {error.message || 'Failed to load disbursements'}
        </Alert>
      )}

      {initialLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : sorted.length === 0 && !error ? (
        <EmptyState hasSearch={!!q.trim()} />
      ) : (
        <Card variant="outlined" sx={{ overflow: 'hidden' }}>
          <Table
            sx={{
              '& thead th': {
                bgcolor: 'grey.50',
                color: 'text.secondary',
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                py: 1.25,
                borderBottom: '1px solid',
                borderColor: 'divider',
              },
              '& tbody td': { py: 1.5 },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell width={48} />
                <TableCell>Invoice</TableCell>
                <TableCell align="center" width={90}>Months</TableCell>
                <TableCell align="right" width={140}>Amount Sought</TableCell>
                <TableCell align="right" width={140}>Total (₹)</TableCell>
                <TableCell width={140}>Status</TableCell>
                <TableCell>Recommendation</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((d) => {
                const isOpen = expanded.has(d.id)
                const details = detailsOf(d)
                const rowCount = details.length
                return (
                  <RowGroup
                    key={d.id ?? d.invoiceNumber}
                    d={d} isOpen={isOpen} rowCount={rowCount}
                    onToggle={() => toggleRow(d.id)}
                  />
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </Box>
  )
}

function RowGroup({ d, isOpen, rowCount, onToggle }) {
  const rows = detailsOf(d)
  return (
    <>
      <TableRow
        hover
        onClick={onToggle}
        sx={{
          cursor: 'pointer',
          '& td': { borderBottom: isOpen ? 'none' : undefined },
          bgcolor: isOpen ? 'action.hover' : 'transparent',
        }}
      >
        <TableCell>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggle() }}>
            {isOpen ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography fontWeight={700} fontSize="0.95rem" sx={{ lineHeight: 1.3 }}>
            {d.invoiceNumber || '—'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatDate(d.invoiceDate)}
          </Typography>
        </TableCell>
        <TableCell align="center">
          <Chip
            size="small"
            variant="outlined"
            label={rowCount}
            sx={{ minWidth: 40, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
          />
        </TableCell>
        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
          {formatMoney(d.disbursementSoughtIn)}
        </TableCell>
        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
          {formatMoney(d.totalAmount)}
        </TableCell>
        <TableCell>
          <Chip size="small"
            color={statusColor(d.status)}
            variant={d.status ? 'filled' : 'outlined'}
            label={d.status || 'Pending'}
            sx={{ fontWeight: 700, letterSpacing: '0.02em' }}
          />
        </TableCell>
        <TableCell>
          {d.recommendation
            ? <Chip size="small"
                color={recommendationColor(d.recommendation)}
                variant="filled"
                label={d.recommendation}
                sx={{ fontWeight: 600 }} />
            : <Typography variant="body2" color="text.disabled">—</Typography>}
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={7} sx={{ p: 0, border: 0, bgcolor: 'grey.50' }}>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <ExpandedDetail d={d} rows={rows} />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

function ExpandedDetail({ d, rows }) {
  const totalNet = rows.reduce((sum, r) => sum + (Number(r.paymentToBse) || 0), 0)
  const hasHo = d.recommendedDisbursementAmount != null || d.recommendation || d.verifiedBy || d.approvedBy

  return (
    <Box sx={{ p: 2.5 }}>
      <Stack spacing={2}>

        {/* Invoice summary */}
        <SubCard title="Invoice Summary">
          <Grid container spacing={2.5}>
            <SnippetCell label="Salary Month"   value={rows[0]?.salaryMonth} />
            <SnippetCell label="GSTIN (Agency)" value={d.gstinOfAgency} mono />
            <SnippetCell label="Value of Service" value={formatMoney(d.invoiceValue)} prefix="₹" />
            <SnippetCell label="IGST @18%"      value={formatMoney(d.gstAmount)} prefix="₹" />
            <SnippetCell label="Total"          value={formatMoney(d.totalAmount)} prefix="₹" strong />
            <SnippetCell label="Compliance"     value={d.complianceTerms} />
          </Grid>
        </SubCard>

        {/* Annexure I */}
        <SubCard title="Annexure I — Monthly Salary Details">
          {rows.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
              No salary rows in this disbursement.
            </Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table
                size="small"
                sx={{
                  '& thead th': {
                    bgcolor: 'grey.50',
                    color: 'text.secondary',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  },
                  '& tbody td': { fontVariantNumeric: 'tabular-nums' },
                  '& tbody tr:last-of-type td': { borderBottom: 0 },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell width={40}>#</TableCell>
                    <TableCell>BSE</TableCell>
                    <TableCell>Salary Month</TableCell>
                    <TableCell align="right">Salary Days</TableCell>
                    <TableCell align="right">Paid Days</TableCell>
                    <TableCell align="right">Additional (₹)</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell>GT Attendance</TableCell>
                    <TableCell align="right">Payment (₹)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={r.id ?? `${r.salaryMonth}-${i}`} hover>
                      <TableCell><Mono>{i + 1}</Mono></TableCell>
                      <TableCell>
                        <Typography fontWeight={600} fontSize="0.88rem">{r.bseName || '—'}</Typography>
                      </TableCell>
                      <TableCell>{r.salaryMonth || '—'}</TableCell>
                      <TableCell align="right">{r.salaryDays ?? '—'}</TableCell>
                      <TableCell align="right">{r.paidDays ?? '—'}</TableCell>
                      <TableCell align="right">{formatMoney(r.additionalAmount)}</TableCell>
                      <TableCell sx={{ color: r.additionalAmountReason ? 'text.primary' : 'text.disabled' }}>
                        {r.additionalAmountReason || '—'}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 180 }}>
                        {r.gtAttendanceComments
                          ? <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{r.gtAttendanceComments}</Typography>
                          : <Typography variant="body2" color="text.disabled">Pending</Typography>}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatMoney(r.paymentToBse)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell colSpan={8} align="right" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>
                      TOTAL
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: 'primary.dark', fontSize: '0.95rem' }}>
                      ₹{totalNet.toLocaleString('en-IN')}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Box>
          )}
        </SubCard>

        {/* HO Decision */}
        {hasHo && (
          <SubCard
            title="HO Decision"
            accent="primary"
          >
            <Grid container spacing={2.5}>
              <SnippetCell label="Recommended Amount" value={formatMoney(d.recommendedDisbursementAmount)} prefix="₹" strong />
              <SnippetCell label="Recommendation"     value={d.recommendation} chip={recommendationColor(d.recommendation)} />
              <SnippetCell label="Verified By"        value={d.verifiedBy} />
              <SnippetCell label="Approved By"        value={d.approvedBy} />
            </Grid>
          </SubCard>
        )}
      </Stack>
    </Box>
  )
}

function SubCard({ title, accent, children }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderColor: accent === 'primary' ? 'primary.light' : 'divider',
        bgcolor: 'background.paper',
        borderRadius: 1.5,
      }}
    >
      <Typography
        variant="overline"
        sx={{
          display: 'block',
          mb: 1.5,
          color: accent === 'primary' ? 'primary.dark' : 'text.secondary',
          fontWeight: 700,
          letterSpacing: '0.1em',
        }}
      >
        {title}
      </Typography>
      {children}
    </Paper>
  )
}

function SnippetCell({ label, value, prefix, mono, strong, chip }) {
  const isEmpty = value == null || value === '' || value === '—'
  return (
    <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: 'block',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontSize: '0.68rem',
          fontWeight: 600,
          mb: 0.5,
        }}
      >
        {label}
      </Typography>
      {chip && !isEmpty ? (
        <Chip size="small" color={chip} label={value} sx={{ fontWeight: 600 }} />
      ) : (
        <Typography
          sx={{
            fontWeight: strong ? 700 : 500,
            fontSize: strong ? '0.95rem' : '0.88rem',
            color: isEmpty ? 'text.disabled' : 'text.primary',
            fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' : undefined,
            fontVariantNumeric: 'tabular-nums',
            wordBreak: 'break-word',
          }}
        >
          {prefix && !isEmpty && <Box component="span" sx={{ color: 'text.secondary', mr: 0.5 }}>{prefix}</Box>}
          {isEmpty ? '—' : value}
        </Typography>
      )}
    </Grid>
  )
}

function EmptyState({ hasSearch }) {
  return (
    <Box sx={{
      textAlign: 'center', py: 6, px: 3,
      border: '1px dashed', borderColor: 'divider', borderRadius: 2,
      bgcolor: 'action.hover',
    }}>
      <ReceiptLongOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
      <Typography variant="subtitle1" fontWeight={700} color="text.secondary">
        {hasSearch ? 'No matching disbursements' : 'No disbursement notes yet'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 480, mx: 'auto' }}>
        {hasSearch
          ? 'Try a different search term.'
          : 'Raise your first Salary Disbursement Note from the sidebar. Once submitted, it will show up here for you to track.'}
      </Typography>
    </Box>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────

// Backend renamed `details` → `monthlySalaryDetails` when the endpoint was
// re-scoped from `/vendor-disbursements` to `/bse-salary`. Fallback to the
// old key so older cached rows still render.
function detailsOf(d) {
  const arr = d?.monthlySalaryDetails ?? d?.details
  return Array.isArray(arr) ? arr : []
}

function statusColor(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'approved') return 'success'
  if (s === 'rejected') return 'error'
  if (s === 'on hold') return 'warning'
  return 'default'
}

function recommendationColor(rec) {
  const s = String(rec || '').toLowerCase()
  if (s.startsWith('not')) return 'error'
  if (s.includes('recommend')) return 'success'
  return 'default'
}

function formatMoney(v) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-IN') : String(v)
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
