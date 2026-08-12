import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Stack, Typography, Button, Snackbar, Alert, Chip,
  Paper, CircularProgress, TextField, MenuItem, InputAdornment, Table, TableHead,
  TableBody, TableRow, TableCell, Checkbox, FormControlLabel, Switch,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SendIcon from '@mui/icons-material/Send'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import { PageHeader, Mono } from '../../components/shared'
import { useAuth } from '../../auth'
import { useMyVendor, useBseByUserSelected, useBseAttendanceForRecommendations } from '../../queries'
import { createVendorDisbursement, netSalOf } from '../../apis/vendorDisbursements'
import { workingDaysInMonth } from '../../apis/bseAttendance'

// Raise Salary Disbursement Note — Manpower Agency / Vendor screen.
//
// Backend model: one note = one BSE. `details[]` is per-month for that same
// BSE (arrears / catch-up runs). The form here captures one month at a time
// and produces a single-row `details` array; extend to a repeater if we
// ever need multi-month claims from the UI.
//
// Data sources:
//   • Vendor autofill  ← useMyVendor(user.userId)
//   • Resource list    ← useBseByUserSelected(user.userId) — the
//                        committee-selected BSEs mapped to this vendor.
//   • Post             ← POST /bse-salary
//
// Screen structure follows the Excel spec:
//   ① Vendor Details       (autofilled, read-only)
//   ② Resource Selection   (month + single-select BSE list)
//   ③ Annexure I           (per-BSE table, editable PF/TDS/Deductions)
//   ④ Invoice Details      (MPA fills; IGST + Total auto)
//   ⑤ TDS & Compliance     (autofilled from vendor + compliance toggle)
//
// Downstream review fields (Amount Recommended, Recommendation, verifiedBy,
// approvedBy) are HO-owned — not shown on this screen.

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]

const SIDBI_GSTIN = '09AABCS3480N5ZS'
const DEFAULT_ACCOUNT_CODE = 'EX1909010'

// Stable empty-list reference. Used as the fallback when the resources query
// hasn't resolved yet — a fresh `[]` literal every render breaks referential
// equality and would flip the resource-sync effect on every parent render.
const EMPTY_RESOURCES = Object.freeze([])

