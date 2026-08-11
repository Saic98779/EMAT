import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box, Card, Table, TableHead, TableBody, TableRow, TableCell, Typography, Button,
  Alert, CircularProgress, Stack, IconButton, Tooltip, TextField, InputAdornment,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions, Grid, MenuItem, Switch,
  FormControlLabel, Snackbar,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import SearchIcon from '@mui/icons-material/Search'
import SaveIcon from '@mui/icons-material/Save'
import { PageHeader, Mono } from '../../components/shared'
import { useVendors, useCreateVendor, useUpdateVendor, useDeleteVendor } from '../../queries'
import { STATES, districtsOf } from '../../geo'

const EMPTY_VENDOR = {
  vendorName: '', companyName: '', contactPerson: '', email: '', mobileNo: '',
  gstNo: '', panNo: '',
  address: '', district: '', state: '', pinCode: '',
  bankName: '', accountNumber: '', ifscCode: '', branchName: '',
  active: true,
}

// Format patterns used across the vendor form. Kept as constants so the
// same regex + human message power both the row validation and the per-
// field helperText hint.
const PATTERNS = {
  email:  { re: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, msg: 'Enter a valid email' },
  mobile: { re: /^[6-9]\d{9}$/,               msg: '10 digits, starts with 6–9' },
  pin:    { re: /^[1-9]\d{5}$/,               msg: '6 digits, first digit 1–9' },
  gst:    { re: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, msg: '15-char GSTIN, e.g. 09AABCS3480N5ZS' },
  pan:    { re: /^[A-Z]{5}[0-9]{4}[A-Z]$/,    msg: '10-char PAN, e.g. AABCS3480N' },
  ifsc:   { re: /^[A-Z]{4}0[A-Z0-9]{6}$/,     msg: '11-char IFSC, e.g. SBIN0001234' },
  account:{ re: /^\d{9,18}$/,                 msg: 'Account number: 9–18 digits' },
}

// Client-side validation. Required fields are gated; optional fields are
// still pattern-checked once the user types something, so we don't ship
// malformed GSTINs / PANs to the backend.
function firstProblem(v) {
  if (!v.vendorName?.trim()) return 'Vendor name is required'
  if (!v.email?.trim()) return 'Email is required'
  if (!PATTERNS.email.re.test(v.email.trim())) return PATTERNS.email.msg
  const opt = (val, key, label) => {
    const s = String(val || '').trim()
    if (!s) return null
    if (!PATTERNS[key].re.test(s)) return `${label}: ${PATTERNS[key].msg}`
    return null
  }
  return (
    opt(v.mobileNo,      'mobile',  'Mobile') ||
    opt(v.pinCode,       'pin',     'Pincode') ||
    opt(v.gstNo,         'gst',     'GSTIN') ||
    opt(v.panNo,         'pan',     'PAN') ||
    opt(v.ifscCode,      'ifsc',    'IFSC Code') ||
    opt(v.accountNumber, 'account', 'Account Number')
  )
}

