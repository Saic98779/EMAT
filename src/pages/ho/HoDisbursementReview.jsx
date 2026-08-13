import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Stack, Typography, Button, Chip,
  CircularProgress, Snackbar, Alert, TextField, MenuItem, InputAdornment,
  Table, TableHead, TableBody, TableRow, TableCell, FormControlLabel, Switch,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import BlockIcon from '@mui/icons-material/Block'
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline'
import { SectionCard, Mono } from '../../components/shared'
import { useVendorDisbursement, useReviewerUpdateVendorDisbursement } from '../../queries'
import { useAuth } from '../../auth'

// HO Maker's review page for a single vendor disbursement.
//
// Editable-vs-read-only follows the spec:
//   • Read-only for HO: vendor autofill, Annexure I rows, Disbursement Summary.
//   • Editable at HO Maker level: Invoice fields, Compliance, plus the HO
//     Decision block (Amount Recommended, Recommendation, Status, Verified/
//     Approved By).
// One Save button PUTs the whole record back.

const RECOMMENDATION_OPTIONS = ['Recommended', 'Not Recommended', 'Hold']

// Map the HO recommendation to the status stamped on the record. Matches
// the same vocabulary the queue chip uses (see statusColor below).
function statusFromRecommendation(rec) {
  switch (String(rec || '').toLowerCase()) {
    case 'recommended':      return 'Approved'
    case 'not recommended':  return 'Rejected'
    case 'hold':             return 'On Hold'
    default:                 return null
  }
}

