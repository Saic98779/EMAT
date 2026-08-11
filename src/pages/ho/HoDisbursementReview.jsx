import { memo, useCallback, useEffect, useState } from 'react'
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
const STATUS_OPTIONS = ['Pending', 'Approved', 'Rejected', 'On Hold']

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

  // All fields HO can touch, held in one editable state object. Seeded from
  // the DTO on load / refetch.
  const [edit, setEdit] = useState({
    invoiceDate: '', invoiceNumber: '', invoiceValue: '',
    complianceTerms: 'No',
    recommendedDisbursementAmount: '',
    recommendation: '', status: '',
    verifiedBy: '', approvedBy: '',
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
      status: dto.status || '',
      verifiedBy: dto.verifiedBy || '',
      approvedBy: dto.approvedBy || '',
    })
  }, [dto])

  const setField = useCallback((name, value) => {
    setEdit((prev) => ({ ...prev, [name]: value }))
  }, [])

  const invoiceValueNum = edit.invoiceValue === '' ? null : Number(edit.invoiceValue)
  const gstAmount = invoiceValueNum == null ? '' : +(invoiceValueNum * 0.18).toFixed(2)
  const invoiceTotal = invoiceValueNum == null ? '' : +(invoiceValueNum * 1.18).toFixed(2)

  const save = useCallback(async () => {
    if (!dto) return
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
          // HO decision block.
          recommendedDisbursementAmount: numOrNull(edit.recommendedDisbursementAmount),
          recommendation: edit.recommendation || null,
          status: edit.status || null,
          verifiedBy: edit.verifiedBy || null,
          approvedBy: edit.approvedBy || null,
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

  const rows = Array.isArray(dto.details) ? dto.details : []
  const totalNet = rows.reduce((sum, r) => sum + (Number(r.paymentToBse) || 0), 0)
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
          status={edit.status}
          verifiedBy={edit.verifiedBy}
          approvedBy={edit.approvedBy}
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
  const setDate = useCallback((e) => onSet('invoiceDate', e.target.value), [onSet])
  const setNumber = useCallback((e) => onSet('invoiceNumber', e.target.value), [onSet])
  const setValue = useCallback((e) => onSet('invoiceValue', e.target.value), [onSet])
  return (
    <SectionCard title="Invoice Details" subtitle="Modifiable at HO Maker level. IGST and Total are auto-computed.">
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField fullWidth size="small" type="date" label="Invoice Date"
            InputLabelProps={{ shrink: true }} value={date} onChange={setDate} disabled={disabled} />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField fullWidth size="small" label="Invoice Number"
            value={number} onChange={setNumber} disabled={disabled} />
        </Grid>
        <Grid size={{ xs: 12, sm: 2 }}>
          <TextField fullWidth size="small" type="number" label="Value of Service"
            value={value} onChange={setValue} disabled={disabled}
            InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} />
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
  amount, recommendation, status, verifiedBy, approvedBy, onSet, disabled,
}) {
  const setAmount = useCallback((e) => onSet('recommendedDisbursementAmount', e.target.value), [onSet])
  const setRec = useCallback((e) => onSet('recommendation', e.target.value), [onSet])
  const setStatus = useCallback((e) => onSet('status', e.target.value), [onSet])
  const setV = useCallback((e) => onSet('verifiedBy', e.target.value), [onSet])
  const setA = useCallback((e) => onSet('approvedBy', e.target.value), [onSet])
  return (
    <SectionCard title="HO Decision" subtitle="Amount recommended, recommendation, and status.">
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField fullWidth size="small" type="number" label="Amount Recommended (₹)"
            value={amount} onChange={setAmount} disabled={disabled}
            InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField select fullWidth size="small" label="Recommendation"
            value={recommendation} onChange={setRec} disabled={disabled}>
            <MenuItem value=""><em>None</em></MenuItem>
            {RECOMMENDATION_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField select fullWidth size="small" label="Status"
            value={status} onChange={setStatus} disabled={disabled}>
            <MenuItem value=""><em>None</em></MenuItem>
            {STATUS_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField fullWidth size="small" label="Verified By"
            value={verifiedBy} onChange={setV} disabled={disabled} />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField fullWidth size="small" label="Approved By"
            value={approvedBy} onChange={setA} disabled={disabled} />
        </Grid>
      </Grid>
    </SectionCard>
  )
})

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
