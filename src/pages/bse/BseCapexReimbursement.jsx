import { memo, useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Stack, Typography, Button, Snackbar, Alert,
  Paper, CircularProgress, TextField, MenuItem, InputAdornment, Radio,
  RadioGroup, FormControl, FormControlLabel, FormLabel, Divider,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SendIcon from '@mui/icons-material/Send'
import { PageHeader } from '../../components/shared'
import { useIAs, useCreateDisbursementCapex } from '../../queries'

// BSE workspace — Reimbursement of CAPEX to IA.
//
// Backend: POST /disbursement-capex. Downstream review fields
// (`gtCapexVerificationComments`, `amountRecommendedForDisbursement`,
// `accountCode`, `recommendation`) are NOT captured here — GT + SDE
// populate them via PUT on their own screens.
//
// Autofill status (Option A degradation — see docs):
//   • IA Name + `sanctionedAmount` come from an IA the BSE picks from
//     a dropdown (login has no IA link yet).
//   • GSTIN of IA, TDS applicability, and "disbursed till date" are
//     BSE-typed for now (columns don't exist on the IA schema).
//   • GSTIN of SIDBI + Account Code are hardcoded.

const SIDBI_GSTIN = '09AABCS3480N5ZS'
const DEFAULT_ACCOUNT_CODE = 'EX1909010'

// Nature-of-payment template — displayed for user convenience only; there's
// no `natureOfPayment` column on the CAPEX request, so we don't send it.
function natureOfPaymentTemplate({ sanctioned, disbursed, currentAmount, items }) {
  const s = fmt(sanctioned)
  const d = fmt(disbursed)
  const c = fmt(currentAmount)
  const it = items?.trim() || '___'
  return `Payment towards CAPEX purchase.

IA has been sanctioned Rs.${s}/- towards the purchase of ${it}. Out of this Rs.${d}/- has already been disbursed. The present disbursement is of Rs.${c}/- towards the purchase of ${it}.`
}

export default function BseCapexReimbursement() {
  const navigate = useNavigate()
  const iasQ = useIAs()
  const create = useCreateDisbursementCapex()

  // BSE picks an IA from an approved-list dropdown until backend threads the
  // IA linkage through login. `grantProposed` on the IA registration is our
  // best proxy for "sanctioned amount"; user can override.
  const iaOptions = useMemo(
    () => (iasQ.data || []).map((ia) => ({
      value: ia.uuid,
      label: ia.name,
      grantProposed: ia.raw?.grantProposed ?? null,
    })),
    [iasQ.data],
  )

  const [v, setV] = useState({
    registrationUuid: '',
    gstinIa: '',
    gstinNotApplicable: false,
    gstinNotApplicableReason: '',
    sanctionedAmount: '',
    disbursedTillDate: '',
    invoiceDate: '',
    invoiceNumber: '',
    detailsOfItems: '',
    valueOfServiceItems: '',
    tdsApplicable: '',
    tdsNotApplicableReason: '',
    preDisbursementCompliance: '',
  })
  const [toast, setToast] = useState(null)

  // Single stable setter — every input reads/writes through this without
  // creating a fresh onChange function per render.
  const set = useCallback((name, value) => {
    setV((prev) => (prev[name] === value ? prev : { ...prev, [name]: value }))
  }, [])

  // When the IA changes, autofill the sanctioned amount from `grantProposed`
  // (only if the field is empty — don't clobber a manual edit).
  const onIaChange = useCallback((uuid) => {
    setV((prev) => {
      const ia = iaOptions.find((o) => o.value === uuid)
      const next = { ...prev, registrationUuid: uuid }
      if (ia?.grantProposed != null && (prev.sanctionedAmount === '' || prev.sanctionedAmount == null)) {
        next.sanctionedAmount = ia.grantProposed
      }
      return next
    })
  }, [iaOptions])

  const value = num(v.valueOfServiceItems)
  const igst = value != null ? +(value * 0.18).toFixed(2) : null
  const total = value != null ? +(value * 1.18).toFixed(2) : null

  const problem = validate(v)

  const submit = async () => {
    if (problem) { setToast({ kind: 'warning', msg: problem }); return }
    try {
      await create.mutateAsync({
        ...v,
        gstinSidbi: SIDBI_GSTIN,
        accountCode: DEFAULT_ACCOUNT_CODE,
        disbursementSought: total,
        igstAmount: igst,
        totalAmount: total,
      })
      setToast({ kind: 'success', msg: 'CAPEX reimbursement note submitted.' })
      setTimeout(() => navigate('/bse/disbursals'), 1200)
    } catch (e) {
      setToast({ kind: 'error', msg: e?.message || 'Failed to submit CAPEX note.' })
    }
  }

  const selectedIa = iaOptions.find((o) => o.value === v.registrationUuid)

  return (
    <Box sx={{ maxWidth: 1080, mx: 'auto', pb: 10 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/bse')} sx={{ mb: 2 }}>Back</Button>

      <PageHeader
        title="Reimbursement of CAPEX to IA"
        subtitle="Raise the CAPEX reimbursement note. Routes to GT Field Manager (verification) → SIDBI SDE (recommendation)."
      />

      <Stack spacing={2.5}>

        <SectionCard n={1} title="Industry Association">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 8 }}>
              <TextField
                select fullWidth size="small" required
                label="Industry Association"
                value={v.registrationUuid}
                onChange={(e) => onIaChange(e.target.value)}
                helperText={iasQ.isLoading ? 'Loading IAs…' : 'Pick the IA this CAPEX note is for.'}
                disabled={iasQ.isLoading}
              >
                {iaOptions.length === 0 && !iasQ.isLoading && (
                  <MenuItem value="" disabled>No IAs available</MenuItem>
                )}
                {iaOptions.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth size="small"
                label="GSTIN of SIDBI"
                value={SIDBI_GSTIN}
                InputProps={{ readOnly: true }}
                helperText="Autofilled"
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth size="small"
                label="GSTIN of IA"
                value={v.gstinIa}
                disabled={v.gstinNotApplicable === true}
                onChange={(e) => set('gstinIa', e.target.value.toUpperCase())}
                placeholder="15-digit GSTIN"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl>
                <FormLabel sx={{ fontSize: '0.78rem', mb: 0.5 }}>GSTIN Applicability</FormLabel>
                <RadioGroup
                  row
                  value={v.gstinNotApplicable === true ? 'na' : v.gstinNotApplicable === false ? 'yes' : ''}
                  onChange={(e) => set('gstinNotApplicable', e.target.value === 'na')}
                >
                  <FormControlLabel value="yes" control={<Radio size="small" />} label="Applicable" />
                  <FormControlLabel value="na"  control={<Radio size="small" />} label="Not Applicable" />
                </RadioGroup>
              </FormControl>
            </Grid>
            {v.gstinNotApplicable === true && (
              <Grid size={12}>
                <TextField
                  fullWidth size="small" required
                  label="Reason GSTIN not applicable"
                  value={v.gstinNotApplicableReason}
                  onChange={(e) => set('gstinNotApplicableReason', e.target.value)}
                />
              </Grid>
            )}
          </Grid>
        </SectionCard>

        <SectionCard n={2} title="Grant & Disbursement Totals">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <MoneyField
                label="Sanctioned Amount"
                value={v.sanctionedAmount}
                onChange={(x) => set('sanctionedAmount', x)}
                helperText={selectedIa?.grantProposed != null
                  ? `IA grant-proposed: ₹${Number(selectedIa.grantProposed).toLocaleString('en-IN')}`
                  : 'Enter the CAPEX sanction amount for this IA.'}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <MoneyField
                label="Disbursed till Date"
                value={v.disbursedTillDate}
                onChange={(x) => set('disbursedTillDate', x)}
                helperText="Total CAPEX already released to this IA."
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <MoneyField
                label="Disbursement Sought"
                value={total ?? ''}
                onChange={() => {}}
                readOnly
                helperText="= Total (Value + IGST)"
              />
            </Grid>
          </Grid>
        </SectionCard>

        <SectionCard n={3} title="Invoice Details">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth size="small" type="date" required
                label="Invoice Date"
                InputLabelProps={{ shrink: true }}
                value={v.invoiceDate}
                onChange={(e) => set('invoiceDate', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth size="small" required
                label="Invoice Number"
                value={v.invoiceNumber}
                onChange={(e) => set('invoiceNumber', e.target.value)}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth size="small" required
                label="Details of Items"
                value={v.detailsOfItems}
                onChange={(e) => set('detailsOfItems', e.target.value)}
                placeholder="e.g. Printer, laptops, projector"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <MoneyField
                label="Value of service / Items"
                value={v.valueOfServiceItems}
                onChange={(x) => set('valueOfServiceItems', x)}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <MoneyField label="IGST @18%" value={igst ?? ''} readOnly helperText="Auto-calculated" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <MoneyField label="Total Amount" value={total ?? ''} readOnly helperText="Auto-calculated" />
            </Grid>
          </Grid>
        </SectionCard>

        <SectionCard n={4} title="Nature of Payment (reference)">
          <TextField
            fullWidth multiline minRows={5} size="small"
            value={natureOfPaymentTemplate({
              sanctioned: v.sanctionedAmount,
              disbursed: v.disbursedTillDate,
              currentAmount: total,
              items: v.detailsOfItems,
            })}
            InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
            helperText="Preview of the standard CAPEX narrative. Not stored on the backend — for reviewer reference only."
          />
        </SectionCard>

        <SectionCard n={5} title="TDS & Compliance">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl required>
                <FormLabel sx={{ fontSize: '0.78rem', mb: 0.5 }}>Applicability of TDS</FormLabel>
                <RadioGroup row value={v.tdsApplicable === true ? 'yes' : v.tdsApplicable === false ? 'no' : ''}
                  onChange={(e) => set('tdsApplicable', e.target.value === 'yes')}>
                  <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
                  <FormControlLabel value="no"  control={<Radio size="small" />} label="No" />
                </RadioGroup>
              </FormControl>
            </Grid>
            {v.tdsApplicable === false && (
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField
                  fullWidth size="small" required
                  label="Reason TDS not applicable"
                  value={v.tdsNotApplicableReason}
                  onChange={(e) => set('tdsNotApplicableReason', e.target.value)}
                />
              </Grid>
            )}
            <Grid size={12}>
              <Divider sx={{ my: 0.5 }} />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth size="small" multiline minRows={3} required
                label="Compliance of Pre-disbursement Terms & Conditions"
                value={v.preDisbursementCompliance}
                onChange={(e) => set('preDisbursementCompliance', e.target.value)}
                helperText="Describe compliance status. SDE may edit during review."
              />
            </Grid>
          </Grid>
        </SectionCard>
      </Stack>

      <Paper
        elevation={3}
        sx={{
          position: 'sticky', bottom: 16, mt: 3, p: 1.5, borderRadius: 3,
          display: 'flex', alignItems: 'center', gap: 1.5,
        }}
      >
        <Typography variant="body2" color={problem ? 'warning.main' : 'text.secondary'} sx={{ flexGrow: 1 }}>
          {problem || 'All required fields are filled. Ready to submit.'}
        </Typography>
        <Button color="inherit" onClick={() => navigate('/bse')}>Cancel</Button>
        <Button
          variant="contained"
          startIcon={create.isPending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
          disabled={!!problem || create.isPending}
          onClick={submit}
        >
          {create.isPending ? 'Submitting…' : 'Submit for Approval'}
        </Button>
      </Paper>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast && (
          <Alert severity={toast.kind} variant="filled" onClose={() => setToast(null)}>
            {toast.msg}
          </Alert>
        )}
      </Snackbar>
    </Box>
  )
}

// ── Building blocks ─────────────────────────────────────────────────────────

const SectionCard = memo(function SectionCard({ n, title, children }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 2 }}>
          <Box sx={{
            width: 28, height: 28, borderRadius: '50%',
            bgcolor: 'primary.light', color: 'primary.dark',
            display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.85rem',
          }}>{n}</Box>
          <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
        </Stack>
        {children}
      </CardContent>
    </Card>
  )
})

const MoneyField = memo(function MoneyField({ label, value, onChange, readOnly, required, helperText }) {
  return (
    <TextField
      fullWidth size="small" type="number"
      label={label}
      value={value ?? ''}
      required={required}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      InputProps={{
        readOnly,
        startAdornment: <InputAdornment position="start">₹</InputAdornment>,
      }}
      helperText={helperText}
    />
  )
})

// ── Helpers ────────────────────────────────────────────────────────────────

function validate(v) {
  if (!v.registrationUuid) return 'Pick the Industry Association.'
  if (v.gstinNotApplicable === true) {
    if (!v.gstinNotApplicableReason?.trim()) return 'Reason for GSTIN not applicable is required.'
  } else if (v.gstinNotApplicable !== false) {
    return 'Select GSTIN applicability.'
  }
  if (num(v.sanctionedAmount) == null) return 'Enter the sanctioned amount.'
  if (num(v.disbursedTillDate) == null) return 'Enter the amount disbursed till date.'
  if (!v.invoiceDate) return 'Enter the invoice date.'
  if (!v.invoiceNumber?.trim()) return 'Enter the invoice number.'
  if (!v.detailsOfItems?.trim()) return 'Enter the details of items.'
  if (num(v.valueOfServiceItems) == null) return 'Enter the value of service / items.'
  if (v.tdsApplicable !== true && v.tdsApplicable !== false) return 'Select TDS applicability.'
  if (v.tdsApplicable === false && !v.tdsNotApplicableReason?.trim()) return 'Reason for TDS not applicable is required.'
  if (!v.preDisbursementCompliance?.trim()) return 'Describe pre-disbursement compliance.'
  const sanctioned = num(v.sanctionedAmount) || 0
  const already = num(v.disbursedTillDate) || 0
  const value = num(v.valueOfServiceItems) || 0
  const total = +(value * 1.18).toFixed(2)
  const balance = sanctioned - already
  if (balance > 0 && total > balance) {
    return `Total (₹${total.toLocaleString('en-IN')}) exceeds remaining sanction balance (₹${balance.toLocaleString('en-IN')}).`
  }
  return null
}

function num(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function fmt(v) {
  const n = num(v)
  return n == null ? '____' : n.toLocaleString('en-IN')
}
