import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, InputAdornment, Snackbar,
  Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { PageHeader, Mono } from '../../components/shared'
import { useAuth } from '../../auth'
import { useVendorDisbursements, useReviewerUpdateVendorDisbursement } from '../../queries'

// GT Field Team — Salary Requests queue.
//
// Flow: Manpower Consultancy raises (POST /bse-salary) → GT verifies here
// (PUT with `verifiedBy` + per-detail `gtAttendanceComments` +
// `gtAdditionalComments`) → HO Maker sees only verified notes.
//
// This screen shows notes where `verifiedBy` is empty; verified notes are
// moved off the queue but kept visible via the "Verified" tab so GT can
// look back at what they've cleared.

export default function GtSalaryRequests() {
  const { user } = useAuth()
  const { data: rows = [], isLoading, isFetching, error, refetch } = useVendorDisbursements()

  const [q, setQ] = useState('')
  const [tab, setTab] = useState('pending')
  const [review, setReview] = useState(null)
  const [toast, setToast] = useState({ severity: '', msg: '' })

  const buckets = useMemo(() => {
    const pending = rows.filter((r) => !isVerified(r))
    const verified = rows.filter((r) => isVerified(r))
    return { pending, verified }
  }, [rows])
  const currentRows = tab === 'pending' ? buckets.pending : buckets.verified

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return currentRows
    return currentRows.filter((r) =>
      [r.manpowerAgencyName, r.invoiceNumber, r.gstinOfAgency, r.natureOfPayment]
        .some((f) => (f || '').toLowerCase().includes(term)),
    )
  }, [currentRows, q])

  const initialLoading = isLoading && rows.length === 0
  const refetching = isFetching && rows.length > 0

  return (
    <Box>
      <PageHeader
        title="BSE Salary Requests"
        subtitle={initialLoading
          ? 'Loading…'
          : `${buckets.pending.length} awaiting GT verification · ${buckets.verified.length} already verified`}
        action={
          <Button variant="outlined"
            startIcon={refetching ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={() => refetch()} disabled={isLoading}>
            {refetching ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />

      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
        <Chip
          label={`Pending (${buckets.pending.length})`}
          color={tab === 'pending' ? 'primary' : 'default'}
          variant={tab === 'pending' ? 'filled' : 'outlined'}
          onClick={() => setTab('pending')}
          sx={{ fontWeight: 700 }}
        />
        <Chip
          label={`Verified (${buckets.verified.length})`}
          color={tab === 'verified' ? 'success' : 'default'}
          variant={tab === 'verified' ? 'filled' : 'outlined'}
          onClick={() => setTab('verified')}
          sx={{ fontWeight: 700 }}
        />
        <Box sx={{ flexGrow: 1 }} />
        <TextField
          size="small" placeholder="Search agency, invoice, GSTIN…"
          value={q} onChange={(e) => setQ(e.target.value)}
          sx={{ minWidth: 300 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={
          <Button color="inherit" size="small" onClick={() => refetch()}>Retry</Button>
        }>
          {error.message || 'Failed to load salary requests'}
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
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">
                      {tab === 'pending'
                        ? 'No salary requests waiting for GT verification.'
                        : 'No verified salary requests yet.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <QueueRow key={r.id ?? r.uuid} row={r} onOpen={() => setReview(r)} />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <ReviewDialog
        open={!!review}
        row={review}
        gtUsername={user?.username}
        onClose={() => setReview(null)}
        onToast={setToast}
      />

      <Snackbar open={!!toast.msg} autoHideDuration={3500}
        onClose={() => setToast({ severity: '', msg: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={toast.severity || 'info'} variant="filled"
          onClose={() => setToast({ severity: '', msg: '' })}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}

// ── Row ────────────────────────────────────────────────────────────────────
const QueueRow = memo(function QueueRow({ row, onOpen }) {
  const details = detailsOf(row)
  const total = row.disbursementSoughtIn
    ? Number(row.disbursementSoughtIn)
    : details.reduce((sum, d) => sum + (Number(d.paymentToBse) || 0), 0)
  const verified = isVerified(row)

  return (
    <TableRow hover onClick={onOpen} sx={{ cursor: 'pointer' }}>
      <TableCell>
        <Typography fontWeight={700} fontSize="0.95rem">{row.manpowerAgencyName || '—'}</Typography>
        <Mono>{row.gstinOfAgency || '—'}</Mono>
      </TableCell>
      <TableCell>
        <Typography variant="body2">{row.invoiceNumber || '—'}</Typography>
        <Mono>{row.invoiceDate ? String(row.invoiceDate).slice(0, 10) : '—'}</Mono>
      </TableCell>
      <TableCell align="right">
        <Mono>₹{total.toLocaleString('en-IN')}</Mono>
      </TableCell>
      <TableCell>
        {verified
          ? <Chip size="small" color="success" label={`Verified · ${row.verifiedBy}`} />
          : <Chip size="small" color="warning" variant="outlined" label="Awaiting GT" />}
      </TableCell>
      <TableCell align="right">
        <Button size="small" variant={verified ? 'text' : 'contained'}
          onClick={(e) => { e.stopPropagation(); onOpen() }}
          sx={{ textTransform: 'none' }}>
          {verified ? 'View' : 'Review'}
        </Button>
      </TableCell>
    </TableRow>
  )
})

// ── Review dialog ──────────────────────────────────────────────────────────
// Per-detail comments (one row per BSE) so GT can attest attendance per
// resource. On Verify → PUT with `verifiedBy = user.username` + merged
// details[] carrying gtAttendanceComments + gtAdditionalComments.
// On Reject → PUT with `recommendation: false` + `status: "Rejected by GT"`.
function ReviewDialog({ open, row, gtUsername, onClose, onToast }) {
  const updateM = useReviewerUpdateVendorDisbursement()
  const [comments, setComments] = useState({})  // { [rowKey]: { att, add } }

  const details = detailsOf(row)
  const verified = row ? isVerified(row) : false

  // Seed comments from the DTO whenever a new row opens. Backend GET rows
  // don't carry `bseId`, so we key on the row `id` (or the index as a
  // last resort) — both stable within one open/close cycle.
  useEffect(() => {
    if (!open || !row) return
    const seed = {}
    detailsOf(row).forEach((d, i) => {
      const k = detailKey(d, i)
      seed[k] = {
        att: d.gtAttendanceComments || '',
        add: d.gtAdditionalComments || '',
      }
    })
    setComments(seed)
  }, [open, row])

  const setComment = useCallback((rowKey, key, value) => {
    setComments((prev) => ({
      ...prev,
      [rowKey]: { ...(prev[rowKey] || { att: '', add: '' }), [key]: value },
    }))
  }, [])

  const submit = useCallback(async () => {
    if (!row) return
    const id = row.id ?? row.uuid
    if (!id) {
      onToast({ severity: 'error', msg: 'Missing record id.' })
      return
    }
    // Attendance comment is required per-BSE so backend never gets a
    // "verified but no attestation" note.
    const missingIdx = details.findIndex((d, i) => {
      const c = comments[detailKey(d, i)] || {}
      return !c.att?.trim()
    })
    if (missingIdx >= 0) {
      const d = details[missingIdx]
      onToast({ severity: 'warning', msg: `Add an attendance comment for ${d.bseName || `row ${missingIdx + 1}`} before verifying.` })
      return
    }
    // Minimal patch — only the fields GT actually changed. Backend is
    // expected to apply non-null fields to the existing entity and leave
    // everything else (invoice, monthlySalaryDetails financials, bseId
    // linkage) untouched.
    const detailPatches = details
      .map((d, i) => {
        const c = comments[detailKey(d, i)] || { att: '', add: '' }
        if (d.id == null) return null   // can't match without id — skip
        return {
          id: d.id,
          gtAttendanceComments: c.att || null,
          gtAdditionalComments: c.add || null,
        }
      })
      .filter(Boolean)
    try {
      await updateM.mutateAsync({
        id,
        patch: {
          verifiedBy: gtUsername || 'GT',
          monthlySalaryDetails: detailPatches,
        },
      })
      onToast({ severity: 'success', msg: 'Verified and sent to HO Maker.' })
      onClose()
    } catch (err) {
      onToast({ severity: 'error', msg: err.message || 'Failed to save GT review.' })
    }
  }, [row, details, comments, gtUsername, updateM, onClose, onToast])

  if (!row) return null
  const busy = updateM.isPending

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.14em' }}>
              GT verification
            </Typography>
            <Typography variant="h6" fontWeight={700} noWrap>{row.manpowerAgencyName || '—'}</Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              Invoice {row.invoiceNumber || '—'} · {row.invoiceDate ? String(row.invoiceDate).slice(0, 10) : '—'}
            </Typography>
          </Box>
          {verified && (
            <Chip color="success" size="small" label={`Verified by ${row.verifiedBy}`} />
          )}
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {details.length === 0 ? (
          <Alert severity="info">No BSE rows on this note.</Alert>
        ) : (
          <Stack spacing={2}>
            {details.map((d, i) => {
              const k = detailKey(d, i)
              const c = comments[k] || { att: '', add: '' }
              return (
                <Card key={k} variant="outlined">
                  <CardContent sx={{ py: 1.5 }}>
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.25 }}>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography fontWeight={700}>{d.bseName || `BSE ${i + 1}`}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {d.salaryMonth || '—'} · {d.salaryDays ?? d.paidDays ?? '—'} days · ₹{Number(d.paymentToBse || 0).toLocaleString('en-IN')}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack spacing={1.25}>
                      <TextField
                        size="small" fullWidth multiline minRows={2}
                        label="GT Comments on BSE attendance *"
                        placeholder="Attendance verified against field logs…"
                        value={c.att}
                        onChange={(e) => setComment(k, 'att', e.target.value)}
                        disabled={busy || verified}
                      />
                      <TextField
                        size="small" fullWidth multiline minRows={2}
                        label="GT Comments on additional payment to BSE, if any"
                        value={c.add}
                        onChange={(e) => setComment(k, 'add', e.target.value)}
                        disabled={busy || verified}
                      />
                    </Stack>
                  </CardContent>
                </Card>
              )
            })}
          </Stack>
        )}
      </DialogContent>

      <Divider />
      <DialogActions sx={{ px: 3, py: 1.75, gap: 1 }}>
        <Button onClick={onClose} disabled={busy}>Close</Button>
        <Box sx={{ flexGrow: 1 }} />
        {!verified && (
          <Button color="success" variant="contained" disableElevation
            startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <CheckCircleOutlineIcon />}
            onClick={submit}
            disabled={busy}
            sx={{ textTransform: 'none' }}
          >
            Verify & send to HO
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

// A note is "verified by GT" once `verifiedBy` is a non-empty string. HO
// filters on the same predicate.
function isVerified(row) {
  return !!(row?.verifiedBy && String(row.verifiedBy).trim())
}

// Backend GET nests per-BSE rows under `monthlySalaryDetails`; POST-side
// uses `details`. Read from either so we're robust to whichever the
// server returns for the endpoint we're on.
function detailsOf(row) {
  if (!row) return []
  if (Array.isArray(row.monthlySalaryDetails)) return row.monthlySalaryDetails
  if (Array.isArray(row.details)) return row.details
  return []
}

// Stable identifier for a detail row within one note. GET rows carry `id`;
// fall back to index for POST-shaped rows (which don't).
function detailKey(d, index) {
  if (d?.id != null) return `id:${d.id}`
  if (d?.bseId) return `bse:${d.bseId}`
  return `idx:${index}`
}
