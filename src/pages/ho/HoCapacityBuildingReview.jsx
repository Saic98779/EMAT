import { useMemo, useState } from 'react'
import {
  Box, Card, Table, TableHead, TableBody, TableRow, TableCell, Typography,
  Button, Alert, CircularProgress, TextField, InputAdornment, Chip, Collapse,
  IconButton, Stack, Grid, Paper, Snackbar, Radio, RadioGroup, FormControl,
  FormControlLabel, FormLabel, Divider,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import SaveIcon from '@mui/icons-material/Save'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { PageHeader } from '../../components/shared'
import {
  useCapacityBuildingOfficials, useUpdateCapacityBuildingOfficials,
} from '../../queries'
import {
  toFormValues, stageOf, DEFAULT_ACCOUNT_CODE, RECOMMENDED, NOT_RECOMMENDED,
} from '../../apis/disbursementCapacityBuildingOfficials'

// SIDBI HO Maker — capacity building (IA officials) approval queue.
// HO Maker owns rows 10, 11 and 14 of the note format (amount recommended,
// account code, recommendation) and may additionally revise the agency-entered
// rows the format marks "modifiable at SIDBI HO Maker level": nature of
// payment, the invoice trio, and pre-disbursement compliance.
export default function HoCapacityBuildingReview() {
  const { data: rows = [], isLoading, isFetching, error, refetch } = useCapacityBuildingOfficials()
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())
  const [toast, setToast] = useState(null)

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((r) =>
      [r.invoiceNumber, r.eventManagementAgencyName, r.registrationName, r.natureOfPayment]
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
        title="Capacity Building (IA Officials) Approvals"
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
        size="small" placeholder="Search agency, IA, invoice, nature of payment…" value={q}
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
                <TableCell>Event Management Agency</TableCell>
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
                      {q ? `No notes match “${q}”.` : 'No IA officials notes yet.'}
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
          <Typography fontWeight={700} fontSize="0.95rem">{dto.eventManagementAgencyName || '—'}</Typography>
          <Typography variant="caption" color="text.secondary">{dto.registrationName || dto.gstinOfAgency || '—'}</Typography>
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
  // `recommendation` is a free-text column on the backend; the UI only ever
  // writes RECOMMENDED / NOT_RECOMMENDED, and '' means "not yet decided".
  const [recommendation, setRecommendation] = useState(initial.recommendation || '')
  const isRecommended = recommendation === RECOMMENDED

  const update = useUpdateCapacityBuildingOfficials()

  // IGST and total follow whatever value is on screen, so an SDE amendment
  // to the invoice value re-derives them exactly as the adapter will on save.
  const value = num(valueOfServiceItemsSupplied)
  const igst = value != null ? +(value * 0.18).toFixed(2) : null
  const total = value != null ? +(value * 1.18).toFixed(2) : null

  const dirty =
    (natureOfPayment || '') !== (initial.natureOfPayment || '') ||
    (invoiceDate || '') !== ((initial.invoiceDate || '').slice(0, 10)) ||
    (invoiceNumber || '') !== (initial.invoiceNumber || '') ||
    String(valueOfServiceItemsSupplied ?? '') !== String(initial.valueOfServiceItemsSupplied ?? '') ||
    (compliance || '') !== (initial.compliancePreDisbursementTerms || '') ||
    String(amount ?? '') !== String(initial.amountRecommendedForDisbursement ?? '') ||
    (accountCodeForPayment || '') !== (initial.accountCodeForPayment || DEFAULT_ACCOUNT_CODE) ||
    (recommendation || '') !== (initial.recommendation || '')

  const problem = (() => {
    if (!natureOfPayment?.trim()) return 'Nature of payment cannot be blank.'
    if (!invoiceDate) return 'Invoice date cannot be blank.'
    if (!invoiceNumber?.trim()) return 'Invoice number cannot be blank.'
    if (value == null || value <= 0) return 'Enter a valid value of service / items supplied.'
    if (isRecommended) {
      const n = Number(amount)
      if (!Number.isFinite(n) || n <= 0) return 'Enter the amount recommended for disbursement.'
      if (total != null && n > total) return `Cannot exceed the total invoice amount (₹${total.toLocaleString('en-IN')}).`
      if (!accountCodeForPayment?.trim()) return 'Account Code is required.'
    }
    if (!recommendation) return 'Record a recommendation.'
    return null
  })()

  const canSave = dirty && !problem

  const save = async () => {
    if (problem) { onDone?.({ kind: 'warning', msg: problem }); return }
    try {
      await update.mutateAsync({
        id: dto.id,
        values: {
          ...initial,
          natureOfPayment,
          invoiceDate,
          invoiceNumber,
          valueOfServiceItemsSupplied,
          compliancePreDisbursementTerms: compliance,
          amountRecommendedForDisbursement: isRecommended ? amount : null,
          accountCodeForPayment,
          recommendation,
        },
      })
      onDone?.({ kind: 'success', msg: 'Recommendation saved.' })
    } catch (e) {
      onDone?.({ kind: 'error', msg: e?.message || 'Failed to save recommendation.' })
    }
  }

  return (
    <Box sx={{ p: 2.5 }}>
      <Stack spacing={2}>
        <SubCard title="Agency & Grant">
          <Grid container spacing={2.5}>
            <Snippet label="GSTIN of Agency" value={dto.gstinOfAgency} mono />
            <Snippet label="Industry Association" value={dto.registrationName} />
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

        <SubCard title="GT PMU — Event Organisation, Outcome & Impact">
          {dto.gtCommentsOnEventOutcomeImpact
            ? <Typography sx={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{dto.gtCommentsOnEventOutcomeImpact}</Typography>
            : <Typography variant="body2" color="text.disabled">GT PMU hasn't recorded event comments yet.</Typography>}
        </SubCard>

        <SubCard title="Amendments — agency entries the HO Maker may revise">
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

        <SubCard title="HO Maker — Recommendation" accent="primary">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl required>
                <FormLabel sx={{ fontSize: '0.78rem', mb: 0.5 }}>Recommendation</FormLabel>
                <RadioGroup row value={recommendation || ''}
                  onChange={(e) => setRecommendation(e.target.value)}>
                  <FormControlLabel value={RECOMMENDED} control={<Radio size="small" />} label="Recommended" />
                  <FormControlLabel value={NOT_RECOMMENDED} control={<Radio size="small" />} label="Not Recommended" />
                </RadioGroup>
              </FormControl>
            </Grid>

            {isRecommended && (
              <>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth size="small" type="number" required
                    label="Amount Recommended for Disbursement"
                    value={amount ?? ''}
                    onChange={(e) => setAmount(e.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                    helperText={`Max ₹${Number(total || 0).toLocaleString('en-IN')}`}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth size="small" required
                    label="Account Code"
                    value={accountCodeForPayment}
                    onChange={(e) => setAccountCode(e.target.value)}
                    helperText={`Default: ${DEFAULT_ACCOUNT_CODE}`}
                  />
                </Grid>
              </>
            )}
          </Grid>

          <Divider sx={{ my: 2 }} />

          <Stack direction="row" spacing={1.5} alignItems="center">
            {initial.recommendation && !dirty && (
              <Chip icon={<CheckCircleOutlineIcon />} size="small" color="success" variant="outlined"
                label="Saved" sx={{ fontWeight: 600 }} />
            )}
            {problem && dirty && (
              <Typography variant="caption" color="warning.main">{problem}</Typography>
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant="contained"
              startIcon={update.isPending ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              disabled={!canSave || update.isPending}
              onClick={save}
            >
              {update.isPending ? 'Saving…' : 'Save Recommendation'}
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
    : stage === 'PMU Commented' ? 'info'
    : 'warning'
  return <Chip size="small" color={color} label={stage} sx={{ fontWeight: 700 }} />
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
