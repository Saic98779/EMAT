import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Stack, Typography, Button, Snackbar, Alert,
  Paper, CircularProgress, TextField, MenuItem, InputAdornment, Radio,
  RadioGroup, FormControl, FormControlLabel, FormLabel, Divider,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SendIcon from '@mui/icons-material/Send'
import { PageHeader } from '../../components/shared'
import { useCreateDisbursementCapex, useDisbursementCapex } from '../../queries'

// BSE workspace — Reimbursement of CAPEX to IA.
//
// Backend:
//   GET  /disbursement-capex → all prior CAPEX notes across every IA.
//                              Used both to build the IA dropdown (unique
//                              registrationUuid + industryAssociationName)
//                              and to prefill fields when an IA is picked.
//   POST /disbursement-capex → creates the new note.
//
// Downstream review fields (`gtCapexVerificationComments`,
// `amountRecommendedForDisbursement`, `accountCode`, `recommendation`) are
// NOT captured here — GT + SDE populate them via PUT on their own screens.
//
// Autofill (all from the single GET /disbursement-capex response):
//   • IA Name → picked from dropdown built out of the list's unique
//     (registrationUuid, industryAssociationName) pairs.
//   • Once picked, we prefill from that IA's rows:
//       - `gstinIa`, `gstinNotApplicable`, `gstinNotApplicableReason`
//         from the most recent prior note
//       - `sanctionedAmount` from the most recent prior note
//       - `disbursedTillDate` = Σ `amountRecommendedForDisbursement` across
//         approved (`recommendation === true`) prior notes
//       - `tdsApplicable` + `tdsNotApplicableReason` from most recent note
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
  const capexQ = useDisbursementCapex()
  const create = useCreateDisbursementCapex()

  // Every IA the BSE can raise a note against comes from the CAPEX list
  // itself — dedupe by `registrationUuid` and keep the display name from the
  // most recent row so we don't need a second `/industry-association-*` GET.
  const iaOptions = useMemo(() => {
    const rows = capexQ.data || []
    const byId = new Map()
    for (const r of rows) {
      const uuid = r?.registrationUuid
      if (!uuid) continue
      byId.set(uuid, {
        value: uuid,
        label: r.industryAssociationName || uuid,
      })
    }
    return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [capexQ.data])

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

  // Prior CAPEX notes for the picked IA — filtered from the shared list
  // (no second network round-trip; `/disbursement-capex` already has
  // everything). `priorSummary` collapses the rows into the fields we want
  // to prefill.
  const priorNotes = useMemo(() => {
    if (!v.registrationUuid) return []
    return (capexQ.data || []).filter((r) => r?.registrationUuid === v.registrationUuid)
  }, [capexQ.data, v.registrationUuid])
  const priorSummary = useMemo(() => summarisePriorNotes(priorNotes), [priorNotes])

  // Single stable setter — every input reads/writes through this without
  // creating a fresh onChange function per render.
  const set = useCallback((name, value) => {
    setV((prev) => (prev[name] === value ? prev : { ...prev, [name]: value }))
  }, [])

  // Track which registration we've already prefilled from so we don't
  // clobber the user's edits on every render of the shared query.
  const prefilledForRef = useRef(null)

  // On IA change: reset the derived-from-IA fields to blank so the prefill
  // effect below can repopulate them cleanly. Editable typing (invoice
  // date/number, items) is preserved.
  const onIaChange = useCallback((uuid) => {
    prefilledForRef.current = null
    setV((prev) => ({
      ...prev,
      registrationUuid: uuid,
      gstinIa: '',
      gstinNotApplicable: false,
      gstinNotApplicableReason: '',
      sanctionedAmount: '',
      disbursedTillDate: '',
      tdsApplicable: '',
      tdsNotApplicableReason: '',
    }))
  }, [])

  // Prefill once per IA switch, as soon as the shared list is available.
  useEffect(() => {
    if (!v.registrationUuid) return
    if (capexQ.isLoading) return
    if (prefilledForRef.current === v.registrationUuid) return

    setV((prev) => ({
      ...prev,
      gstinIa: priorSummary.gstinIa ?? '',
      gstinNotApplicable: priorSummary.gstinNotApplicable ?? false,
      gstinNotApplicableReason: priorSummary.gstinNotApplicableReason ?? '',
      sanctionedAmount: priorSummary.sanctionedAmount ?? '',
      disbursedTillDate: priorSummary.disbursedTillDate ?? '',
      tdsApplicable: priorSummary.tdsApplicable ?? '',
      tdsNotApplicableReason: priorSummary.tdsNotApplicableReason ?? '',
    }))
    prefilledForRef.current = v.registrationUuid
  }, [v.registrationUuid, capexQ.isLoading, priorSummary])

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
                helperText={capexQ.isLoading
                  ? 'Loading IAs from prior CAPEX records…'
                  : 'Pick the IA this CAPEX note is for.'}
                disabled={capexQ.isLoading}
              >
                {iaOptions.length === 0 && !capexQ.isLoading && (
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
          {v.registrationUuid && (
            <PriorNotesBanner
              loading={capexQ.isLoading}
              summary={priorSummary}
            />
          )}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <MoneyField
                label="Sanctioned Amount"
                value={v.sanctionedAmount}
                onChange={(x) => set('sanctionedAmount', x)}
                helperText={
                  priorSummary.sanctionedAmount != null
                    ? 'Autofilled from the most recent CAPEX note for this IA.'
                    : 'Enter the CAPEX sanction amount for this IA.'
                }
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <MoneyField
                label="Disbursed till Date"
                value={v.disbursedTillDate}
                onChange={(x) => set('disbursedTillDate', x)}
                helperText={
                  priorSummary.disbursedTillDate != null
                    ? `Σ of ${priorSummary.approvedCount} approved CAPEX note${priorSummary.approvedCount === 1 ? '' : 's'} for this IA. Overridable.`
                    : 'Total CAPEX already released to this IA.'
                }
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

// Small info strip above Grant & Disbursement Totals that explains where
// the numbers came from. Three states: loading, prior notes found, none.
const PriorNotesBanner = memo(function PriorNotesBanner({ loading, summary }) {
  if (loading) {
    return (
      <Alert severity="info" variant="outlined" sx={{ mb: 2 }}
        icon={<CircularProgress size={16} />}>
        Loading prior CAPEX notes for this IA…
      </Alert>
    )
  }
  if (summary.count > 0) {
    return (
      <Alert severity="success" variant="outlined" sx={{ mb: 2 }}>
        Prefilled from <strong>{summary.count}</strong> prior CAPEX note{summary.count === 1 ? '' : 's'} for this IA
        {summary.approvedCount > 0 && <> — <strong>{summary.approvedCount}</strong> already approved.</>}
        {' '}Sanctioned Amount, Disbursed till Date, GSTIN, and TDS applicability are pre-populated and overridable.
      </Alert>
    )
  }
  return (
    <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
      No prior CAPEX notes for this IA yet — fill Sanctioned Amount, GSTIN,
      and TDS applicability manually. Once this note is saved, the next one
      will prefill from it.
    </Alert>
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

// Given the list of prior CAPEX notes for an IA, return the values that
// should prefill the form. The "most recent" row is picked by invoice date
// (falls back to array order when dates are missing / equal).
function summarisePriorNotes(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      count: 0, approvedCount: 0,
      gstinIa: null, gstinNotApplicable: null, gstinNotApplicableReason: null,
      sanctionedAmount: null, disbursedTillDate: null,
      tdsApplicable: null, tdsNotApplicableReason: null,
    }
  }
  // Newest note wins for the point-in-time fields.
  const sorted = [...rows].sort((a, b) => {
    const da = a?.invoiceDate || ''
    const db = b?.invoiceDate || ''
    return db.localeCompare(da)
  })
  const latest = sorted[0] || {}
  // "Disbursed till date" = sum of recommended amounts on approved rows.
  const approved = rows.filter((r) => r?.recommendation === true)
  const disbursedTillDate = approved.reduce(
    (sum, r) => sum + (num(r?.amountRecommendedForDisbursement) || 0), 0,
  )
  return {
    count: rows.length,
    approvedCount: approved.length,
    gstinIa: latest.gstinIa || null,
    gstinNotApplicable: typeof latest.gstinNotApplicable === 'boolean' ? latest.gstinNotApplicable : null,
    gstinNotApplicableReason: latest.gstinNotApplicableReason || null,
    sanctionedAmount: num(latest.sanctionedAmount),
    disbursedTillDate: disbursedTillDate > 0 ? disbursedTillDate : null,
    tdsApplicable: typeof latest.tdsApplicable === 'boolean' ? latest.tdsApplicable : null,
    tdsNotApplicableReason: latest.tdsNotApplicableReason || null,
  }
}