// SDE-owned Vendor Management. Third-party vendors are the source-of-truth
// for who dispatches BSE offer letters and who logs in as a Manpower Agency.
export default function Vendors() {
  const { data: vendors = [], isLoading, isFetching, error, refetch } = useVendors()
  const createM = useCreateVendor()
  const updateM = useUpdateVendor()
  const deleteM = useDeleteVendor()

  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null) // vendor being edited, or `EMPTY_VENDOR` for new, or null when closed
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [toast, setToast] = useState({ severity: '', msg: '' })

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return vendors
    return vendors.filter((v) => [v.vendorName, v.companyName, v.contactPerson, v.email, v.gstNo]
      .some((f) => (f || '').toLowerCase().includes(term)))
  }, [vendors, q])

  const initialLoading = isLoading && vendors.length === 0
  const refetching = isFetching && vendors.length > 0

  const openCreate = useCallback(() => setEditing({ ...EMPTY_VENDOR }), [])
  const openEdit = useCallback((vendor) => setEditing({ ...EMPTY_VENDOR, ...vendor }), [])
  const closeDialog = useCallback(() => setEditing(null), [])

  const save = useCallback(async (values) => {
    const problem = firstProblem(values)
    if (problem) { setToast({ severity: 'warning', msg: problem }); return }
    try {
      // Backend returns `vendorId: null` on every row — `uuid` is the actual
      // primary key. Existing record ⇒ PUT; new record ⇒ POST.
      if (values.uuid) {
        await updateM.mutateAsync({ uuid: values.uuid, values })
        setToast({ severity: 'success', msg: `${values.vendorName} updated.` })
      } else {
        await createM.mutateAsync(values)
        setToast({ severity: 'success', msg: `${values.vendorName} added.` })
      }
      setEditing(null)
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Failed to save vendor.' })
    }
  }, [createM, updateM])

  const doDelete = useCallback(async () => {
    if (!deleteTarget?.uuid) return
    try {
      await deleteM.mutateAsync(deleteTarget.uuid)
      setToast({ severity: 'success', msg: `${deleteTarget.vendorName} removed.` })
      setDeleteTarget(null)
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Failed to delete vendor.' })
    }
  }, [deleteM, deleteTarget])

  const saving = createM.isPending || updateM.isPending
  const deleting = deleteM.isPending

  return (
    <Box>
      <PageHeader
        title="Vendors"
        subtitle={initialLoading ? 'Loading…' : `${filtered.length} vendor${filtered.length === 1 ? '' : 's'} configured`}
        action={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={refetching ? <CircularProgress size={16} /> : <RefreshIcon />}
              onClick={() => refetch()} disabled={isLoading}>
              {refetching ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Vendor</Button>
          </Stack>
        }
      />

      <TextField
        size="small" placeholder="Search vendor name, company, GST, email…" value={q}
        onChange={(e) => setQ(e.target.value)}
        sx={{ mb: 2, maxWidth: 380 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => refetch()}>Retry</Button>}>
          {error.message || 'Failed to load vendors'}
        </Alert>
      )}

      {initialLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <Card>
          <Table sx={{ '& tbody tr:last-of-type td': { border: 0 } }}>
            <TableHead>
              <TableRow>
                <TableCell>Vendor</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>GST</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 && !error && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">
                      {q ? `No vendors match “${q}”.` : 'No vendors yet. Click "Add Vendor" to create one.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((v) => (
                <TableRow key={v.uuid} hover onClick={() => openEdit(v)} sx={{ cursor: 'pointer' }}>
                  <TableCell>
                    <Typography fontWeight={700} fontSize="0.95rem">{v.vendorName || '—'}</Typography>
                    <Mono>{v.companyName || '—'}</Mono>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{v.contactPerson || '—'}</Typography>
                    <Mono>{v.email} · {v.mobileNo}</Mono>
                  </TableCell>
                  <TableCell><Mono>{v.gstNo || '—'}</Mono></TableCell>
                  <TableCell>
                    <Chip size="small" color={v.active ? 'success' : 'default'} variant={v.active ? 'filled' : 'outlined'}
                      label={v.active ? 'Active' : 'Inactive'} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(v) }}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(v) }}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <VendorDialog
        open={!!editing}
        initial={editing}
        saving={saving}
        onClose={closeDialog}
        onSave={save}
      />

      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete vendor?</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{deleteTarget?.vendorName}</strong> will be permanently removed.
            This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
          <Button color="error" variant="contained" onClick={doDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast.msg}
        autoHideDuration={3000}
        onClose={() => setToast({ severity: '', msg: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast.severity || 'info'} variant="filled" onClose={() => setToast({ severity: '', msg: '' })}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}

// ── Editor dialog ───────────────────────────────────────────────────────────
// Perf shape (matches HoBseReview): each visible field is a memoized child
// component with stable `onSet` and `name` props. Typing in one field only
// re-renders that field's <Field> — the other 14 inputs skip because their
// props are shallow-equal from render to render.

function VendorDialog({ open, initial, saving, onClose, onSave }) {
  const [v, setV] = useState(initial || EMPTY_VENDOR)

  // Reset the draft whenever the dialog opens with a new record. `open` is in
  // the deps so re-opening on the same record also resets to the fresh copy.
  useEffect(() => {
    if (open) setV(initial || EMPTY_VENDOR)
  }, [open, initial])

  // A single stable setter. Cascading rules (state → clears district) live
  // here so the field callbacks stay dumb and identity-stable.
  const set = useCallback((name, value) => {
    setV((prev) => {
      if (name === 'state') return { ...prev, state: value, district: '' }
      return { ...prev, [name]: value }
    })
  }, [])

  const setActive = useCallback((_, checked) => set('active', checked), [set])
  const submit = useCallback(() => onSave(v), [onSave, v])

  // Districts recompute only when state changes, not on every keystroke.
  const districts = useMemo(() => (v.state ? districtsOf(v.state) : []), [v.state])

  // Use `uuid` (the real backend PK) — `vendorId` comes back null on every row.
  const isEdit = !!initial?.uuid

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>{isEdit ? 'Edit vendor' : 'Add new vendor'}</DialogTitle>
      <DialogContent dividers>
        <Section title="Company & Contact">
          <Grid container spacing={2}>
            <GridCell><Field name="vendorName" value={v.vendorName} onSet={set} label="Vendor Name *" disabled={saving} /></GridCell>
            <GridCell><Field name="companyName" value={v.companyName} onSet={set} label="Company Name" disabled={saving} /></GridCell>
            <GridCell><Field name="contactPerson" value={v.contactPerson} onSet={set} label="Contact Person" disabled={saving} /></GridCell>
            <GridCell><Field name="email" value={v.email} onSet={set} label="Email *" type="email" disabled={saving} /></GridCell>
            <GridCell><Field name="mobileNo" value={v.mobileNo} onSet={set} label="Mobile" disabled={saving} /></GridCell>
          </Grid>
        </Section>

        <Section title="Tax IDs">
          <Grid container spacing={2}>
            <GridCell><Field name="gstNo" value={v.gstNo} onSet={set} label="GSTIN" disabled={saving} /></GridCell>
            <GridCell><Field name="panNo" value={v.panNo} onSet={set} label="PAN" disabled={saving} /></GridCell>
          </Grid>
        </Section>

        <Section title="Address">
          <Grid container spacing={2}>
            <Grid size={12}>
              <Field name="address" value={v.address} onSet={set} label="Address" multiline minRows={2} disabled={saving} />
            </Grid>
            <GridCell sm={4}>
              <SelectField name="state" value={v.state} onSet={set} label="State" disabled={saving} options={STATES} />
            </GridCell>
            <GridCell sm={4}>
              <SelectField name="district" value={v.district} onSet={set} label="District"
                disabled={saving || !v.state} options={districts}
                helperText={!v.state ? 'Pick a state first' : undefined} />
            </GridCell>
            <GridCell sm={4}>
              <Field name="pinCode" value={v.pinCode} onSet={set} label="Pincode" disabled={saving} />
            </GridCell>
          </Grid>
        </Section>

        <Section title="Bank Details">
          <Grid container spacing={2}>
            <GridCell><Field name="bankName" value={v.bankName} onSet={set} label="Bank Name" disabled={saving} /></GridCell>
            <GridCell><Field name="branchName" value={v.branchName} onSet={set} label="Branch Name" disabled={saving} /></GridCell>
            <GridCell><Field name="accountNumber" value={v.accountNumber} onSet={set} label="Account Number" disabled={saving} /></GridCell>
            <GridCell><Field name="ifscCode" value={v.ifscCode} onSet={set} label="IFSC Code" disabled={saving} /></GridCell>
          </Grid>
        </Section>

        <Section title="Status">
          <FormControlLabel
            control={<Switch checked={!!v.active} onChange={setActive} disabled={saving} />}
            label={v.active
              ? 'Active (available for BSE onboarding + disbursements)'
              : 'Inactive (hidden from dropdowns)'}
          />
        </Section>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          onClick={submit}
          disabled={saving}
        >
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create vendor'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Memoized field primitives ───────────────────────────────────────────────
// Each Field re-renders only when its own `value` (or a passed-through prop)
// changes. `onSet` and `name` are stable from the parent, so typing in one
// input doesn't trigger a re-render of the other 14.

const Field = memo(function Field({ name, value, onSet, label, ...rest }) {
  const onChange = useCallback((e) => onSet(name, e.target.value), [name, onSet])
  return (
    <TextField
      size="small"
      fullWidth
      value={value ?? ''}
      onChange={onChange}
      label={label}
      {...rest}
    />
  )
})

const SelectField = memo(function SelectField({ name, value, onSet, label, options, helperText, disabled }) {
  const onChange = useCallback((e) => onSet(name, e.target.value), [name, onSet])
  return (
    <TextField
      select
      size="small"
      fullWidth
      value={value ?? ''}
      onChange={onChange}
      label={label}
      helperText={helperText}
      disabled={disabled}
    >
      <MenuItem value=""><em>—</em></MenuItem>
      {options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
    </TextField>
  )
})

const GridCell = memo(function GridCell({ children, sm = 6 }) {
  return <Grid size={{ xs: 12, sm }}>{children}</Grid>
})

const Section = memo(function Section({ title, children }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1.25, letterSpacing: '0.12em' }}>
        {title}
      </Typography>
      {children}
    </Box>
  )
})