export default function MpaRaiseDisbursement() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Vendor record is still needed for the header autofill (agency name,
  // GSTIN, bank details). BSE list is now keyed off `user.userId` directly —
  // no dependency on the vendor lookup succeeding.
  const vendorQ = useMyVendor(user?.userId)
  const vendor = vendorQ.data

  const bsesQ = useBseByUserSelected(user?.userId)
  // `useMemo` gives the fallback a stable reference — otherwise every parent
  // render would recreate `[]` and re-trigger the resource-sync effect below.
  const resources = useMemo(() => bsesQ.data || EMPTY_RESOURCES, [bsesQ.data])

  // Header-level state.
  const monthNow = MONTHS[new Date().getMonth()]
  const [month, setMonth] = useState(monthNow)
  const [year, setYear] = useState(CURRENT_YEAR)

  // Multi-BSE selection — backend now accepts one note carrying multiple
  // BSEs (each detail row has its own bseId). Selection state is a Set of
  // uuids so toggling is cheap and the order stays stable. Auto-prunes any
  // uuids that disappear from the resource list (e.g. demapped mid-session).
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  useEffect(() => {
    setSelectedIds((prev) => {
      const alive = new Set([...prev].filter((id) => resources.some((r) => r.uuid === id)))
      return alive.size === prev.size ? prev : alive
    })
  }, [resources])

  // Annexure row overrides — user edits to PF/TDS/Deductions/etc. Keyed by
  // BSE uuid so switching selection preserves any per-BSE edits.
  const [rowOverrides, setRowOverrides] = useState({})
  const setRowField = useCallback((bseUuid, field, value) => {
    setRowOverrides((prev) => ({
      ...prev,
      [bseUuid]: { ...(prev[bseUuid] || {}), [field]: value },
    }))
  }, [])

  const toggleResource = useCallback((bseUuid) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(bseUuid)) next.delete(bseUuid)
      else next.add(bseUuid)
      return next
    })
  }, [])
  const toggleAllResources = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === resources.length) return new Set()
      return new Set(resources.map((r) => r.uuid))
    })
  }, [resources])

  // TDS applicability is chosen by the MPA per disbursement (below in the
  // Vendor Details block). Declared early so the memo below can zero out the
  // per-row TDS value when the column is hidden — otherwise a lingering
  // override would leak into Net Sal / Disbursement Sought / the payload.
  const [tdsApplicable, setTdsApplicable] = useState(!!vendor?.tdsApplicable)

  // Attendance for each selected BSE. Working Days on Annexure I is derived
  // from this — the vendor marks each day of presence in the "Attendance of
  // My Resources" workspace, and that count flows into the row here.
  const selectedIdList = useMemo(() => [...selectedIds], [selectedIds])
  const attendance = useBseAttendanceForRecommendations(selectedIdList)
  const monthNum = MONTHS.indexOf(month) + 1  // "January" → 1
  const attendanceDaysById = useMemo(() => {
    const out = {}
    for (const id of selectedIdList) {
      out[id] = workingDaysInMonth(attendance.byId[id] || [], monthNum, year)
    }
    return out
  }, [selectedIdList, attendance.byId, monthNum, year])
  // Total marked-attendance days across the selected BSEs — used for the
  // Annexure table's summary alert.
  const totalAttendanceDays = useMemo(
    () => selectedIdList.reduce((n, id) => n + (attendanceDaysById[id] || 0), 0),
    [selectedIdList, attendanceDaysById],
  )

  // One Annexure row per selected BSE. Rows follow the resource-list order
  // so the on-screen order matches the selection above. TDS override is
  // zeroed when the column is hidden (see comment on `tdsApplicable`).
  const annexureRows = useMemo(() => {
    const rows = []
    for (const r of resources) {
      if (!selectedIds.has(r.uuid)) continue
      const built = buildRow(r, rowOverrides[r.uuid], attendanceDaysById[r.uuid] || 0)
      rows.push(tdsApplicable ? built : { ...built, tds: 0 })
    }
    return rows
  }, [resources, selectedIds, rowOverrides, tdsApplicable, attendanceDaysById])

  const disbursementSought = useMemo(
    () => annexureRows.reduce((sum, r) => sum + netSalOf(r), 0),
    [annexureRows],
  )

  // Invoice section state.
  const [invoiceDate, setInvoiceDate] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceValue, setInvoiceValue] = useState('')
  const gstAmount = invoiceValue === '' ? '' : +(Number(invoiceValue) * 0.18).toFixed(2)
  const invoiceTotal = invoiceValue === '' ? '' : +(Number(invoiceValue) * 1.18).toFixed(2)

  // Compliance is MPA-fillable; TDS applicability + reason come from the vendor
  // record (autofilled + read-only).
  const [compliance, setCompliance] = useState(false)

  // GSTIN not-applicable reason — shown only when the vendor record has no
  // GSTIN. MPA-editable so users without a GSTIN can still submit.
  const [reasonForNoGstin, setReasonForNoGstin] = useState('')

  // `tdsApplicable` is declared above with the annexure-row memo so its value
  // can feed the row transform. The reason input is gated on the same flag.
  const [tdsNotApplicableReason, setTdsNotApplicableReason] = useState('')

  const salaryMonth = `${month}-${year}`
  const natureOfPayment = `Payment towards Salary for the month ${salaryMonth} of ${annexureRows.length} BSE${annexureRows.length === 1 ? '' : 's'}. BSE-wise Details in Annexure I.`

  const [toast, setToast] = useState({ severity: '', msg: '' })
  const [busy, setBusy] = useState(false)
  const [showAllErrors, setShowAllErrors] = useState(false)

  // Field-level errors — computed each render so inline messages stay live
  // even before the user clicks Submit. Individual TextFields consume their
  // own key; the sticky footer summarises the first blocker for the user.
  const errors = useMemo(() => computeErrors({
    vendor, annexureRows, invoiceDate, invoiceNumber, invoiceValue, compliance,
    tdsApplicable, tdsNotApplicableReason, reasonForNoGstin,
  }), [
    vendor, annexureRows, invoiceDate, invoiceNumber, invoiceValue, compliance,
    tdsApplicable, tdsNotApplicableReason, reasonForNoGstin,
  ])
  const firstError = errors._first
  const isValid = !firstError

  const submit = useCallback(async () => {
    if (busy) return
    if (firstError) {
      setShowAllErrors(true)
      setToast({ severity: 'warning', msg: firstError })
      return
    }
    setBusy(true)
    try {
      // Backend schema (Aug '26): one bse-salary note can span multiple
      // BSEs; `bseId` sits inside each `details[]` row. Nothing to lift to
      // the top level anymore — the adapter maps rows straight through.
      await createVendorDisbursement({
        gstinOfAgency: vendor.gstNo,
        reasonForNoGstin: !vendor.gstNo ? (reasonForNoGstin || null) : null,
        gstinOfSdbi: SIDBI_GSTIN,
        // TODO: sanctionedAmount / disbursedTillDate live on a per-vendor
        // ledger the backend hasn't shipped yet — leave blank until it does.
        sanctionedAmount: null,
        disbursedTillDate: null,
        natureOfPayment,
        invoiceDate, invoiceNumber, invoiceValue,
        tdsApplicable,
        tdsNotApplicableReason: tdsApplicable ? null : (tdsNotApplicableReason || null),
        accountCode: DEFAULT_ACCOUNT_CODE,
        complianceTerms: compliance ? 'Yes' : 'No',
        salaryMonth,
        rows: annexureRows,
      })
      setToast({ severity: 'success', msg: 'Disbursement request submitted to HO Maker.' })
      setTimeout(() => navigate('/mpa'), 1200)
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Failed to submit. Please try again.' })
    } finally {
      setBusy(false)
    }
  }, [busy, vendor, annexureRows, invoiceDate, invoiceNumber, invoiceValue, compliance,
      reasonForNoGstin, tdsApplicable, tdsNotApplicableReason,
      natureOfPayment, salaryMonth, navigate])

  if (vendorQ.isLoading || (bsesQ.isLoading && resources.length === 0)) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
  }

  if (!vendor) {
    return (
      <Box>
        <PageHeader title="Raise Salary Disbursement" subtitle="Vendor / Consultancy new disbursement note." />
        <Alert severity="warning">
          Your login isn&apos;t linked to a vendor record on the SDE side yet. Ask SDE to add
          a vendor and link it to your user account before raising a disbursement.
        </Alert>
      </Box>
    )
  }

  const selectedCount = annexureRows.length

  return (
    <Box sx={{ maxWidth: 1080, mx: 'auto', pb: 12 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/mpa')} sx={{ mb: 2 }} disabled={busy}>
        Back
      </Button>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <Card sx={{ mb: 3, overflow: 'hidden' }}>
        <Box sx={{
          background: (t) => `linear-gradient(135deg, ${t.palette.primary.main} 0%, ${t.palette.primary.dark} 100%)`,
          color: 'primary.contrastText',
          px: { xs: 2.5, md: 3.5 }, py: { xs: 2, md: 2.5 },
        }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="overline" sx={{ opacity: 0.75, letterSpacing: '0.14em' }}>
                Vendor / Consultancy
              </Typography>
              <Typography variant="h5" fontWeight={700}>Raise Salary Disbursement</Typography>
              <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.25, maxWidth: 640 }}>
                Pick a BSE, fill Annexure I, attach invoice details, and submit
                to the SIDBI HO Maker for review.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Chip
                icon={<GroupsOutlinedIcon />}
                label={`${selectedCount} BSE${selectedCount === 1 ? '' : 's'} selected`}
                sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: 'inherit', fontWeight: 700 }}
              />
              <Chip
                label={`Total ₹${disbursementSought.toLocaleString('en-IN')}`}
                sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: 'inherit', fontWeight: 700 }}
              />
            </Stack>
          </Stack>
        </Box>
      </Card>

      {/* ── Sections ──────────────────────────────────────────────────────── */}
      <Stack spacing={2.5}>
        <VendorDetails
          step={1}
          vendor={vendor}
          reasonForNoGstin={reasonForNoGstin}
          onReasonForNoGstin={setReasonForNoGstin}
          tdsApplicable={tdsApplicable}
          onTdsApplicable={setTdsApplicable}
          tdsNotApplicableReason={tdsNotApplicableReason}
          onTdsNotApplicableReason={setTdsNotApplicableReason}
          errorGstinReason={showAllErrors ? errors.reasonForNoGstin : ''}
          errorTdsReason={showAllErrors ? errors.tdsNotApplicableReason : ''}
        />

        <ResourceSelection
          step={2}
          month={month} setMonth={setMonth}
          year={year} setYear={setYear}
          resources={resources}
          selectedIds={selectedIds}
          onToggle={toggleResource}
          onToggleAll={toggleAllResources}
          error={showAllErrors ? errors.resources : ''}
        />

        <AnnexureTable
          step={3}
          rows={annexureRows}
          onSet={setRowField}
          total={disbursementSought}
          showTds={tdsApplicable}
          attendanceDays={totalAttendanceDays}
          attendanceLoading={attendance.isLoading && selectedIds.size > 0}
          month={month}
          year={year}
          error={showAllErrors ? errors.rows : ''}
        />

        <DisbursementSummary
          step={4}
          total={disbursementSought}
          natureOfPayment={natureOfPayment}
        />

        <InvoiceDetails
          step={5}
          date={invoiceDate} onDate={setInvoiceDate}
          number={invoiceNumber} onNumber={setInvoiceNumber}
          value={invoiceValue} onValue={setInvoiceValue}
          gstAmount={gstAmount} total={invoiceTotal}
          errorDate={showAllErrors ? errors.invoiceDate : ''}
          errorNumber={showAllErrors ? errors.invoiceNumber : ''}
          errorValue={showAllErrors ? errors.invoiceValue : ''}
        />

        <ComplianceSection
          step={6}
          compliance={compliance}
          onCompliance={setCompliance}
          error={showAllErrors ? errors.compliance : ''}
        />
      </Stack>

      {/* ── Sticky footer with validation summary + actions ───────────────── */}
      <Paper elevation={3} sx={{
        position: 'sticky', bottom: 16, mt: 3, p: 1.25, borderRadius: 3,
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5,
      }}>
        <StatusChipsFooter
          isValid={isValid}
          firstError={firstError}
          selectedCount={selectedCount}
          total={disbursementSought}
        />
        <Box sx={{ flexGrow: 1 }} />
        <Button color="inherit" onClick={() => navigate('/mpa')} disabled={busy}>Cancel</Button>
        <Button
          variant="contained"
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
          onClick={submit}
          disabled={busy}
        >
          {busy ? 'Submitting…' : 'Submit to HO Maker'}
        </Button>
      </Paper>

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

