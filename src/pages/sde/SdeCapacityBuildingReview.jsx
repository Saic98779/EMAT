import { useMemo, useState } from 'react'
import {
  Box, Card, Table, TableHead, TableBody, TableRow, TableCell, Typography,
  Button, Alert, CircularProgress, TextField, InputAdornment, Chip, Collapse,
  IconButton, Stack, Grid, Paper, Snackbar, Divider,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import SaveIcon from '@mui/icons-material/Save'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CancelRoundedIcon from '@mui/icons-material/CancelRounded'
import UndoRoundedIcon from '@mui/icons-material/UndoRounded'
import { PageHeader } from '../../components/shared'
import {
  useDisbursementCapacityBuilding, useUpdateDisbursementCapacityBuilding,
  useUpdateDisbursementCapacityBuildingStatus,
} from '../../queries'
import {
  toFormValues, stageOf, DEFAULT_ACCOUNT_CODE,
} from '../../apis/disbursementCapacityBuilding'
import { CONTENT_STATUS } from '../../apis/contentStatus'

// SIDBI SDE — capacity building approval queue.
// SDE owns rows 10, 11 and 14 of the note format (amount recommended,
// account code, recommendation) and may additionally revise the BSE-entered
// rows the format marks "modifiable at SDE level": nature of payment, the
// invoice trio, and pre-disbursement compliance.
export default function SdeCapacityBuildingReview() {
  const { data: rows = [], isLoading, isFetching, error, refetch } = useDisbursementCapacityBuilding()
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())
  const [toast, setToast] = useState(null)

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((r) =>
      [r.invoiceNumber, r.industryAssociationName, r.natureOfPayment, r.gstinOfIa]
        .some((f) => (f || '').toLowerCase().includes(term)))
  }, [rows, q])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const da = a.invoiceDate || ''; const db = b.invoiceDate || ''
    return db.localeCompare(da)
  }), [filtered])

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const initialLoading = isLoading && rows.length === 0
  const refetching = isFetching && rows.length > 0

  return (
    <Box>
      <PageHeader
        title="Capacity Building Approvals"
        subtitle={initialLoading ? 'Loading…'
          : `${sorted.length} disbursement note${sorted.length === 1 ? '' : 's'}`}
        action={
          <Button variant="outlined"
            startIcon={refetching ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={() => refetch()} disabled={isLoading}>
            {refetching ? 'Refreshing…' : 'Refresh'}
          </Button>}
      />

      <TextField
        size="small" placeholder="Search IA, invoice, nature of payment, GSTIN…" value={q}
        onChange={(e) => setQ(e.target.value)}
        sx={{ mb: 2, maxWidth: 380 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => refetch()}>Retry</Button>}>
          {error.message || 'Failed to load capacity building notes'}
        </Alert>
      )}

      {initialLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ overflow: 'hidden' }}>
          <Table sx={{
            '& thead th': {
              bgcolor: 'grey.50', color: 'text.secondary',
              fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', py: 1.25,
              borderBottom: '1px solid', borderColor: 'divider',
            },
            '& tbody td': { py: 1.5 },
          }}>
            <TableHead>
              <TableRow>
                <TableCell width={48} />
                <TableCell>Industry Association</TableCell>
                <TableCell>Invoice</TableCell>
                <TableCell align="right" width={140}>Total (₹)</TableCell>
                <TableCell align="right" width={160}>Recommended (₹)</TableCell>
                <TableCell width={160}>Stage</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">
                      {q ? `No notes match “${q}”.` : 'No capacity building notes yet.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {sorted.map((r) => (
                <RowGroup
                  key={r.id}
                  dto={r}
                  isOpen={expanded.has(r.id)}
                  onToggle={() => toggle(r.id)}
                  onDone={(msg) => setToast(msg)}
                />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {toast && <Alert severity={toast.kind} variant="filled" onClose={() => setToast(null)}>{toast.msg}</Alert>}
      </Snackbar>
    </Box>
  )
}

