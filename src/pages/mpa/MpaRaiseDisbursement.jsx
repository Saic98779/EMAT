import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Stack, Typography, Button, Snackbar, Alert, Chip,
  Paper, CircularProgress, TextField, MenuItem, InputAdornment, Table, TableHead,
  TableBody, TableRow, TableCell, Checkbox, FormControlLabel, Switch, Divider,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SendIcon from '@mui/icons-material/Send'
import { PageHeader, Mono } from '../../components/shared'
import { useAuth } from '../../auth'
import { useMyVendor, useBseByVendorSelected } from '../../queries'
import { createVendorDisbursement, netSalOf } from '../../apis/vendorDisbursements'

// Raise Salary Disbursement Note — Manpower Agency / Vendor screen.
//
// Data sources (no more hardcoded profiles):
//   • Vendor autofill  ← useMyVendor(session.email)
//   • Resource list    ← useBseByVendorSelected(vendorUuid) — the
//                        committee-selected BSEs mapped to this vendor.
//   • Post             ← POST /vendor-disbursements
//
// Screen structure follows the Excel spec:
//   ① Vendor Details       (autofilled, read-only)
//   ② Resource Selection   (month + multi-checkbox BSE list)
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

  const vendorQ = useMyVendor(user?.email)
  const vendor = vendorQ.data
  const vendorUuid = vendor?.vendorId

  const bsesQ = useBseByVendorSelected(vendorUuid)
  // `useMemo` gives the fallback a stable reference — otherwise every parent
  // render would recreate `[]` and re-trigger the resource-sync effect below.
  const resources = useMemo(() => bsesQ.data || EMPTY_RESOURCES, [bsesQ.data])

  // Header-level state.
  const monthNow = MONTHS[new Date().getMonth()]
  const [month, setMonth] = useState(monthNow)
  const [year, setYear] = useState(CURRENT_YEAR)

  // Multi-select of BSE UUIDs. Sync with the fetched list whenever it
  // changes so stale UUIDs (from a prior mount) don't sneak into the
  // payload. The setter returns `prev` when the intersection is identical,
  // which lets React bail out — critical to avoid the "Maximum update depth"
  // loop when the fetched list flips between undefined/[]/stable data.
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev
      const known = new Set(resources.map((r) => r.uuid))
      let changed = false
      const next = new Set()
      for (const id of prev) {
        if (known.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [resources])

  // Annexure I row overrides — user edits to PF/TDS/Deductions/etc. Keyed by
  // BSE uuid. Not merged with `resources` in state because we always want to
  // recompute from the freshest server data.
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
      if (next.has(bseUuid)) next.delete(bseUuid); else next.add(bseUuid)
      return next
    })
  }, [])
  const selectAll = useCallback((checked) => {
    setSelectedIds(checked ? new Set(resources.map((r) => r.uuid)) : new Set())
  }, [resources])

  // Compose the concrete Annexure I rows we'll send.
  const annexureRows = useMemo(
    () => resources
      .filter((r) => selectedIds.has(r.uuid))
      .map((r) => buildRow(r, rowOverrides[r.uuid])),
    [resources, selectedIds, rowOverrides],
  )

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

  // TDS is inferred from vendor profile; the vendor DTO doesn't have a TDS
  // column today, so default to false with a note. Swap for the real field
  // once backend adds it.
  const tdsApplicable = false
  const tdsNotApplicableReason = null

  const salaryMonth = `${month}-${year}`
  const natureOfPayment = `Payment towards Salary for the month ${salaryMonth} of ${annexureRows.length} BSE${annexureRows.length === 1 ? '' : 's'}. BSE-wise Details in Annexure I.`

  const [toast, setToast] = useState({ severity: '', msg: '' })
  const [busy, setBusy] = useState(false)

  const submit = useCallback(async () => {
    if (busy) return
    const problem = validate({
      vendor, annexureRows, invoiceDate, invoiceNumber, invoiceValue, compliance,
    })
    if (problem) {
      setToast({ severity: 'warning', msg: problem })
      return
    }
    setBusy(true)
    try {
      await createVendorDisbursement({
        vendorName: vendor.vendorName,
        gstinOfAgency: vendor.gstNo,
        reasonForNoGstin: null,
        gstinOfSdbi: SIDBI_GSTIN,
        // TODO: sanctionedAmount / disbursedTillDate live on a per-vendor
        // ledger the backend hasn't shipped yet — leave blank until it does.
        sanctionedAmount: null,
        disbursedTillDate: null,
        natureOfPayment,
        invoiceDate, invoiceNumber, invoiceValue,
        tdsApplicable, tdsNotApplicableReason,
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
          a vendor whose email matches your login before raising a disbursement.
        </Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 1080, mx: 'auto', pb: 9 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/mpa')} sx={{ mb: 2 }} disabled={busy}>
        Back
      </Button>
      <Box textAlign="center" mb={3}>
        <Chip label="Vendor / Consultancy · New Disbursement"
          sx={{ bgcolor: 'primary.light', color: 'primary.dark', mb: 1.5, fontWeight: 700 }} />
        <Typography variant="h4">Raise Salary Disbursement</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 640, mx: 'auto' }}>
          Select the BSEs paid this cycle, fill Annexure I, attach invoice details, and submit
          to the SIDBI HO Maker for review.
        </Typography>
      </Box>

      <Stack spacing={2.5}>
        <VendorDetails vendor={vendor} />

        <ResourceSelection
          month={month} setMonth={setMonth}
          year={year} setYear={setYear}
          resources={resources}
          selectedIds={selectedIds}
          onToggle={toggleResource}
          onSelectAll={selectAll}
        />

        <AnnexureTable rows={annexureRows} onSet={setRowField} total={disbursementSought} />

        <DisbursementSummary
          total={disbursementSought}
          natureOfPayment={natureOfPayment}
        />

        <InvoiceDetails
          date={invoiceDate} onDate={setInvoiceDate}
          number={invoiceNumber} onNumber={setInvoiceNumber}
          value={invoiceValue} onValue={setInvoiceValue}
          gstAmount={gstAmount} total={invoiceTotal}
        />

        <TdsAndCompliance
          vendor={vendor}
          compliance={compliance}
          onCompliance={setCompliance}
        />
      </Stack>

      <Paper elevation={3} sx={{ position: 'sticky', bottom: 16, mt: 3, p: 1.5, borderRadius: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
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

// ── Section 1: Vendor Details (autofilled, read-only) ──────────────────────

const VendorDetails = memo(function VendorDetails({ vendor }) {
  return (
    <Card>
      <CardContent>
        <SectionTitle title="Vendor Details" subtitle="Autofilled from your vendor record. Managed by SDE." />
        <Grid container spacing={2}>
          <ReadField label="Manpower Agency Name" value={vendor.vendorName} span={6} />
          <ReadField label="GSTIN of the Agency" value={vendor.gstNo} span={3} mono />
          <ReadField label="GSTIN of SIDBI" value={SIDBI_GSTIN} span={3} mono />
          <ReadField label="Company" value={vendor.companyName} span={6} />
          <ReadField label="Contact Person" value={vendor.contactPerson} span={3} />
          <ReadField label="Contact" value={`${vendor.email || ''} · ${vendor.mobileNo || ''}`} span={3} mono />
        </Grid>
      </CardContent>
    </Card>
  )
})

// ── Between the table and Invoice: reads directly from the table's totals.
// "Disbursement Sought" and "Nature of Payment" both derive from the Annexure
// I total per the spec — displayed here as read-only fields immediately after
// the table so the connection is visible.
const DisbursementSummary = memo(function DisbursementSummary({ total, natureOfPayment }) {
  return (
    <Card>
      <CardContent>
        <SectionTitle title="Disbursement Summary" subtitle="Auto-derived from the Annexure I table above." />
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

const ResourceSelection = memo(function ResourceSelection({
  month, setMonth, year, setYear, resources, selectedIds, onToggle, onSelectAll,
}) {
  const selectedCount = selectedIds.size
  const allChecked = resources.length > 0 && selectedCount === resources.length
  const partial = selectedCount > 0 && !allChecked

  return (
    <Card>
      <CardContent>
        <SectionTitle title="Resource Selection"
          subtitle="Pick the cycle month and the BSEs paid this cycle." />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
          <TextField select size="small" label="Month" value={month}
            onChange={(e) => setMonth(e.target.value)} sx={{ minWidth: 160 }}>
            {MONTHS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Year" value={year}
            onChange={(e) => setYear(Number(e.target.value))} sx={{ minWidth: 120 }}>
            {YEARS.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </TextField>
          <Box sx={{ flexGrow: 1 }} />
          <Chip label={`${selectedCount} / ${resources.length} selected`} color="primary"
            variant={selectedCount ? 'filled' : 'outlined'} sx={{ alignSelf: 'center', fontWeight: 700 }} />
        </Stack>

        {resources.length === 0 ? (
          <Alert severity="info">
            No selected BSEs mapped to you yet. Once SIDBI HO onboards resources under your
            vendor, they&apos;ll appear here.
          </Alert>
        ) : (
          <>
            <FormControlLabel
              control={<Checkbox
                checked={allChecked} indeterminate={partial}
                onChange={(_, checked) => onSelectAll(checked)} />}
              label={allChecked ? 'Deselect all' : 'Select all'}
              sx={{ mb: 0.5 }}
            />
            <Divider />
            <Stack sx={{ maxHeight: 260, overflow: 'auto' }}>
              {resources.map((r) => (
                <ResourceRow key={r.uuid} resource={r}
                  checked={selectedIds.has(r.uuid)} onToggle={onToggle} />
              ))}
            </Stack>
          </>
        )}
      </CardContent>
    </Card>
  )
})

const ResourceRow = memo(function ResourceRow({ resource, checked, onToggle }) {
  const handleChange = useCallback(() => onToggle(resource.uuid), [onToggle, resource.uuid])
  return (
    <Stack direction="row" alignItems="center" spacing={1.5}
      sx={{ py: 0.75, borderBottom: '1px solid', borderColor: 'divider', ':last-child': { border: 0 } }}>
      <Checkbox size="small" checked={checked} onChange={handleChange} />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography fontWeight={600} noWrap>{resource.bseName || '—'}</Typography>
        <Mono>{resource.industryAssociationName || '—'} · {resource.mobileNumber || '—'}</Mono>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
        Gross ₹{resource.approvedSalary ?? '—'}
      </Typography>
    </Stack>
  )
})

// ── Section 3: Annexure I table ────────────────────────────────────────────

const AnnexureTable = memo(function AnnexureTable({ rows, onSet, total }) {
  return (
    <Card>
      <CardContent>
        <SectionTitle title="Annexure I — BSE-wise Details"
          subtitle="PF, TDS, and Deductions are editable per row. Net Sal auto-updates. Disbursement Sought = Σ Net Sal." />

        {rows.length === 0 ? (
          <Alert severity="info">Select at least one resource above to build Annexure I.</Alert>
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
                  <TableCell align="right">TDS (₹)</TableCell>
                  <TableCell align="right">Deductions (₹)</TableCell>
                  <TableCell align="right">Net Sal (₹)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r, i) => (
                  <AnnexureRow key={r.bseId} row={r} index={i + 1} onSet={onSet} />
                ))}
                <TableRow>
                  <TableCell colSpan={8} align="right" sx={{ fontWeight: 700 }}>
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

const AnnexureRow = memo(function AnnexureRow({ row, index, onSet }) {
  const bseId = row.bseId
  const setPf  = useCallback((e) => onSet(bseId, 'pf',         e.target.value), [bseId, onSet])
  const setTds = useCallback((e) => onSet(bseId, 'tds',        e.target.value), [bseId, onSet])
  const setDed = useCallback((e) => onSet(bseId, 'deductions', e.target.value), [bseId, onSet])

  const net = netSalOf(row)

  return (
    <TableRow>
      <TableCell><Mono>{index}</Mono></TableCell>
      <TableCell>{row.iaName || '—'}</TableCell>
      <TableCell>{row.bseName || '—'}</TableCell>
      <TableCell align="right"><Mono>{row.workingDays ?? '—'}</Mono></TableCell>
      <TableCell align="right"><Mono>{formatMoney(row.grossSalary)}</Mono></TableCell>
      <TableCell align="right"><CellMoney value={row.pf} onChange={setPf} /></TableCell>
      <TableCell align="right"><CellMoney value={row.tds} onChange={setTds} /></TableCell>
      <TableCell align="right"><CellMoney value={row.deductions} onChange={setDed} /></TableCell>
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

// ── Section 4: Invoice Details ─────────────────────────────────────────────

const InvoiceDetails = memo(function InvoiceDetails({
  date, onDate, number, onNumber, value, onValue, gstAmount, total,
}) {
  const setDate = useCallback((e) => onDate(e.target.value), [onDate])
  const setNumber = useCallback((e) => onNumber(e.target.value), [onNumber])
  const setValue = useCallback((e) => onValue(e.target.value), [onValue])

  return (
    <Card>
      <CardContent>
        <SectionTitle title="Invoice Details" subtitle="Invoice Date / Number / Value are also modifiable at HO Maker level." />
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField fullWidth size="small" type="date" label="Invoice Date *"
              InputLabelProps={{ shrink: true }} value={date} onChange={setDate} />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField fullWidth size="small" label="Invoice Number *"
              value={number} onChange={setNumber} />
          </Grid>
          <Grid size={{ xs: 12, sm: 2 }}>
            <TextField fullWidth size="small" type="number" label="Value of Service *"
              value={value} onChange={setValue}
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

const TdsAndCompliance = memo(function TdsAndCompliance({ vendor, compliance, onCompliance }) {
  return (
    <Card>
      <CardContent>
        <SectionTitle title="TDS & Compliance" subtitle="TDS applicability is inferred from your vendor profile. Compliance confirmation is required to submit." />
        <Grid container spacing={2} alignItems="center">
          <ReadField label="Applicability of TDS"
            value={vendor?.tdsApplicable ? 'Yes' : 'No'} span={3} />
          <ReadField label="Account Code" value={DEFAULT_ACCOUNT_CODE} span={3} mono />
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControlLabel
              control={<Switch checked={compliance}
                onChange={(_, v) => onCompliance(v)} />}
              label={compliance
                ? 'Compliance of pre-disbursement terms confirmed'
                : 'Confirm compliance of pre-disbursement terms & conditions *'}
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
})

// ── Shared bits ────────────────────────────────────────────────────────────

const SectionTitle = memo(function SectionTitle({ title, subtitle }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
      {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
    </Box>
  )
})

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
function buildRow(bse, override = {}) {
  return {
    bseId: bse.uuid,
    iaId: bse.registrationUuid,
    bseName: bse.bseName,
    iaName: bse.industryAssociationName,
    grossSalary: bse.approvedSalary ?? 0,
    workingDays: override.workingDays ?? 30,
    pf: override.pf ?? '',
    tds: override.tds ?? '',
    deductions: override.deductions ?? '',
    additionalAmount: override.additionalAmount ?? '',
    additionalReason: override.additionalReason ?? '',
  }
}

function formatMoney(v) {
  if (v == null || v === '') return ''
  return Number(v).toLocaleString('en-IN')
}

function validate({ annexureRows, invoiceDate, invoiceNumber, invoiceValue, compliance }) {
  if (annexureRows.length === 0) return 'Select at least one BSE for this disbursement.'
  for (const r of annexureRows) {
    if (Number(r.workingDays) <= 0) return `${r.bseName}: working days must be greater than 0.`
    if (Number(r.pf) < 0) return `${r.bseName}: PF cannot be negative.`
    if (Number(r.tds) < 0) return `${r.bseName}: TDS cannot be negative.`
    if (Number(r.deductions) < 0) return `${r.bseName}: Deductions cannot be negative.`
    if (netSalOf(r) <= 0) return `${r.bseName}: Net Sal must be greater than 0 (check PF/TDS/Deductions).`
  }
  if (!invoiceDate) return 'Invoice date is required.'
  if (!invoiceNumber?.trim()) return 'Invoice number is required.'
  if (invoiceValue === '' || Number(invoiceValue) <= 0) return 'Value of service must be greater than 0.'
  if (!compliance) return 'You must confirm compliance of pre-disbursement terms & conditions.'
  return null
}