// ── Section 1: Vendor Details ──────────────────────────────────────────────
// Visually split into two groups so the read-only autofill (bordered fields
// with a subtle grey background) is unambiguously distinct from the inputs
// the MPA has to fill (TDS applicability + N/A reasons + GSTIN reason).
// Every field is a `TextField` — same shape, same size — so the grid stays
// tidy regardless of which column is editable.

const VendorDetails = memo(function VendorDetails({
  step,
  vendor,
  reasonForNoGstin, onReasonForNoGstin,
  tdsApplicable, onTdsApplicable,
  tdsNotApplicableReason, onTdsNotApplicableReason,
  errorGstinReason = '', errorTdsReason = '',
}) {
  const noGstin = !vendor.gstNo
  const onChangeGstinReason = useCallback((e) => onReasonForNoGstin(e.target.value), [onReasonForNoGstin])
  const onChangeTdsReason = useCallback((e) => onTdsNotApplicableReason(e.target.value), [onTdsNotApplicableReason])
  const onChangeTdsApplicable = useCallback((e) => onTdsApplicable(e.target.value === 'yes'), [onTdsApplicable])

  const sanctionedAmount = vendor?.sanctionedAmount
  const disbursedTillDate = vendor?.disbursedTillDate

  const hasError = !!errorGstinReason || !!errorTdsReason

  return (
    <Card>
      <CardContent>
        <SectionTitle
          step={step} hasError={hasError}
          title="Vendor Details"
          subtitle="Autofilled from your vendor record. Managed by SDE."
        />

        {/* Only the spec fields — everything else on the vendor record
              (SPOC, bank, address) is out of scope for the disbursement note. */}
        <GroupLabel>Autofilled</GroupLabel>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <ReadOnlyInput label="Manpower Agency Name" value={vendor.vendorName} />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <ReadOnlyInput label="GSTIN of the Agency" value={vendor.gstNo || 'Not applicable'} mono />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <ReadOnlyInput label="GSTIN of SIDBI" value={SIDBI_GSTIN} mono />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <ReadOnlyInput
              label="Sanctioned Amount (₹)"
              value={sanctionedAmount != null ? formatMoney(sanctionedAmount) : ''}
              placeholder="—" prefix="₹"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <ReadOnlyInput
              label="Disbursed till date (₹)"
              value={disbursedTillDate != null ? formatMoney(disbursedTillDate) : ''}
              placeholder="—" prefix="₹"
            />
          </Grid>
        </Grid>

        {/* Group 2 — For this disbursement (MPA fills) */}
        <GroupLabel required>For this disbursement</GroupLabel>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: tdsApplicable ? 12 : 4 }}>
            <TextField
              select fullWidth size="small"
              label="Applicability of TDS *"
              value={tdsApplicable ? 'yes' : 'no'}
              onChange={onChangeTdsApplicable}
              helperText="TDS column in the Annexure I table shows only when applicable."
            >
              <MenuItem value="yes">Yes — TDS applicable</MenuItem>
              <MenuItem value="no">No — not applicable</MenuItem>
            </TextField>
          </Grid>
          {!tdsApplicable && (
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                fullWidth size="small"
                label="If TDS not applicable — reason *"
                value={tdsNotApplicableReason}
                onChange={onChangeTdsReason}
                error={!!errorTdsReason}
                helperText={errorTdsReason || 'e.g. Below the deduction threshold as per FY declaration.'}
              />
            </Grid>
          )}
          {noGstin && (
            <Grid size={12}>
              <TextField
                fullWidth size="small"
                label="If GSTIN not applicable — reason *"
                value={reasonForNoGstin}
                onChange={onChangeGstinReason}
                error={!!errorGstinReason}
                helperText={errorGstinReason || 'Your vendor record has no GSTIN. Explain the reason (e.g. below the GST threshold).'}
              />
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  )
})