function RowGroup({ dto, isOpen, onToggle, onDone }) {
  const stage = stageOf(dto)
  return (
    <>
      <TableRow hover onClick={onToggle}
        sx={{
          cursor: 'pointer',
          '& td': { borderBottom: isOpen ? 'none' : undefined },
          bgcolor: isOpen ? 'action.hover' : 'transparent',
        }}>
        <TableCell>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggle() }}>
            {isOpen ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography fontWeight={700} fontSize="0.95rem">{dto.industryAssociationName || '—'}</Typography>
          <Typography variant="caption" color="text.secondary">{dto.gstinOfIa || 'GSTIN N/A'}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{dto.invoiceNumber || '—'}</Typography>
          <Typography variant="caption" color="text.secondary">{formatDate(dto.invoiceDate)}</Typography>
        </TableCell>
        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
          {formatMoney(dto.totalAmount)}
        </TableCell>
        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
          {formatMoney(dto.amountRecommendedForDisbursement)}
        </TableCell>
        <TableCell>
          <StageChip stage={stage} />
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={6} sx={{ p: 0, border: 0, bgcolor: 'grey.50' }}>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <ReviewPanel dto={dto} onDone={onDone} />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

function ReviewPanel({ dto, onDone }) {
  const initial = useMemo(() => toFormValues(dto), [dto])

  // BSE-entered rows the format lets SDE amend.
  const [natureOfPayment, setNatureOfPayment] = useState(initial.natureOfPayment || '')
  const [invoiceDate, setInvoiceDate] = useState((initial.invoiceDate || '').slice(0, 10))
  const [invoiceNumber, setInvoiceNumber] = useState(initial.invoiceNumber || '')
  const [valueOfServiceItemsSupplied, setValueOfServiceItems] = useState(initial.valueOfServiceItemsSupplied ?? '')
  const [compliance, setCompliance] = useState(initial.compliancePreDisbursementTerms || '')

  // SDE-owned rows.
  const [amount, setAmount] = useState(initial.amountRecommendedForDisbursement ?? '')
  const [accountCodeForPayment, setAccountCode] = useState(initial.accountCodeForPayment || DEFAULT_ACCOUNT_CODE)
  const [remarks, setRemarks] = useState('')
  const [remarksError, setRemarksError] = useState(false)

  const update = useUpdateDisbursementCapacityBuilding()
  const patchStatus = useUpdateDisbursementCapacityBuildingStatus()
  const busy = update.isPending || patchStatus.isPending

  // IGST and total follow whatever value is on screen, so an SDE amendment
  // to the invoice value re-derives them exactly as the adapter will on save.
  const value = num(valueOfServiceItemsSupplied)
  const igst = value != null ? +(value * 0.18).toFixed(2) : null
  const total = value != null ? +(value * 1.18).toFixed(2) : null

  const amendmentsDirty =
    (natureOfPayment || '') !== (initial.natureOfPayment || '') ||
    (invoiceDate || '') !== ((initial.invoiceDate || '').slice(0, 10)) ||
    (invoiceNumber || '') !== (initial.invoiceNumber || '') ||
    String(valueOfServiceItemsSupplied ?? '') !== String(initial.valueOfServiceItemsSupplied ?? '') ||
    (compliance || '') !== (initial.compliancePreDisbursementTerms || '') ||
    String(amount ?? '') !== String(initial.amountRecommendedForDisbursement ?? '') ||
    (accountCodeForPayment || '') !== (initial.accountCodeForPayment || DEFAULT_ACCOUNT_CODE)

  const fieldProblem = (() => {
    if (!natureOfPayment?.trim()) return 'Nature of payment cannot be blank.'
    if (!invoiceDate) return 'Invoice date cannot be blank.'
    if (!invoiceNumber?.trim()) return 'Invoice number cannot be blank.'
    if (value == null || value <= 0) return 'Enter a valid value of service / items supplied.'
    return null
  })()

  const approveProblem = (() => {
    if (fieldProblem) return fieldProblem
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) return 'Enter the amount recommended for disbursement.'
    if (total != null && n > total) return `Cannot exceed the total invoice amount (₹${total.toLocaleString('en-IN')}).`
    if (!accountCodeForPayment?.trim()) return 'Account Code is required.'
    return null
  })()

  // Push field-level amendments via PUT before touching status. `initial`
  // supplies the fields the SDE didn't edit (GT comments, GSTIN, etc.).
  const saveAmendments = async () => {
    await update.mutateAsync({
      id: dto.id,
      values: {
        ...initial,
        natureOfPayment,
        invoiceDate,
        invoiceNumber,
        valueOfServiceItemsSupplied,
        compliancePreDisbursementTerms: compliance,
        amountRecommendedForDisbursement: amount,
        accountCodeForPayment,
      },
    })
  }

  const decide = async (status) => {
    const needsRemarks = status === CONTENT_STATUS.REVERT || status === CONTENT_STATUS.REJECT
    if (needsRemarks && !remarks.trim()) {
      setRemarksError(true)
      onDone?.({
        kind: 'warning',
        msg: status === CONTENT_STATUS.REVERT
          ? 'Add remarks so the BSE knows what to change.'
          : 'Add remarks explaining the rejection.',
      })
      return
    }
    if (status === CONTENT_STATUS.APPROVED && approveProblem) {
      onDone?.({ kind: 'warning', msg: approveProblem })
      return
    }
    if (status !== CONTENT_STATUS.APPROVED && fieldProblem && amendmentsDirty) {
      onDone?.({ kind: 'warning', msg: fieldProblem })
      return
    }

    setRemarksError(false)
    try {
      if (amendmentsDirty) await saveAmendments()
      await patchStatus.mutateAsync({
        id: dto.id,
        status,
        remarks: remarks.trim() || undefined,
      })
      const label = status === CONTENT_STATUS.APPROVED ? 'Approved'
        : status === CONTENT_STATUS.REVERT ? 'Reverted' : 'Rejected'
      onDone?.({ kind: 'success', msg: `${label} · saved.` })
      setRemarks('')
    } catch (e) {
      onDone?.({ kind: 'error', msg: e?.message || 'Failed to update status.' })
    }
  }

  const saveOnly = async () => {
    if (fieldProblem) { onDone?.({ kind: 'warning', msg: fieldProblem }); return }
    try {
      await saveAmendments()
      onDone?.({ kind: 'success', msg: 'Amendments saved.' })
    } catch (e) {
      onDone?.({ kind: 'error', msg: e?.message || 'Failed to save amendments.' })
    }
  }

  return (
    <Box sx={{ p: 2.5 }}>
      <Stack spacing={2}>
        <SubCard title="IA & Grant">
          <Grid container spacing={2.5}>
            <Snippet label="GSTIN of IA" value={dto.gstinOfIa} mono />
            <Snippet label="GSTIN of SIDBI" value={dto.gstinOfSidbi} mono />
            <Snippet label="Sanctioned" value={formatMoney(dto.sanctionedAmount)} prefix="₹" />
            <Snippet label="Disbursed till Date" value={formatMoney(dto.disbursedTillDate)} prefix="₹" />
            <Snippet label="Disbursement Sought" value={formatMoney(dto.disbursementSought)} prefix="₹" />
            <Snippet label="TDS" value={dto.tdsApplicable === true ? 'Yes' : dto.tdsApplicable === false ? 'No' : null} />
            {dto.tdsApplicable === false && (
              <Snippet label="Reason TDS not applicable" value={dto.tdsNotApplicableReason} span={{ xs: 12, lg: 6 }} />
            )}
          </Grid>
        </SubCard>

        <SubCard title="GT — Event Organisation, Outcome & Impact">
          {dto.gtCommentsOnEventOutcomeImpact
            ? <Typography sx={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{dto.gtCommentsOnEventOutcomeImpact}</Typography>
            : <Typography variant="body2" color="text.disabled">GT hasn't recorded event comments yet.</Typography>}
        </SubCard>

        <SubCard title="Amendments — BSE entries the SDE may revise">
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField
                fullWidth size="small" multiline minRows={5}
                label="Nature of Payment"
                value={natureOfPayment}
                onChange={(e) => setNatureOfPayment(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth size="small" type="date"
                label="Invoice Date"
                InputLabelProps={{ shrink: true }}
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth size="small"
                label="Invoice Number"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth size="small" type="number"
                label="Value of service / Items supplied"
                value={valueOfServiceItemsSupplied ?? ''}
                onChange={(e) => setValueOfServiceItems(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth size="small"
                label="IGST @18%"
                value={igst != null ? igst.toLocaleString('en-IN') : ''}
                InputProps={{
                  readOnly: true,
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                }}
                InputLabelProps={{ shrink: true }}
                helperText="Auto-calculated"
                sx={{ '& .MuiInputBase-root': { bgcolor: 'action.hover' } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth size="small"
                label="Total Amount"
                value={total != null ? total.toLocaleString('en-IN') : ''}
                InputProps={{
                  readOnly: true,
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                }}
                InputLabelProps={{ shrink: true }}
                helperText="Auto-calculated"
                sx={{ '& .MuiInputBase-root': { bgcolor: 'action.hover' } }}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth size="small" multiline minRows={2}
                label="Compliance of Pre-disbursement Terms & Conditions"
                value={compliance}
                onChange={(e) => setCompliance(e.target.value)}
              />
            </Grid>
          </Grid>
        </SubCard>

        <SubCard title="SDE — Recommendation" accent="primary">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth size="small" type="number"
                label="Amount Recommended for Disbursement"
                value={amount ?? ''}
                onChange={(e) => setAmount(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                helperText={`Max ₹${Number(total || 0).toLocaleString('en-IN')} — required to approve.`}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth size="small"
                label="Account Code"
                value={accountCodeForPayment}
                onChange={(e) => setAccountCode(e.target.value)}
                helperText={`Default: ${DEFAULT_ACCOUNT_CODE}`}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth size="small" multiline minRows={2} maxRows={4}
                label="Remarks"
                placeholder="Required to revert or reject. Optional on approve."
                value={remarks}
                error={remarksError}
                onChange={(e) => { setRemarks(e.target.value); if (e.target.value.trim()) setRemarksError(false) }}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            {initial.status && (
              <Chip
                size="small"
                label={`Currently ${labelFor(initial.status)}`}
                sx={{ fontWeight: 600 }}
                color={initial.status === 'APPROVED' ? 'success'
                  : initial.status === 'REJECT' ? 'error'
                  : initial.status === 'REVERT' ? 'warning' : 'default'}
              />
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Button
              onClick={saveOnly}
              disabled={!amendmentsDirty || busy}
              startIcon={update.isPending ? <CircularProgress size={16} /> : <SaveIcon />}
              sx={{ textTransform: 'none', color: 'text.secondary' }}
            >
              Save amendments
            </Button>
            <Button
              onClick={() => decide(CONTENT_STATUS.REVERT)}
              disabled={busy}
              startIcon={<UndoRoundedIcon />}
              sx={{ textTransform: 'none', color: 'warning.dark' }}
            >
              Revert
            </Button>
            <Button
              onClick={() => decide(CONTENT_STATUS.REJECT)}
              disabled={busy}
              startIcon={<CancelRoundedIcon />}
              sx={{ textTransform: 'none', color: 'error.dark' }}
            >
              Reject
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={() => decide(CONTENT_STATUS.APPROVED)}
              disabled={busy}
              startIcon={patchStatus.isPending ? <CircularProgress size={16} color="inherit" /> : <CheckCircleRoundedIcon />}
              sx={{ textTransform: 'none', fontWeight: 600 }}
              color="success"
            >
              Approve
            </Button>
          </Stack>
        </SubCard>
      </Stack>
    </Box>
  )
}

// ── Building blocks (mirror of the GT page — kept local, as the CAPEX pair does) ──

function SubCard({ title, accent, children }) {
  return (
    <Paper variant="outlined" sx={{
      p: 2,
      borderColor: accent === 'primary' ? 'primary.light' : 'divider',
      bgcolor: 'background.paper', borderRadius: 1.5,
    }}>
      <Typography variant="overline" sx={{
        display: 'block', mb: 1.5,
        color: accent === 'primary' ? 'primary.dark' : 'text.secondary',
        fontWeight: 700, letterSpacing: '0.1em',
      }}>{title}</Typography>
      {children}
    </Paper>
  )
}

function Snippet({ label, value, prefix, mono, strong, span }) {
  const isEmpty = value == null || value === ''
  return (
    <Grid size={span ?? { xs: 12, sm: 6, md: 4, lg: 2 }}>
      <Typography variant="caption" color="text.secondary"
        sx={{ display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.68rem', fontWeight: 600, mb: 0.5 }}>
        {label}
      </Typography>
      <Typography sx={{
        fontWeight: strong ? 700 : 500,
        fontSize: strong ? '0.95rem' : '0.88rem',
        color: isEmpty ? 'text.disabled' : 'text.primary',
        fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' : undefined,
        fontVariantNumeric: 'tabular-nums', wordBreak: 'break-word',
      }}>
        {prefix && !isEmpty && <Box component="span" sx={{ color: 'text.secondary', mr: 0.5 }}>{prefix}</Box>}
        {isEmpty ? '—' : value}
      </Typography>
    </Grid>
  )
}

function StageChip({ stage }) {
  const color = stage === 'Recommended' ? 'success'
    : stage === 'Not Recommended' ? 'error'
    : stage === 'GT Commented' ? 'info'
    : 'warning'
  return <Chip size="small" color={color} label={stage} sx={{ fontWeight: 700 }} />
}

function labelFor(status) {
  switch (status) {
    case 'APPROVED': return 'Approved'
    case 'REJECT':   return 'Rejected'
    case 'REVERT':   return 'Reverted'
    default:         return 'Pending'
  }
}

function num(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
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
