import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Stack, Typography, Button, Chip,
  CircularProgress, Snackbar, Alert, TextField, MenuItem, InputAdornment,
  Table, TableHead, TableBody, TableRow, TableCell, FormControlLabel, Switch,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import { SectionCard, Mono } from '../../components/shared'
import { useVendorDisbursement, useUpdateVendorDisbursement } from '../../queries'

// HO Maker's review page for a single vendor disbursement.
//
// Editable-vs-read-only follows the spec:
//   • Read-only for HO: vendor autofill, Annexure I rows, Disbursement Summary.
//   • Editable at HO Maker level: Invoice fields, Compliance, plus the HO
//     Decision block (Amount Recommended, Recommendation, Status, Verified/
//     Approved By).
// One Save button PUTs the whole record back.

const RECOMMENDATION_OPTIONS = ['Recommended', 'Not Recommended', 'Hold']

function statusColor(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'approved') return 'success'
  if (s === 'rejected') return 'error'
  if (s === 'on hold') return 'warning'
  return 'default'
}

export default function HoDisbursementReview() {
  const { id } = useParams()
  const navigate = useNavigate()

  const q = useVendorDisbursement(id)
  const updateM = useUpdateVendorDisbursement()
  const dto = q.data

  const [toast, setToast] = useState({ severity: '', msg: '' })

  // Only the fields HO can touch. `verifiedBy` (from GT) and `approvedBy`
  // / `status` (backend-owned) aren't editable — they show up in the header
  // chip / audit trail only.
  const [edit, setEdit] = useState({
    invoiceDate: '', invoiceNumber: '', invoiceValue: '',
    complianceTerms: 'No',
    recommendedDisbursementAmount: '',
    recommendation: '',
  })
  useEffect(() => {
    if (!dto) return
    setEdit({
      invoiceDate: (dto.invoiceDate || '').slice(0, 10),
      invoiceNumber: dto.invoiceNumber || '',
      invoiceValue: dto.invoiceValue ?? '',
      complianceTerms: dto.complianceTerms || 'No',
      recommendedDisbursementAmount: dto.recommendedDisbursementAmount ?? '',
      recommendation: dto.recommendation || '',
    })
  }, [dto])

  const setField = useCallback((name, value) => {
    setEdit((prev) => ({ ...prev, [name]: value }))
  }, [])

  const invoiceValueNum = edit.invoiceValue === '' ? null : Number(edit.invoiceValue)
  const gstAmount = invoiceValueNum == null ? '' : +(invoiceValueNum * 0.18).toFixed(2)
  const invoiceTotal = invoiceValueNum == null ? '' : +(invoiceValueNum * 1.18).toFixed(2)

  // Read the per-BSE rows off the correct backend key. `dto` reference is
  // stable across parent re-renders (react-query only swaps it on refetch),
  // so `rows` also stays referentially stable — that's what keeps the
  // Annexure table's `memo` cold while HO types in the fields above it.
  const rows = useMemo(() => detailsOf(dto), [dto])
  const totalNet = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.paymentToBse) || 0), 0),
    [rows],
  )
  // Number version of invoiceTotal (or null) — passed to HoDecisionBlock
  // so the cap prop is a stable primitive, not a string like '' or a Number
  // literal re-created each render.
  const cap = invoiceTotal === '' || invoiceTotal == null ? null : Number(invoiceTotal)

  const save = useCallback(async () => {
    if (!dto) return
    // Cap enforcement — Amount Recommended can't exceed the invoice total.
    const amt = numOrNull(edit.recommendedDisbursementAmount)
    const cap = numOrNull(invoiceTotal)
    if (amt != null && cap != null && amt > cap) {
      setToast({ severity: 'warning', msg: `Amount Recommended (₹${amt.toLocaleString('en-IN')}) can't exceed the invoice total (₹${cap.toLocaleString('en-IN')}).` })
      return
    }
    try {
      await updateM.mutateAsync({
        id,
        values: {
          ...dto,
          // HO-modifiable invoice fields (with IGST + Total recomputed).
          invoiceDate: edit.invoiceDate || null,
          invoiceNumber: edit.invoiceNumber || null,
          invoiceValue: numOrNull(edit.invoiceValue),
          gstAmount: numOrNull(gstAmount),
          totalAmount: numOrNull(invoiceTotal),
          // HO-modifiable compliance.
          complianceTerms: edit.complianceTerms || null,
          // HO decision — only these two are HO-owned. `verifiedBy` came
          // from GT (leave as-is); `approvedBy` / `status` are backend-
          // stamped once recommendation is captured.
          recommendedDisbursementAmount: amt,
          recommendation: edit.recommendation || null,
        },
      })
      setToast({ severity: 'success', msg: 'HO review saved.' })
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Failed to save review.' })
    }
  }, [dto, id, edit, gstAmount, invoiceTotal, updateM])

  if (q.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
  }
  if (q.error) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/sde/vendor-disbursements')} sx={{ mb: 2 }}>Vendor Disbursements</Button>
        <Alert severity="error">{q.error.message || 'Failed to load disbursement'}</Alert>
      </Box>
    )
  }
  if (!dto) return null

  const saving = updateM.isPending

  return (
    <Box sx={{ pb: 9 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/sde/vendor-disbursements')} sx={{ mb: 2 }}>
        Vendor Disbursements
      </Button>

      <Card sx={{ mb: 2.5 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
            <Typography variant="h5">{dto.manpowerAgencyName || 'Vendor'}</Typography>
            <Chip size="small" color={statusColor(dto.status)} variant={dto.status ? 'filled' : 'outlined'}
              label={dto.status || 'Pending HO review'} />
            {dto.recommendation && (
              <Chip size="small" color={dto.recommendation === 'Recommended' ? 'success' : 'error'}
                label={dto.recommendation} sx={{ fontWeight: 600 }} />
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Invoice {dto.invoiceNumber || '—'} · {formatDate(dto.invoiceDate)}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Stack spacing={2.5}>
        {/* Read-only sections — what the MPA submitted */}
        <VendorDetails dto={dto} />
        <AnnexureTable rows={rows} total={totalNet} />
        <DisbursementSummary dto={dto} total={totalNet} />

        {/* Editable sections — HO can modify these */}
        <InvoiceEditable
          date={edit.invoiceDate}
          number={edit.invoiceNumber}
          value={edit.invoiceValue}
          gstAmount={gstAmount}
          total={invoiceTotal}
          onSet={setField}
          disabled={saving}
        />
        <TdsAndComplianceEditable
          dto={dto}
          complianceTerms={edit.complianceTerms}
          onSet={setField}
          disabled={saving}
        />
        <HoDecisionBlock
          amount={edit.recommendedDisbursementAmount}
          recommendation={edit.recommendation}
          cap={cap}
          onSet={setField}
          disabled={saving}
        />
      </Stack>

      <Card sx={{ position: 'sticky', bottom: 16, mt: 3, p: 1.5, borderRadius: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
        <Button color="inherit" onClick={() => navigate('/sde/vendor-disbursements')} disabled={saving}>Cancel</Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={save}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save HO Review'}
        </Button>
      </Card>

      <Snackbar open={!!toast.msg} autoHideDuration={3000}
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

// ── Read-only sections (what the MPA submitted) ─────────────────────────────

const VendorDetails = memo(function VendorDetails({ dto }) {
  return (
    <SectionCard title="Vendor Details" subtitle="As submitted by the Manpower Agency (read-only for HO).">
      <Grid container spacing={2}>
        <ReadField label="Manpower Agency Name" value={dto.manpowerAgencyName} span={6} />
        <ReadField label="GSTIN of the Agency" value={dto.gstinOfAgency} span={3} mono />
        <ReadField label="GSTIN of SIDBI" value={dto.gstinOfSdbi} span={3} mono />
        {dto.reasonForNoGstin && (
          <ReadField label="GSTIN N/A reason" value={dto.reasonForNoGstin} span={12} />
        )}
        <ReadField label="Sanctioned Amount" value={formatMoneyStr(dto.sanctionedAmount)} span={3} />
        <ReadField label="Disbursed till date" value={formatDate(dto.disbursedTillDate)} span={3} />
        <ReadField label="Applicability of TDS" value={dto.tdsApplicable ? 'Yes' : 'No'} span={3} />
        {dto.tdsNotApplicableReason && (
          <ReadField label="TDS N/A reason" value={dto.tdsNotApplicableReason} span={3} />
        )}
      </Grid>
    </SectionCard>
  )
})

const AnnexureTable = memo(function AnnexureTable({ rows, total }) {
  return (
    <SectionCard title="Annexure I — BSE-wise Details" subtitle="Submitted by the Manpower Agency.">
      {rows.length === 0 ? (
        <Alert severity="info">No BSE rows in this disbursement.</Alert>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell width={48}>#</TableCell>
                <TableCell>IA</TableCell>
                <TableCell>BSE</TableCell>
                <TableCell>Salary Month</TableCell>
                <TableCell align="right">Paid Days</TableCell>
                <TableCell align="right">Additional (₹)</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell align="right">Payment to BSE (₹)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.id ?? r.bseId ?? i}>
                  <TableCell><Mono>{i + 1}</Mono></TableCell>
                  <TableCell><Mono>{r.iaId || '—'}</Mono></TableCell>
                  <TableCell><Mono>{r.bseId || '—'}</Mono></TableCell>
                  <TableCell>{r.salaryMonth || '—'}</TableCell>
                  <TableCell align="right"><Mono>{r.paidDays ?? r.salaryDays ?? '—'}</Mono></TableCell>
                  <TableCell align="right"><Mono>{formatNumber(r.additionalAmount)}</Mono></TableCell>
                  <TableCell>{r.additionalAmountReason || '—'}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    <Mono>{formatNumber(r.paymentToBse)}</Mono>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={7} align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.dark' }}>
                  ₹{total.toLocaleString('en-IN')}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>
      )}
    </SectionCard>
  )
})

const DisbursementSummary = memo(function DisbursementSummary({ dto, total }) {
  return (
    <SectionCard title="Disbursement Summary" subtitle="Auto-derived from Annexure I.">
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <ReadTextField label="Disbursement Sought (₹)"
            value={dto.disbursementSoughtIn ? Number(dto.disbursementSoughtIn).toLocaleString('en-IN') : total.toLocaleString('en-IN')}
            startAdornment="₹" strong />
        </Grid>
        <Grid size={{ xs: 12, sm: 8 }}>
          <ReadTextField label="Nature of Payment" value={dto.natureOfPayment || '—'} multiline />
        </Grid>
      </Grid>
    </SectionCard>
  )
})

// ── Editable sections (HO can modify these) ────────────────────────────────

const InvoiceEditable = memo(function InvoiceEditable({ date, number, value, gstAmount, total, onSet, disabled }) {
  const commitDate = useCallback((v) => onSet('invoiceDate', v), [onSet])
  const commitNumber = useCallback((v) => onSet('invoiceNumber', v), [onSet])
  const commitValue = useCallback((v) => onSet('invoiceValue', v), [onSet])
  return (
    <SectionCard title="Invoice Details" subtitle="Modifiable at HO Maker level. IGST and Total are auto-computed.">
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 3 }}>
          <LocalCommitField label="Invoice Date" type="date" value={date}
            onCommit={commitDate} disabled={disabled}
            InputLabelProps={INPUT_LABEL_SHRINK} />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <LocalCommitField label="Invoice Number" value={number}
            onCommit={commitNumber} disabled={disabled} />
        </Grid>
        <Grid size={{ xs: 12, sm: 2 }}>
          <LocalCommitField label="Value of Service" type="number" value={value}
            onCommit={commitValue} disabled={disabled}
            InputProps={INPUT_ADORN_RUPEE} />
        </Grid>
        <Grid size={{ xs: 12, sm: 2 }}>
          <ReadTextField label="IGST @18%"
            value={gstAmount === '' ? '' : formatNumber(gstAmount)}
            startAdornment="₹" />
        </Grid>
        <Grid size={{ xs: 12, sm: 2 }}>
          <ReadTextField label="Total Amount"
            value={total === '' ? '' : formatNumber(total)}
            startAdornment="₹" strong />
        </Grid>
      </Grid>
    </SectionCard>
  )
})

const TdsAndComplianceEditable = memo(function TdsAndComplianceEditable({ dto, complianceTerms, onSet, disabled }) {
  const compliant = String(complianceTerms || '').toLowerCase() === 'yes'
  const onToggle = useCallback((_, v) => onSet('complianceTerms', v ? 'Yes' : 'No'), [onSet])
  return (
    <SectionCard title="TDS & Compliance" subtitle="Compliance is modifiable at HO Maker level. TDS applicability is inherited from the vendor profile.">
      <Grid container spacing={2} alignItems="center">
        <ReadField label="Applicability of TDS" value={dto.tdsApplicable ? 'Yes' : 'No'} span={3} />
        <ReadField label="Account Code" value={dto.accountCode || 'EX1909010'} span={3} mono />
        <Grid size={{ xs: 12, sm: 6 }}>
          <FormControlLabel
            control={<Switch checked={compliant} onChange={onToggle} disabled={disabled} />}
            label={compliant
              ? 'Compliance of pre-disbursement terms confirmed'
              : 'Compliance of pre-disbursement terms & conditions — not confirmed'}
          />
        </Grid>
      </Grid>
    </SectionCard>
  )
})

const HoDecisionBlock = memo(function HoDecisionBlock({
  amount, recommendation, cap, onSet, disabled,
}) {
  // Clamp on commit (blur) — HO can type freely but any value > cap gets
  // snapped down to the cap the moment they leave the field. Prevents
  // full-page re-renders during typing.
  const commitAmount = useCallback((v) => {
    if (v === '' || v == null) return onSet('recommendedDisbursementAmount', '')
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0) return onSet('recommendedDisbursementAmount', '')
    if (cap != null && n > cap) return onSet('recommendedDisbursementAmount', cap)
    onSet('recommendedDisbursementAmount', v)
  }, [onSet, cap])
  const setRec = useCallback((e) => onSet('recommendation', e.target.value), [onSet])

  const helperText = cap != null
    ? `Max ₹${cap.toLocaleString('en-IN')} (invoice total).`
    : 'Enter the amount to recommend for disbursement.'

  return (
    <SectionCard title="HO Decision" subtitle="Recommend an amount (≤ invoice total) and pick a recommendation.">
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <LocalCommitField label="Amount Recommended (₹)" type="number" value={amount}
            onCommit={commitAmount} disabled={disabled}
            helperText={helperText}
            InputProps={INPUT_ADORN_RUPEE}
            inputProps={cap != null ? { min: 0, max: cap, step: 1 } : { min: 0, step: 1 }} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField select fullWidth size="small" label="Recommendation"
            value={recommendation} onChange={setRec} disabled={disabled}>
            <MenuItem value=""><em>Select…</em></MenuItem>
            {RECOMMENDATION_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
          </TextField>
        </Grid>
      </Grid>
    </SectionCard>
  )
})

// Uncontrolled text/number field — holds its own value while typing and
// only calls `onCommit` on blur or Enter. Same pattern as CellMoney on the
// MPA raise page. External updates (e.g. dto refetch) still sync in via
// the `value` prop, guarded by `externalRef` so identical writes don't
// bounce the local state.
const LocalCommitField = memo(function LocalCommitField({
  value, onCommit, ...rest
}) {
  const [local, setLocal] = useState(value ?? '')
  const externalRef = useRef(value ?? '')

  useEffect(() => {
    const next = value ?? ''
    if (next !== externalRef.current) {
      externalRef.current = next
      setLocal(next)
    }
  }, [value])

  const commit = () => {
    if (local === externalRef.current) return
    externalRef.current = local
    onCommit(local)
  }

  return (
    <TextField
      fullWidth size="small"
      {...rest}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (rest.type === 'number' && (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E')) {
          e.preventDefault(); return
        }
        if (e.key === 'Enter') { e.preventDefault(); commit() }
      }}
    />
  )
})

// Stable prop refs so the memoized fields don't invalidate on parent re-renders.
const INPUT_ADORN_RUPEE = {
  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
}
const INPUT_LABEL_SHRINK = { shrink: true }

// ── Tiny helpers ───────────────────────────────────────────────────────────

function ReadField({ label, value, span = 6, mono }) {
  return (
    <Grid size={{ xs: 12, sm: span }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
      <Typography fontWeight={500} sx={mono ? { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '0.9rem' } : undefined}>
        {value || '—'}
      </Typography>
    </Grid>
  )
}

function ReadTextField({ label, value, startAdornment, strong, multiline }) {
  return (
    <TextField fullWidth size="small" label={label}
      value={value ?? ''} multiline={!!multiline} minRows={multiline ? 2 : undefined}
      InputProps={{
        readOnly: true,
        startAdornment: startAdornment ? <InputAdornment position="start">{startAdornment}</InputAdornment> : undefined,
      }}
      sx={strong
        ? { '& .MuiInputBase-root': { bgcolor: 'action.hover', fontWeight: 700, color: 'primary.dark' } }
        : { '& .MuiInputBase-root': { bgcolor: 'action.hover' } }}
    />
  )
}

function numOrNull(v) {
  if (v === '' || v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function formatNumber(v) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-IN') : String(v)
}

function formatMoneyStr(v) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN')}` : String(v)
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Backend GET nests per-BSE rows under `monthlySalaryDetails`; POST-side
// uses `details`. Read whichever the server actually sent so the row list
// stays referentially stable across renders (which lets the memoized
// AnnexureTable skip re-rendering while HO types into unrelated fields).
function detailsOf(dto) {
  if (!dto) return EMPTY_ROWS
  if (Array.isArray(dto.monthlySalaryDetails)) return dto.monthlySalaryDetails
  if (Array.isArray(dto.details)) return dto.details
  return EMPTY_ROWS
}
const EMPTY_ROWS = Object.freeze([])