// ── Between the table and Invoice: reads directly from the table's totals.
// "Disbursement Sought" and "Nature of Payment" both derive from the Annexure
// I total per the spec — displayed here as read-only fields immediately after
// the table so the connection is visible.
const DisbursementSummary = memo(function DisbursementSummary({ step, total, natureOfPayment }) {
  return (
    <Card>
      <CardContent>
        <SectionTitle
          step={step}
          title="Disbursement Summary"
          subtitle="Auto-derived from the Annexure I table above."
        />
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              fullWidth size="small"
              label="Disbursement Sought (₹)"
              value={total > 0 ? total.toLocaleString('en-IN') : ''}
              InputProps={{ readOnly: true, startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              sx={{ '& .MuiInputBase-root': { bgcolor: 'action.hover', fontWeight: 700, color: 'primary.dark' } }}
              helperText="Total of the Annexure I table"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 8 }}>
            <TextField
              fullWidth size="small" multiline minRows={2}
              label="Nature of Payment"
              value={natureOfPayment}
              InputProps={{ readOnly: true }}
              sx={{ '& .MuiInputBase-root': { bgcolor: 'action.hover' } }}
              helperText="Auto-composed from selected month + resource count"
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
})

// ── Section 2: Resource Selection ──────────────────────────────────────────
// No outer Card wrapper — this section is a lightweight bar (month/year
// selectors + count) plus a compact table of the vendor's BSEs. Much
// smoother visually between the two heavier bordered sections above and
// below (Vendor Details, Annexure I).

const ResourceSelection = memo(function ResourceSelection({
  step, month, setMonth, year, setYear, resources, selectedIds, onToggle, onToggleAll,
  error = '',
}) {
  const selectedCount = selectedIds.size
  const allSelected = resources.length > 0 && selectedCount === resources.length
  const someSelected = selectedCount > 0 && !allSelected

  return (
    <Box>
      <SectionTitle
        step={step} hasError={!!error}
        title="Resource Selection"
        subtitle="Pick the cycle month and every BSE this disbursement covers. One note can carry multiple BSEs — the Annexure below will get a row per selected resource."
      />
      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>
      )}

      {/* Toolbar — month + year picker + selection indicator */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}
        alignItems={{ sm: 'center' }} sx={{ mb: 1.5 }}>
        <TextField select size="small" label="Month" value={month}
          onChange={(e) => setMonth(e.target.value)} sx={{ minWidth: 160 }}>
          {MONTHS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Year" value={year}
          onChange={(e) => setYear(Number(e.target.value))} sx={{ minWidth: 120 }}>
          {YEARS.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
        </TextField>
        <Box sx={{ flexGrow: 1 }} />
        {resources.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            {selectedCount > 0
              ? <><Box component="span" sx={{ fontWeight: 700, color: 'primary.dark' }}>{selectedCount}</Box>{' of '}{resources.length}{' selected'}</>
              : <>Pick one or more BSEs below</>}
          </Typography>
        )}
      </Stack>

      {resources.length === 0 ? (
        <Box sx={{
          textAlign: 'center', py: 4, px: 2,
          border: '1px dashed', borderColor: 'divider', borderRadius: 2,
          bgcolor: 'action.hover',
        }}>
          <GroupsOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
          <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
            No resources assigned yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 420, mx: 'auto' }}>
            Once SIDBI HO onboards BSEs under your login, they&apos;ll appear here for
            you to include in a disbursement.
          </Typography>
        </Box>
      ) : (
        <Box sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1.5,
          overflow: 'hidden',
        }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell padding="checkbox" sx={{ width: 44 }}>
                  <Checkbox
                    size="small"
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={onToggleAll}
                    inputProps={{ 'aria-label': 'Select all resources' }}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1 }}>Resource</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1 }}>Industry Association</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1 }}>Mobile</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, py: 1 }}>Gross Sal (₹)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resources.map((r) => (
                <ResourceRow key={r.uuid} resource={r}
                  checked={selectedIds.has(r.uuid)} onToggle={onToggle} />
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  )
})