// YYYY-MM-DD in the browser's local timezone — used as `max` on the invoice
// date input so HO can't record a future-dated invoice.
function todayIso() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

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
  const { user } = useAuth()

  const q = useVendorDisbursement(id)
  const updateM = useReviewerUpdateVendorDisbursement()
  const dto = q.data

  const [toast, setToast] = useState({ severity: '', msg: '' })
  // Latch the "just saved" state so the completion banner persists past the
  // toast timeout. Cleared if the user hits "Edit review" to make changes.
  const [justSaved, setJustSaved] = useState(false)
  const [editMode, setEditMode] = useState(false)

  const MAX_DATE = useMemo(() => todayIso(), [])

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

  // Reject > cap up-front so the save button can be disabled and the
  // Amount Recommended field can render an inline error immediately.
  const amtNum = numOrNull(edit.recommendedDisbursementAmount)
  const amountOverCap = amtNum != null && cap != null && amtNum > cap
  const dateInFuture = edit.invoiceDate && edit.invoiceDate > MAX_DATE
  const recommendationMissing = !edit.recommendation
  const canSave = !amountOverCap && !dateInFuture && !recommendationMissing

  const save = useCallback(async () => {
    if (!dto) return
    if (amountOverCap) {
      setToast({ severity: 'warning', msg: `Amount Recommended (₹${amtNum.toLocaleString('en-IN')}) can't exceed the invoice total (₹${cap.toLocaleString('en-IN')}).` })
      return
    }
    if (dateInFuture) {
      setToast({ severity: 'warning', msg: 'Invoice Date can\'t be in the future.' })
      return
    }
    if (recommendationMissing) {
      setToast({ severity: 'warning', msg: 'Pick a recommendation.' })
      return
    }
    try {
      // Minimal PUT — only the fields HO changes. Backend merges with the
      // existing entity so financials + GT comments round-trip untouched.
      // `status` is derived from the recommendation; `approvedBy` is the
      // logged-in HO user.
      await updateM.mutateAsync({
        id,
        patch: {
          invoiceDate: edit.invoiceDate || null,
          invoiceNumber: edit.invoiceNumber || null,
          invoiceValue: numOrNull(edit.invoiceValue),
          gstAmount: numOrNull(gstAmount),
          totalAmount: numOrNull(invoiceTotal),
          complianceTerms: edit.complianceTerms || null,
          recommendedDisbursementAmount: amtNum,
          recommendation: edit.recommendation || null,
          status: statusFromRecommendation(edit.recommendation),
          approvedBy: user?.email || user?.username || 'HO Maker',
        },
      })
      setJustSaved(true)
      setEditMode(false)
      setToast({ severity: 'success', msg: 'HO review submitted.' })
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Failed to save review.' })
    }
  }, [dto, id, edit, gstAmount, invoiceTotal, updateM, amtNum, amountOverCap, cap, dateInFuture, recommendationMissing, user, MAX_DATE])

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
  // "Completed" state — either we just saved, or the record already has a
  // recorded recommendation and the user hasn't clicked Edit review.
  const completed = (justSaved || !!dto.recommendation) && !editMode
  // Snapshot of what the server currently holds, for the completion banner.
  const finalStatus = dto.status || statusFromRecommendation(dto.recommendation)

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

      {completed && (
        <CompletionBanner
          status={finalStatus}
          recommendation={dto.recommendation}
          amount={dto.recommendedDisbursementAmount}
          approvedBy={dto.approvedBy}
          onEdit={() => { setEditMode(true); setJustSaved(false) }}
          onBack={() => navigate('/sde/vendor-disbursements')}
        />
      )}

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
          maxDate={MAX_DATE}
          dateError={dateInFuture ? 'Invoice date can\'t be in the future.' : null}
          onSet={setField}
          disabled={saving || completed}
        />
        <TdsAndComplianceEditable
          dto={dto}
          complianceTerms={edit.complianceTerms}
          onSet={setField}
          disabled={saving || completed}
        />
        <HoDecisionBlock
          amount={edit.recommendedDisbursementAmount}
          recommendation={edit.recommendation}
          cap={cap}
          amountError={amountOverCap
            ? `Cannot exceed the invoice total (₹${cap.toLocaleString('en-IN')}).`
            : null}
          onSet={setField}
          disabled={saving || completed}
        />
      </Stack>

      {!completed && (
        <Card sx={{ position: 'sticky', bottom: 16, mt: 3, p: 1.5, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="body2" color={canSave ? 'text.secondary' : 'warning.main'} sx={{ flexGrow: 1 }}>
            {amountOverCap ? `Amount Recommended exceeds the invoice total (₹${cap.toLocaleString('en-IN')}).`
              : dateInFuture ? 'Invoice Date can\'t be in the future.'
              : recommendationMissing ? 'Pick a recommendation before saving.'
              : 'Ready to submit.'}
          </Typography>
          <Button color="inherit" onClick={() => navigate('/sde/vendor-disbursements')} disabled={saving}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={save}
            disabled={saving || !canSave}
          >
            {saving ? 'Saving…' : 'Save HO Review'}
          </Button>
        </Card>
      )}

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

// ── Completion banner (shown after HO review is submitted) ─────────────────

function CompletionBanner({ status, recommendation, amount, approvedBy, onEdit, onBack }) {
  const tone = status === 'Approved' ? 'success'
    : status === 'Rejected' ? 'error'
    : status === 'On Hold' ? 'warning'
    : 'info'
  const Icon = status === 'Approved' ? CheckCircleIcon
    : status === 'Rejected' ? BlockIcon
    : PauseCircleOutlineIcon
  const title = status === 'Approved' ? 'Recommended for disbursement'
    : status === 'Rejected' ? 'Not recommended'
    : status === 'On Hold' ? 'On hold'
    : 'HO review submitted'

  return (
    <Alert
      severity={tone}
      variant="outlined"
      icon={<Icon fontSize="large" />}
      sx={{
        mb: 2.5, alignItems: 'center', borderRadius: 2, borderWidth: 2,
        '& .MuiAlert-message': { flexGrow: 1, py: 1 },
      }}
      action={
        <Stack direction="row" spacing={1} sx={{ alignSelf: 'center' }}>
          <Button size="small" color="inherit" onClick={onEdit}>Edit review</Button>
          <Button size="small" variant="contained" color={tone} onClick={onBack}>Back to queue</Button>
        </Stack>
      }
    >
      <Typography fontWeight={800} sx={{ fontSize: '1rem', lineHeight: 1.2 }}>{title}</Typography>
      <Typography variant="body2" sx={{ mt: 0.25 }}>
        {recommendation && <>Decision: <strong>{recommendation}</strong>. </>}
        {amount != null && <>Amount recommended: <strong>₹{Number(amount).toLocaleString('en-IN')}</strong>. </>}
        {approvedBy && <>Approved by <strong>{approvedBy}</strong>.</>}
      </Typography>
    </Alert>
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
          <Table
            size="small"
            sx={{
              minWidth: 900,
              '& thead th': {
                bgcolor: 'grey.50', color: 'text.secondary',
                fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em',
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
                <TableCell align="right">Payment to BSE (₹)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.id ?? i} hover>
                  <TableCell><Mono>{i + 1}</Mono></TableCell>
                  <TableCell>
                    <Typography fontWeight={600} fontSize="0.88rem">{r.bseName || '—'}</Typography>
                  </TableCell>
                  <TableCell>{r.salaryMonth || '—'}</TableCell>
                  <TableCell align="right">{r.salaryDays ?? '—'}</TableCell>
                  <TableCell align="right">{r.paidDays ?? '—'}</TableCell>
                  <TableCell align="right">{formatNumber(r.additionalAmount)}</TableCell>
                  <TableCell sx={{ color: r.additionalAmountReason ? 'text.primary' : 'text.disabled' }}>
                    {r.additionalAmountReason || '—'}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 180 }}>
                    {r.gtAttendanceComments
                      ? <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{r.gtAttendanceComments}</Typography>
                      : <Typography variant="body2" color="text.disabled">Pending</Typography>}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {formatNumber(r.paymentToBse)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell colSpan={8} align="right" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>TOTAL</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, color: 'primary.dark', fontSize: '0.95rem' }}>
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

const InvoiceEditable = memo(function InvoiceEditable({ date, number, value, gstAmount, total, maxDate, dateError, onSet, disabled }) {
  const commitDate = useCallback((v) => onSet('invoiceDate', v), [onSet])
  const commitNumber = useCallback((v) => onSet('invoiceNumber', v), [onSet])
  const commitValue = useCallback((v) => onSet('invoiceValue', v), [onSet])
  const dateInputProps = useMemo(() => (maxDate ? { max: maxDate } : undefined), [maxDate])
  return (
    <SectionCard title="Invoice Details" subtitle="Modifiable at HO Maker level. IGST and Total are auto-computed.">
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 3 }}>
          <LocalCommitField label="Invoice Date" type="date" value={date}
            onCommit={commitDate} disabled={disabled}
            error={!!dateError}
            helperText={dateError || undefined}
            inputProps={dateInputProps}
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
  amount, recommendation, cap, amountError, onSet, disabled,
}) {
  // Controlled (updates on every keystroke) so the "over cap" helper turns
  // red live as HO types, instead of only after blur.
  const onAmountChange = useCallback((e) => {
    onSet('recommendedDisbursementAmount', e.target.value)
  }, [onSet])
  const setRec = useCallback((e) => onSet('recommendation', e.target.value), [onSet])

  const helperText = amountError
    ? amountError
    : cap != null
      ? `Max ₹${cap.toLocaleString('en-IN')} (invoice total).`
      : 'Enter the amount to recommend for disbursement.'

  return (
    <SectionCard title="HO Decision" subtitle="Recommend an amount (≤ invoice total) and pick a recommendation.">
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            fullWidth size="small"
            label="Amount Recommended (₹)"
            type="number"
            value={amount ?? ''}
            onChange={onAmountChange}
            disabled={disabled}
            error={!!amountError}
            helperText={helperText}
            InputProps={INPUT_ADORN_RUPEE}
            inputProps={{ min: 0, step: 1 }}
          />
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
