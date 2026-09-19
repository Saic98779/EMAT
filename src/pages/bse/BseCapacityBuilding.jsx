import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Stack, Typography, Button, Snackbar, Alert,
  Paper, CircularProgress, TextField, MenuItem, InputAdornment, Divider,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SendIcon from '@mui/icons-material/Send'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import { PageHeader } from '../../components/shared'
import { useAuth } from '../../auth'
import {
  useCreateDisbursementCapacityBuilding, useDisbursementCapacityBuilding,
  useDisbursementCapacityBuildingByRegistration, useMyBseRecommendation,
  useIAs,
} from '../../queries'
import { SIDBI_GSTIN, DEFAULT_ACCOUNT_CODE } from '../../apis/disbursementCapacityBuilding'

// BSE workspace — Disbursement Note for Capacity Building of IA members.
//
// The note format marks rows 1-5 and 9 as "autofilled based on login
// information": the IA comes from the logged-in BSE's own recommendation
// record, and the GSTIN / sanction / disbursed / TDS figures come from that
// IA's current capacity building record. Where the BSE can't be resolved
// from login (e.g. an SDE previewing the form), we fall back to an IA
// picker so the page still works.
//
// Rows 10-12 and 14 (amount recommended, account code, GT event comments,
// recommendation) are NOT captured here — GT and SDE populate them via PUT
// on their own review screens.