// Single BSE row. Multi-select via checkbox — click anywhere on the row to
// toggle. Selected row gets a subtle tinted background.
const ResourceRow = memo(function ResourceRow({ resource, checked, onToggle }) {
  const handleClick = useCallback(() => onToggle(resource.uuid), [onToggle, resource.uuid])
  return (
    <TableRow
      hover
      onClick={handleClick}
      sx={{
        cursor: 'pointer',
        bgcolor: checked ? 'primary.50' : 'inherit',
        '& td': { borderColor: 'divider' },
      }}
    >
      <TableCell padding="checkbox">
        <Checkbox
          size="small"
          checked={checked}
          onClick={(e) => e.stopPropagation()}
          onChange={handleClick}
        />
      </TableCell>
      <TableCell sx={{ fontWeight: 600 }}>{resource.bseName || '—'}</TableCell>
      <TableCell>{resource.industryAssociationName || '—'}</TableCell>
      <TableCell><Mono>{resource.mobileNumber || '—'}</Mono></TableCell>
      <TableCell align="right">
        <Mono>{formatMoney(grossSalaryOf(resource))}</Mono>
      </TableCell>
    </TableRow>
  )
})

// ── Section 3: Annexure I table ────────────────────────────────────────────

const AnnexureTable = memo(function AnnexureTable({
  step, rows, onSet, total, showTds,
  attendanceDays = 0, attendanceLoading = false, month, year,
  error = '',
}) {
  const colSpan = showTds ? 10 : 9  // total row spans everything before Net Sal
  return (
    <Card>
      <CardContent>
        <SectionTitle
          step={step} hasError={!!error}
          title="Annexure I — BSE-wise Details"
          subtitle={showTds
            ? 'PF, TDS, and Deductions are editable per row. Net Sal auto-updates. Disbursement Sought = Σ Net Sal.'
            : 'PF and Deductions are editable per row. TDS column is hidden because TDS is not applicable for this disbursement.'}
        />
        {rows.length > 0 && (
          <Alert
            severity={attendanceDays > 0 ? 'success' : 'info'}
            variant="outlined"
            icon={attendanceLoading ? <CircularProgress size={16} /> : undefined}
            sx={{ mb: 2 }}
          >
            {attendanceLoading
              ? `Loading marked attendance for ${month} ${year}…`
              : attendanceDays > 0
                ? <>Working Days per row auto-filled from your marked attendance for {month} {year} — <strong>{attendanceDays}</strong> day{attendanceDays === 1 ? '' : 's'} across {rows.length} BSE{rows.length === 1 ? '' : 's'}.</>
                : <>No attendance marked for {month} {year} yet. Mark days in <strong>My Resources → Attendance</strong> and Working Days will fill in automatically.</>}
          </Alert>
        )}
        {error && (
          <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>
        )}

        {rows.length === 0 ? (
          <Alert severity="info">Pick one or more BSEs above to build Annexure I.</Alert>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 900 }}>
              <TableHead>
                <TableRow>
                  <TableCell width={48}>#</TableCell>
                  <TableCell>IA Name</TableCell>
                  <TableCell>Resource</TableCell>
                  <TableCell align="right">Working Days</TableCell>
                  <TableCell align="right">Gross Sal (₹)</TableCell>
                  <TableCell align="right">PF (₹)</TableCell>
                  {showTds && <TableCell align="right">TDS (₹)</TableCell>}
                  <TableCell align="right">Deductions (₹)</TableCell>
                  <TableCell align="right">Additional (₹)</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell align="right">Net Sal (₹)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r, i) => (
                  <AnnexureRow key={r.bseId} row={r} index={i + 1} onSet={onSet} showTds={showTds} />
                ))}
                <TableRow>
                  <TableCell colSpan={colSpan} align="right" sx={{ fontWeight: 700 }}>
                    Total (Disbursement Sought)
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.dark' }}>
                    ₹{total.toLocaleString('en-IN')}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Box>
        )}
      </CardContent>
    </Card>
  )
})

