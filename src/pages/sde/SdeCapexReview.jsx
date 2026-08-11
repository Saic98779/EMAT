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
import { useDisbursementCapex, useUpdateDisbursementCapex } from '../../queries'
import { toFormValues, stageOf } from '../../apis/disbursementCapex'

// SIDBI SDE — CAPEX approval queue.
// SDE's editable fields on a CAPEX note: `amountRecommendedForDisbursement`,
// `accountCode`, `recommendation` (Yes/No). SDE can also revise the BSE-owned
// `preDisbursementCompliance` text since the spec allows it.
export default function SdeCapexReview() {
  const { data: rows = [], isLoading, isFetching, error, refetch } = useDisbursementCapex()
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())
  const [toast, setToast] = useState(null)

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((r) =>
      [r.invoiceNumber, r.industryAssociationName, r.detailsOfItems, r.gstinIa]
        .some((f) => (f || '').toLowerCase().includes(term)))
  }, [rows, q])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const da = a.invoiceDate || ''; const db = b.invoiceDate || ''
    return db.localeCompare(da)
  }), [filtered])

  const toggle = (uuid) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(uuid) ? next.delete(uuid) : next.add(uuid)
      return next
    })
  }

  const initialLoading = isLoading && rows.length === 0
  const refetching = isFetching && rows.length > 0

  return (
    <Box>
      <PageHeader
        title="CAPEX Approvals"
        subtitle={initialLoading ? 'Loading…'
          : `${sorted.length} CAPEX reimbursement note${sorted.length === 1 ? '' : 's'}`}
        action={
          <Button variant="outlined"
            startIcon={refetching ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={() => refetch()} disabled={isLoading}>
            {refetching ? 'Refreshing…' : 'Refresh'}
          </Button>}
      />

      <TextField
        size="small" placeholder="Search IA, invoice, items, GSTIN…" value={q}
        onChange={(e) => setQ(e.target.value)}
        sx={{ mb: 2, maxWidth: 380 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => refetch()}>Retry</Button>}>
          {error.message || 'Failed to load CAPEX notes'}
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
                      {q ? `No CAPEX notes match “${q}”.` : 'No CAPEX notes yet.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {sorted.map((r) => (
                <RowGroup
                  key={r.uuid}
                  dto={r}
                  isOpen={expanded.has(r.uuid)}
                  onToggle={() => toggle(r.uuid)}
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
          <Typography variant="caption" color="text.secondary">{dto.gstinIa || 'GSTIN N/A'}</Typography>
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
  const [amount, setAmount] = useState(initial.amountRecommendedForDisbursement ?? '')
  const [accountCode, setAccountCode] = useState(initial.accountCode || 'EX1909010')
  const [recommendation, setRecommendation] = useState(initial.recommendation)
  const [compliance, setCompliance] = useState(initial.preDisbursementCompliance || '')

  const update = useUpdateDisbursementCapex()

  const dirty =
    String(amount ?? '') !== String(initial.amountRecommendedForDisbursement ?? '') ||
    (accountCode || '') !== (initial.accountCode || 'EX1909010') ||
    recommendation !== initial.recommendation ||
    (compliance || '') !== (initial.preDisbursementCompliance || '')

  const problem = (() => {
    if (recommendation === true) {
      const n = Number(amount)
      if (!Number.isFinite(n) || n <= 0) return 'Enter the amount recommended for disbursement.'
      if (n > Number(dto.totalAmount || 0)) return `Cannot exceed the total invoice amount (₹${Number(dto.totalAmount).toLocaleString('en-IN')}).`
      if (!accountCode?.trim()) return 'Account Code is required.'
    }
    if (recommendation !== true && recommendation !== false) return 'Record a Yes/No recommendation.'
    return null
  })()

  const canSave = dirty && !problem

  const save = async () => {
    if (problem) { onDone?.({ kind: 'warning', msg: problem }); return }
    try {
      await update.mutateAsync({
        uuid: dto.uuid,
        values: {
          ...initial,
          preDisbursementCompliance: compliance,
          amountRecommendedForDisbursement: recommendation === true ? amount : null,
          accountCode,
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
        <SubCard title="Invoice & Grant">
          <Grid container spacing={2.5}>
            <Snippet label="Invoice Date" value={formatDate(dto.invoiceDate)} />
            <Snippet label="Invoice Number" value={dto.invoiceNumber} mono />
            <Snippet label="Value of Service" value={formatMoney(dto.valueOfServiceItems)} prefix="₹" />
            <Snippet label="IGST @18%" value={formatMoney(dto.igstAmount)} prefix="₹" />
            <Snippet label="Total" value={formatMoney(dto.totalAmount)} prefix="₹" strong />
            <Snippet label="Sanctioned" value={formatMoney(dto.sanctionedAmount)} prefix="₹" />
            <Snippet label="Disbursed till Date" value={formatMoney(dto.disbursedTillDate)} prefix="₹" />
            <Snippet label="TDS" value={dto.tdsApplicable === true ? 'Yes' : dto.tdsApplicable === false ? 'No' : null} />
            <Snippet label="Details of Items" value={dto.detailsOfItems} span={{ xs: 12 }} />
          </Grid>
        </SubCard>

        <SubCard title="GT — CAPEX Verification">
          {dto.gtCapexVerificationComments
            ? <Typography sx={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{dto.gtCapexVerificationComments}</Typography>
            : <Typography variant="body2" color="text.disabled">GT hasn't recorded verification comments yet.</Typography>}
        </SubCard>

        <SubCard title="SDE — Recommendation" accent="primary">
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField
                fullWidth size="small" multiline minRows={2}
                label="Compliance of Pre-disbursement Terms & Conditions"
                value={compliance}
                onChange={(e) => setCompliance(e.target.value)}
                helperText="Editable — SDE may revise BSE's text."
              />
            </Grid>

            <Grid size={12}>
              <Divider />
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl required>
                <FormLabel sx={{ fontSize: '0.78rem', mb: 0.5 }}>Recommendation</FormLabel>
                <RadioGroup row value={recommendation === true ? 'yes' : recommendation === false ? 'no' : ''}
                  onChange={(e) => setRecommendation(e.target.value === 'yes')}>
                  <FormControlLabel value="yes" control={<Radio size="small" />} label="Recommended" />
                  <FormControlLabel value="no" control={<Radio size="small" />} label="Not Recommended" />
                </RadioGroup>
              </FormControl>
            </Grid>

            {recommendation === true && (
              <>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth size="small" type="number" required
                    label="Amount Recommended for Disbursement"
                    value={amount ?? ''}
                    onChange={(e) => setAmount(e.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                    helperText={`Max ₹${Number(dto.totalAmount || 0).toLocaleString('en-IN')}`}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth size="small" required
                    label="Account Code"
                    value={accountCode}
                    onChange={(e) => setAccountCode(e.target.value)}
                    helperText="Default: EX1909010"
                  />
                </Grid>
              </>
            )}
          </Grid>

          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2 }}>
            {initial.recommendation != null && !dirty && (
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

// ── Building blocks (identical to GT page — kept local to avoid a shared file) ──

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
    : stage === 'GT Verified' ? 'info'
    : 'warning'
  return <Chip size="small" color={color} label={stage} sx={{ fontWeight: 700 }} />
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