export default function BseCapacityBuilding() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const listQ = useDisbursementCapacityBuilding()
  const create = useCreateDisbursementCapacityBuilding()

  // Row 1 — the IA is derived from who's logged in.
  const myBseQ = useMyBseRecommendation(user)
  const loginIa = useMemo(() => {
    const r = myBseQ.data
    if (!r?.registrationId) return null
    return { id: r.registrationId, name: r.industryAssociationName || r.registrationId }
  }, [myBseQ.data])

  // Fallback picker. Sourced from the IA registration list rather than from
  // existing notes — deriving it from notes can't bootstrap, since the very
  // first note for an IA would have nothing to pick from.
  const approvedIaQ = useIAs({ enabled: !loginIa })
  const iaOptions = useMemo(() => (approvedIaQ.data || [])
    .map((r) => ({ value: r.id, label: r.name || String(r.id) }))
    .filter((o) => o.value != null)
    .sort((a, b) => String(a.label).localeCompare(String(b.label))),
  [approvedIaQ.data])

  const [v, setV] = useState({
    registrationId: '',
    gstinOfIa: '',
    gstinNotApplicableReason: '',
    sanctionedAmount: '',
    disbursedTillDate: '',
    natureOfPayment: '',
    invoiceDate: '',
    invoiceNumber: '',
    valueOfServiceItemsSupplied: '',
    tdsApplicable: '',
    tdsNotApplicableReason: '',
    compliancePreDisbursementTerms: '',
  })
  const [toast, setToast] = useState(null)

  const set = useCallback((name, value) => {
    setV((prev) => (prev[name] === value ? prev : { ...prev, [name]: value }))
  }, [])

  // Adopt the login-resolved IA once it arrives, unless the user already
  // picked one through the fallback dropdown.
  useEffect(() => {
    if (!loginIa) return
    setV((prev) => (prev.registrationId ? prev : { ...prev, registrationId: loginIa.id }))
  }, [loginIa])

  const iaQ = useDisbursementCapacityBuildingByRegistration(v.registrationId)
  const priorNotes = useMemo(() => {
    if (!v.registrationId) return []
    if (iaQ.error) {
      return (listQ.data || []).filter((r) => r?.registrationId === v.registrationId)
    }
    const d = iaQ.data
    if (!d) return []
    return Array.isArray(d) ? d : [d]
  }, [iaQ.data, iaQ.error, listQ.data, v.registrationId])
  const priorSummary = useMemo(() => summarisePriorNotes(priorNotes), [priorNotes])
  const iaLoading = iaQ.isLoading && !iaQ.error

  const prefilledForRef = useRef(null)

  const onIaChange = useCallback((id) => {
    prefilledForRef.current = null
    setV((prev) => ({
      ...prev,
      registrationId: id,
      gstinOfIa: '',
      gstinNotApplicableReason: '',
      sanctionedAmount: '',
      disbursedTillDate: '',
      tdsApplicable: '',
      tdsNotApplicableReason: '',
    }))
  }, [])

  // Prefill once per IA switch, as soon as the by-registration query settles.
  useEffect(() => {
    if (!v.registrationId) return
    if (iaQ.isLoading) return
    if (prefilledForRef.current === v.registrationId) return

    setV((prev) => ({
      ...prev,
      gstinOfIa: priorSummary.gstinOfIa ?? '',
      gstinNotApplicableReason: priorSummary.gstinNotApplicableReason ?? '',
      sanctionedAmount: priorSummary.sanctionedAmount ?? '',
      disbursedTillDate: priorSummary.disbursedTillDate ?? '',
      tdsApplicable: priorSummary.tdsApplicable ?? '',
      tdsNotApplicableReason: priorSummary.tdsNotApplicableReason ?? '',
    }))
    prefilledForRef.current = v.registrationId
  }, [v.registrationId, iaQ.isLoading, priorSummary])

  const value = num(v.valueOfServiceItemsSupplied)
  const igst = value != null ? +(value * 0.18).toFixed(2) : null
  const total = value != null ? +(value * 1.18).toFixed(2) : null
  // No "not applicable" boolean on the backend — a non-empty reason is the flag.
  const gstinNotApplicable = !!String(v.gstinNotApplicableReason || '').trim()

  // Row 7 tracks the running amounts until the BSE edits the wording — after
  // that it's theirs, and only the explicit reset button re-seeds it.
  const natureTouchedRef = useRef(false)
  const suggestedNature = natureOfPaymentTemplate({
    sanctioned: v.sanctionedAmount,
    disbursed: v.disbursedTillDate,
    currentAmount: total,
  })
  useEffect(() => {
    if (natureTouchedRef.current) return
    setV((prev) => (prev.natureOfPayment === suggestedNature
      ? prev
      : { ...prev, natureOfPayment: suggestedNature }))
  }, [suggestedNature])

  const onNatureChange = (text) => {
    natureTouchedRef.current = true
    set('natureOfPayment', text)
  }
  const resetNature = () => {
    natureTouchedRef.current = false
    set('natureOfPayment', suggestedNature)
  }

  const problem = validate(v)

  const submit = async () => {
    if (problem) { setToast({ kind: 'warning', msg: problem }); return }
    try {
      await create.mutateAsync({
        ...v,
        industryAssociationName: loginIa?.name || iaOptions.find((o) => o.value === v.registrationId)?.label || null,
        gstinOfSidbi: SIDBI_GSTIN,
        accountCodeForPayment: DEFAULT_ACCOUNT_CODE,
        disbursementSought: total,
        igstAt18Percent: igst,
        totalAmount: total,
      })
      setToast({ kind: 'success', msg: 'Capacity building disbursement note submitted.' })
      setTimeout(() => navigate('/bse/disbursals'), 1200)
    } catch (e) {
      setToast({ kind: 'error', msg: e?.message || 'Failed to submit the note.' })
    }
  }

  return (
    <Box sx={{ maxWidth: 1080, mx: 'auto', pb: 10 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/bse')} sx={{ mb: 2 }}>Back</Button>

      <PageHeader
        title="Capacity Building of IA Members"
        subtitle="Raise the disbursement note. Routes to GT Field Manager (event comments) → SIDBI SDE (recommendation)."
      />

      <Stack spacing={2.5}>

        <SectionCard n={1} title="Industry Association">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 8 }}>
              {loginIa ? (
                <ReadField
                  label="Industry Association Name"
                  value={loginIa.name}
                  helperText="Autofilled from your login"
                />
              ) : (
                <TextField
                  select fullWidth size="small" required
                  label="Industry Association"
                  value={v.registrationId}
                  onChange={(e) => onIaChange(e.target.value)}
                  helperText={myBseQ.isLoading || approvedIaQ.isLoading
                    ? 'Resolving your Industry Association…'
                    : "Couldn't resolve an IA from your login — pick one."}
                  disabled={myBseQ.isLoading || approvedIaQ.isLoading}
                >
                  {iaOptions.length === 0 && !approvedIaQ.isLoading && (
                    <MenuItem value="" disabled>No IAs available</MenuItem>
                  )}
                  {iaOptions.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </TextField>
              )}
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReadField label="GSTIN of SIDBI" value={SIDBI_GSTIN} helperText="Autofilled" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <ReadField
                label="GSTIN of IA"
                value={v.gstinOfIa}
                helperText="Autofilled from IA record"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReadField
                label="GSTIN Applicability"
                value={gstinNotApplicable ? 'Not Applicable' : v.gstinOfIa ? 'Applicable' : null}
                helperText="Autofilled from IA record"
              />
            </Grid>
            {gstinNotApplicable && (
              <Grid size={12}>
                <ReadField
                  label="Reason GSTIN not applicable"
                  value={v.gstinNotApplicableReason}
                  helperText="Autofilled from IA record"
                />
              </Grid>
            )}
          </Grid>
        </SectionCard>

        <SectionCard n={2} title="Grant & Disbursement Totals">
          {v.registrationId && (
            <PriorNotesBanner loading={iaLoading} error={iaQ.error} summary={priorSummary} />
          )}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReadMoneyField
                label="Sanctioned Amount"
                value={v.sanctionedAmount}
                helperText="Autofilled from IA record"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReadMoneyField
                label="Disbursed till Date"
                value={v.disbursedTillDate}
                helperText="Autofilled from IA record"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReadMoneyField
                label="Disbursement Sought"
                value={total ?? ''}
                helperText="= Total (Value + IGST)"
              />
            </Grid>
          </Grid>
        </SectionCard>

        <SectionCard n={3} title="Nature of Payment">
          <TextField
            fullWidth multiline minRows={6} size="small" required
            label="Nature of Payment"
            value={v.natureOfPayment}
            onChange={(e) => onNatureChange(e.target.value)}
            helperText="Standard wording, with the amounts filled in. Replace the remaining blanks with what the earlier disbursement covered and the event being organised. SDE may revise this during review."
          />
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
            <Button size="small" startIcon={<RestartAltIcon />} onClick={resetNature}>
              Reset to standard wording
            </Button>
          </Stack>
        </SectionCard>

        <SectionCard n={4} title="Invoice Details">
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
            <Grid size={{ xs: 12, md: 6 }}>
              <MoneyField
                label="Value of service / Items supplied"
                value={v.valueOfServiceItemsSupplied}
                onChange={(x) => set('valueOfServiceItemsSupplied', x)}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <MoneyField label="IGST @18%" value={igst ?? ''} readOnly helperText="Auto-calculated" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <MoneyField label="Total Amount" value={total ?? ''} readOnly helperText="Auto-calculated" />
            </Grid>
          </Grid>
        </SectionCard>

        <SectionCard n={5} title="TDS & Compliance">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReadField
                label="Applicability of TDS"
                value={v.tdsApplicable === true ? 'Yes' : v.tdsApplicable === false ? 'No' : null}
                helperText="Autofilled from IA record"
              />
            </Grid>
            {v.tdsApplicable === false && (
              <Grid size={{ xs: 12, md: 8 }}>
                <ReadField
                  label="Reason TDS not applicable"
                  value={v.tdsNotApplicableReason}
                  helperText="Autofilled from IA record"
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
                value={v.compliancePreDisbursementTerms}
                onChange={(e) => set('compliancePreDisbursementTerms', e.target.value)}
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

const PriorNotesBanner = memo(function PriorNotesBanner({ loading, error, summary }) {
  if (loading) {
    return (
      <Alert severity="info" variant="outlined" sx={{ mb: 2 }} icon={<CircularProgress size={16} />}>
        Loading this IA's capacity building record…
      </Alert>
    )
  }
  if (error) {
    return (
      <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
        Couldn't fetch this IA's record from the dedicated endpoint
        (<code>GET /disbursement-capacity-building/registration/&#123;id&#125;</code>).
        Falling back to the shared list — autofilled fields still work.
      </Alert>
    )
  }
  if (summary.count > 0) {
    return (
      <Alert severity="success" variant="outlined" sx={{ mb: 2 }}>
        GSTIN, sanctioned amount, disbursed-till-date and TDS applicability
        autofilled from this IA's current capacity building record.
      </Alert>
    )
  }
  return (
    <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
      No capacity building note yet for this IA — autofilled fields will show
      as blank until the IA record carries them.
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

const ReadField = memo(function ReadField({ label, value, helperText }) {
  const empty = value == null || value === ''
  return (
    <TextField
      fullWidth size="small"
      label={label}
      value={empty ? '' : String(value)}
      placeholder="—"
      InputProps={{ readOnly: true }}
      InputLabelProps={{ shrink: true }}
      helperText={helperText}
      sx={{ '& .MuiInputBase-root': { bgcolor: 'action.hover' } }}
    />
  )
})

const ReadMoneyField = memo(function ReadMoneyField({ label, value, helperText }) {
  const n = num(value)
  return (
    <TextField
      fullWidth size="small"
      label={label}
      value={n != null ? n.toLocaleString('en-IN') : ''}
      placeholder="—"
      InputProps={{
        readOnly: true,
        startAdornment: <InputAdornment position="start">₹</InputAdornment>,
      }}
      InputLabelProps={{ shrink: true }}
      helperText={helperText}
      sx={{ '& .MuiInputBase-root': { bgcolor: 'action.hover' } }}
    />
  )
})

// ── Helpers ────────────────────────────────────────────────────────────────

// Row 7 of the note format. Blanks the BSE has to fill by hand stay as
// underscores; the three money figures are substituted from the record.
function natureOfPaymentTemplate({ sanctioned, disbursed, currentAmount }) {
  return `Payment towards Capacity building of IA members.

IA has been sanctioned Rs.${fmt(sanctioned)}/- towards the capacity building of its members. Out of this Rs.${fmt(disbursed)}/- has already been disbursed towards ____________. The present disbursement is of Rs.${fmt(currentAmount)}/- towards the organisation of ____________. The event impact assessment report has been submitted and is placed below.`
}

function validate(v) {
  if (!v.registrationId) return 'Pick the Industry Association.'
  if (!v.natureOfPayment?.trim()) return 'Enter the nature of payment.'
  if (!v.invoiceDate) return 'Enter the invoice date.'
  if (!v.invoiceNumber?.trim()) return 'Enter the invoice number.'
  if (num(v.valueOfServiceItemsSupplied) == null) return 'Enter the value of service / items supplied.'
  if (!v.compliancePreDisbursementTerms?.trim()) return 'Describe pre-disbursement compliance.'
  const sanctioned = num(v.sanctionedAmount)
  const already = num(v.disbursedTillDate)
  if (sanctioned != null && already != null) {
    const value = num(v.valueOfServiceItemsSupplied) || 0
    const total = +(value * 1.18).toFixed(2)
    const balance = sanctioned - already
    if (balance > 0 && total > balance) {
      return `Total (₹${total.toLocaleString('en-IN')}) exceeds remaining sanction balance (₹${balance.toLocaleString('en-IN')}).`
    }
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

// Surface whatever the backend reports on the newest note for this IA. No
// aggregation — once backend maintains these as authoritative IA-level
// fields, this goes away and we read straight off the IA record.
function summarisePriorNotes(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      count: 0,
      gstinOfIa: null, gstinNotApplicableReason: null,
      sanctionedAmount: null, disbursedTillDate: null,
      tdsApplicable: null, tdsNotApplicableReason: null,
    }
  }
  const sorted = [...rows].sort((a, b) => {
    const da = a?.invoiceDate || ''
    const db = b?.invoiceDate || ''
    return db.localeCompare(da)
  })
  const latest = sorted[0] || {}
  return {
    count: rows.length,
    gstinOfIa: latest.gstinOfIa || null,
    gstinNotApplicableReason: latest.gstinNotApplicableReason || null,
    sanctionedAmount: num(latest.sanctionedAmount),
    disbursedTillDate: num(latest.disbursedTillDate),
    tdsApplicable: typeof latest.tdsApplicable === 'boolean' ? latest.tdsApplicable : null,
    tdsNotApplicableReason: latest.tdsNotApplicableReason || null,
  }
}