const AnnexureRow = memo(function AnnexureRow({ row, index, onSet, showTds }) {
  const bseId = row.bseId
  const setPf  = useCallback((e) => onSet(bseId, 'pf',                e.target.value), [bseId, onSet])
  const setTds = useCallback((e) => onSet(bseId, 'tds',               e.target.value), [bseId, onSet])
  const setDed = useCallback((e) => onSet(bseId, 'deductions',        e.target.value), [bseId, onSet])
  const setAdd = useCallback((e) => onSet(bseId, 'additionalAmount',  e.target.value), [bseId, onSet])
  const setRsn = useCallback((e) => onSet(bseId, 'additionalReason',  e.target.value), [bseId, onSet])

  // `row.tds` is already forced to 0 upstream when TDS isn't applicable, so
  // `netSalOf` handles both cases without extra branching here.
  const net = netSalOf(row)

  return (
    <TableRow>
      <TableCell><Mono>{index}</Mono></TableCell>
      <TableCell>{row.iaName || '—'}</TableCell>
      <TableCell>{row.bseName || '—'}</TableCell>
      <TableCell align="right"><Mono>{row.workingDays ?? '—'}</Mono></TableCell>
      <TableCell align="right"><Mono>{formatMoney(row.grossSalary)}</Mono></TableCell>
      <TableCell align="right"><CellMoney value={row.pf} onChange={setPf} /></TableCell>
      {showTds && <TableCell align="right"><CellMoney value={row.tds} onChange={setTds} /></TableCell>}
      <TableCell align="right"><CellMoney value={row.deductions} onChange={setDed} /></TableCell>
      <TableCell align="right"><CellMoney value={row.additionalAmount} onChange={setAdd} /></TableCell>
      <TableCell><CellText value={row.additionalReason} onChange={setRsn} /></TableCell>
      <TableCell align="right" sx={{ fontWeight: 700 }}>
        <Mono>{formatMoney(net)}</Mono>
      </TableCell>
    </TableRow>
  )
})

const CellMoney = memo(function CellMoney({ value, onChange }) {
  return (
    <TextField
      size="small" type="number" value={value ?? ''} onChange={onChange}
      inputProps={{ min: 0, step: 1, style: { textAlign: 'right' } }}
      sx={{ width: 96 }}
    />
  )
})

const CellText = memo(function CellText({ value, onChange }) {
  return (
    <TextField
      size="small" value={value ?? ''} onChange={onChange}
      placeholder="Reason (optional)"
      sx={{ minWidth: 160 }}
    />
  )
})

// ── Section 4: Invoice Details ─────────────────────────────────────────────

const InvoiceDetails = memo(function InvoiceDetails({
  step, date, onDate, number, onNumber, value, onValue, gstAmount, total,
  errorDate = '', errorNumber = '', errorValue = '',
}) {
  const setDate = useCallback((e) => onDate(e.target.value), [onDate])
  const setNumber = useCallback((e) => onNumber(e.target.value), [onNumber])
  const setValue = useCallback((e) => onValue(e.target.value), [onValue])
  const hasError = !!(errorDate || errorNumber || errorValue)

  return (
    <Card>
      <CardContent>
        <SectionTitle
          step={step} hasError={hasError}
          title="Invoice Details"
          subtitle="Invoice Date / Number / Value are also modifiable at HO Maker level."
        />
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField fullWidth size="small" type="date" label="Invoice Date *"
              InputLabelProps={{ shrink: true }} value={date} onChange={setDate}
              error={!!errorDate}
              helperText={errorDate || ' '} />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField fullWidth size="small" label="Invoice Number *"
              value={number} onChange={setNumber}
              error={!!errorNumber}
              helperText={errorNumber || ' '} />
          </Grid>
          <Grid size={{ xs: 12, sm: 2 }}>
            <TextField fullWidth size="small" type="number" label="Value of Service *"
              value={value} onChange={setValue}
              error={!!errorValue}
              helperText={errorValue || ' '}
              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 2 }}>
            <TextField fullWidth size="small" label="IGST @18%"
              value={gstAmount === '' ? '' : formatMoney(gstAmount)}
              InputProps={{ readOnly: true, startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              sx={{ '& .MuiInputBase-root': { bgcolor: 'action.hover' } }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 2 }}>
            <TextField fullWidth size="small" label="Total Amount"
              value={total === '' ? '' : formatMoney(total)}
              InputProps={{ readOnly: true, startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              sx={{ '& .MuiInputBase-root': { bgcolor: 'action.hover' }, fontWeight: 700 }} />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
})

// ── Section 5: TDS & Compliance ────────────────────────────────────────────

// TDS applicability + reason live in Vendor Details (per the spec's autofill
// block at the top). This section is just the row-12 compliance toggle plus
// the row-11 read-only Account Code.
const ComplianceSection = memo(function ComplianceSection({ step, compliance, onCompliance, error = '' }) {
  return (
    <Card>
      <CardContent>
        <SectionTitle
          step={step} hasError={!!error}
          title="Compliance"
          subtitle="Confirm pre-disbursement terms before submitting. Modifiable at HO Maker level."
        />
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 3 }}>
            <ReadOnlyInput label="Account Code" value={DEFAULT_ACCOUNT_CODE} mono />
          </Grid>
          <Grid size={{ xs: 12, sm: 9 }}>
            <FormControlLabel
              control={<Switch checked={compliance}
                onChange={(_, v) => onCompliance(v)} />}
              label={compliance
                ? 'Compliance of pre-disbursement terms confirmed'
                : 'Confirm compliance of pre-disbursement terms & conditions *'}
              sx={{ color: error ? 'error.main' : undefined }}
            />
            {error && (
              <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5, ml: 4.5 }}>
                {error}
              </Typography>
            )}
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
})

// ── Shared bits ────────────────────────────────────────────────────────────

// Section title with a numbered step badge on the left. Colour comes from
// `hasError` — red circle if the section has any inline error, primary blue
// otherwise. Keeps the eye moving through the page in order.
const SectionTitle = memo(function SectionTitle({ step, title, subtitle, hasError }) {
  return (
    <Stack direction="row" spacing={1.75} alignItems="flex-start" sx={{ mb: 2 }}>
      {step != null && (
        <Box sx={{
          width: 30, height: 30, borderRadius: '50%',
          bgcolor: hasError ? 'error.main' : 'primary.main',
          color: 'primary.contrastText',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: '0.9rem', flexShrink: 0, mt: 0.25,
        }}>
          {step}
        </Box>
      )}
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
        {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
      </Box>
    </Stack>
  )
})

// Sticky-footer summary. Shows a green "ready to submit" chip when the form
// is valid; otherwise a red chip with the first blocker so the user knows
// exactly what to fix. Plus a compact total-and-count chip.
const StatusChipsFooter = memo(function StatusChipsFooter({ isValid, firstError, selectedCount, total }) {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
      {isValid ? (
        <Chip
          size="small" color="success" variant="filled"
          icon={<CheckCircleOutlineIcon />}
          label="Ready to submit"
          sx={{ fontWeight: 700 }}
        />
      ) : (
        <Chip
          size="small" color="warning" variant="filled"
          icon={<ErrorOutlineIcon />}
          label={firstError || 'Complete the highlighted fields'}
          sx={{ fontWeight: 600, maxWidth: 520 }}
        />
      )}
      <Chip
        size="small" variant="outlined"
        label={`${selectedCount} BSE${selectedCount === 1 ? '' : 's'} · ₹${total.toLocaleString('en-IN')}`}
      />
    </Stack>
  )
})

// Sub-section header inside a Card — used to visually separate the read-only
// "Autofilled" block from the "For this disbursement" inputs. Small, subdued.
const GroupLabel = memo(function GroupLabel({ children, required }) {
  return (
    <Typography
      variant="overline"
      sx={{
        display: 'block',
        color: 'text.secondary',
        letterSpacing: '0.14em',
        mb: 1.25,
        borderLeft: 3,
        borderColor: required ? 'primary.main' : 'action.disabled',
        pl: 1,
      }}
    >
      {children}{required && ' — please fill below'}
    </Typography>
  )
})

// Plain-text label + value. Replaces the previous filled-TextField look —
// autofilled data now reads as clean typography, not as inputs the user
// might mistake for editable. Small overline label above, value below.
const ReadOnlyInput = memo(function ReadOnlyInput({ label, value, mono, prefix, placeholder }) {
  const display = value === '' || value == null
    ? (placeholder || '—')
    : value
  const isEmpty = value === '' || value == null
  return (
    <Box sx={{ py: 0.25 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.7rem' }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          mt: 0.25,
          fontWeight: 600,
          fontSize: '0.95rem',
          color: isEmpty ? 'text.disabled' : 'text.primary',
          fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' : undefined,
          wordBreak: 'break-word',
        }}
      >
        {prefix && <Box component="span" sx={{ color: 'text.secondary', mr: 0.5 }}>{prefix}</Box>}
        {display}
      </Typography>
    </Box>
  )
})

// Kept as a fallback for any legacy caller (Disbursement Summary etc. still
// uses it). Prefer `<ReadOnlyInput />` in new code.
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

// ── Helpers ────────────────────────────────────────────────────────────────

// Merge a BSE record + the user's row-level overrides into the canonical
// Annexure I row shape used by the table and the payload adapter.
// `attendanceDays` is the count of days the vendor has marked as present
// in the Attendance workspace for the picked month — used as the default
// Working Days unless the user has overridden it inline.
function buildRow(bse, override = {}, attendanceDays = 0) {
  return {
    bseId: bse.uuid,
    iaId: bse.registrationUuid,
    bseName: bse.bseName,
    iaName: bse.industryAssociationName,
    grossSalary: grossSalaryOf(bse),
    workingDays: override.workingDays ?? attendanceDays,
    pf: override.pf ?? '',
    tds: override.tds ?? '',
    deductions: override.deductions ?? '',
    additionalAmount: override.additionalAmount ?? '',
    additionalReason: override.additionalReason ?? '',
  }
}

// The BSE's monthly gross salary. `approvedSalary` (set by HO in the
// Onboarding block) is the canonical value, but it's null on records where
// HO hasn't finalised it yet — fall through to the values the candidate/GT
// captured so the Annexure I table doesn't render Gross Sal as zero.
function grossSalaryOf(bse) {
  const chain = [bse?.approvedSalary, bse?.expectedSalary, bse?.currentSalary, bse?.lastDrawnSalary]
  for (const v of chain) {
    if (v != null && v !== '' && Number(v) > 0) return Number(v)
  }
  return 0
}

function formatMoney(v) {
  if (v == null || v === '') return ''
  return Number(v).toLocaleString('en-IN')
}

// Compute every field-level error in one pass. Returns an object keyed by
// field name so inline inputs can pick up their own error text; also stores
// the first-in-order blocker as `_first` for the sticky footer + toast.
function computeErrors({
  vendor, annexureRows, invoiceDate, invoiceNumber, invoiceValue, compliance,
  tdsApplicable, tdsNotApplicableReason, reasonForNoGstin,
}) {
  const e = {}
  const set = (k, msg) => { if (!e[k]) e[k] = msg }

  // Vendor Details (conditional inputs)
  if (!vendor?.gstNo && !reasonForNoGstin.trim()) {
    set('reasonForNoGstin', 'Reason is required when the vendor has no GSTIN.')
  }
  if (!tdsApplicable && !tdsNotApplicableReason.trim()) {
    set('tdsNotApplicableReason', 'Reason is required when TDS is not applicable.')
  }

  // Resource selection + Annexure rows — backend scopes each note to one
  // BSE, so no cross-IA guard is needed anymore.
  if (annexureRows.length === 0) {
    set('resources', 'Pick a BSE for this disbursement.')
  } else {
    // First blocking row-level issue (so the footer message names the BSE).
    for (const r of annexureRows) {
      if (Number(r.workingDays) <= 0) { set('rows', `${r.bseName}: working days must be greater than 0.`); break }
      if (Number(r.pf) < 0) { set('rows', `${r.bseName}: PF cannot be negative.`); break }
      if (Number(r.tds) < 0) { set('rows', `${r.bseName}: TDS cannot be negative.`); break }
      if (Number(r.deductions) < 0) { set('rows', `${r.bseName}: Deductions cannot be negative.`); break }
      if (netSalOf(r) <= 0) { set('rows', `${r.bseName}: Net Sal must be greater than 0 — adjust PF / TDS / Deductions.`); break }
    }
  }

  // Invoice
  if (!invoiceDate) set('invoiceDate', 'Invoice date is required.')
  if (!invoiceNumber?.trim()) set('invoiceNumber', 'Invoice number is required.')
  if (invoiceValue === '' || Number(invoiceValue) <= 0) {
    set('invoiceValue', 'Value of service must be greater than 0.')
  }

  // Compliance
  if (!compliance) set('compliance', 'Confirm compliance to submit.')

  // Preserve reading order so the "first problem" chip matches how the user
  // scans the page top-to-bottom.
  e._first = e.reasonForNoGstin || e.tdsNotApplicableReason
    || e.resources || e.rows
    || e.invoiceDate || e.invoiceNumber || e.invoiceValue
    || e.compliance || null
  return e
}
