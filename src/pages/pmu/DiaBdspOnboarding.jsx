import { useEffect, useMemo, useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import {
  Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText,
  DialogTitle, Divider, MenuItem, Stack,
} from '@mui/material'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import {
  PmuFormShell, PmuSection, FieldRow, FieldCell,
  formatFileSize, EMAIL_RE, PHONE_RE,
  RhfTextField, useForm, useWatch,
} from './_shared'
import { STATES, districtsOf } from '../../geo'
import {
  createContent, downloadBdspTemplate, importBdspRows, DIA_ENDPOINTS,
} from '../../apis/diaContent'

// DIA — BDSP Onboarding
// GT_PMU raises; SIDBI HO Checker approves. Supports CSV import.

const IMPORT_ACCEPT = '.csv,.xls,.xlsx'
const CSV_TEMPLATE_HEADERS = [
  'Name of BDSP', 'Rationale for onboarding BDSP', 'Theme',
  'Area of Service / Expertise', 'State', 'District', 'Contact', 'Email', 'KYC',
]

const INITIAL = {
  name: '', rationale: '', theme: '', area: '',
  state: '', district: '',
  contact: '', email: '', kyc: '',
}

export default function DiaBdspOnboarding() {
  const methods = useForm({ mode: 'onSubmit', defaultValues: INITIAL })
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const importRef = useRef(null)

  const submit = async (values) => {
    setSubmitting(true)
    try {
      await createContent(DIA_ENDPOINTS.BDSP, {
        nameOfBdsp: values.name.trim(),
        rationaleForOnboarding: values.rationale.trim(),
        theme: values.theme.trim(),
        areaOfServiceExpertise: values.area.trim(),
        state: values.state.trim(),
        district: values.district.trim(),
        contact: values.contact.trim(),
        email: values.email.trim(),
        kyc: values.kyc.trim(),
      })
      setToast({ severity: 'success', msg: 'Submitted. Sent to SIDBI HO Checker for approval.' })
      methods.reset(INITIAL)
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Submit failed.' })
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => methods.reset(INITIAL)

  const onPickImport = (e) => {
    const file = e.target.files?.[0]
    if (file) setImportFile(file)
    if (importRef.current) importRef.current.value = ''
  }
  const confirmImport = async () => {
    if (!importFile) return
    setImporting(true)
    try {
      const result = await importBdspRows(importFile)
      const okCount = result?.successCount ?? result?.imported ?? null
      const msg = okCount != null
        ? `Imported ${okCount} rows from ${importFile.name}. Sent for SIDBI HO Checker approval.`
        : `Imported ${importFile.name}. Sent for SIDBI HO Checker approval.`
      setToast({ severity: 'success', msg })
      setImportFile(null); setImportOpen(false)
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Import failed.' })
    } finally {
      setImporting(false)
    }
  }
  const downloadTemplate = async () => {
    try {
      await downloadBdspTemplate()
    } catch (err) {
      setToast({ severity: 'warning', msg: `Backend template unavailable (${err.message || 'error'}); generated locally.` })
      const csv = CSV_TEMPLATE_HEADERS.join(',') + '\n'
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'bdsp-import-template.csv'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  return (
    <>
      <PmuFormShell
        title="BDSP Onboarding"
        subtitle="Add a Business Development Service Provider — submits to SIDBI HO Checker for approval."
        headerAction={
          <Button
            variant="outlined" startIcon={<CloudUploadOutlinedIcon />}
            onClick={() => setImportOpen(true)}
            sx={{ textTransform: 'none' }}
          >
            Import from CSV / Excel
          </Button>
        }
        methods={methods}
        onSubmit={submit}
        onReset={reset}
        submitting={submitting}
        toast={toast} onToastClose={() => setToast(null)}
      >
        <PmuSection first title="BDSP identity">
          <FieldRow>
            <FieldCell span={{ xs: 12, md: 6 }}>
              <RhfTextField name="name" fullWidth required label="Name of BDSP" rules={REQUIRED_TEXT} />
            </FieldCell>
            <FieldCell span={{ xs: 12, md: 6 }}>
              <RhfTextField name="theme" fullWidth required label="Theme" rules={REQUIRED_TEXT} />
            </FieldCell>
            <FieldCell>
              <RhfTextField
                name="rationale" fullWidth required multiline minRows={2}
                label="Rationale for onboarding BDSP"
                rules={REQUIRED_TEXT}
              />
            </FieldCell>
            <FieldCell>
              <RhfTextField
                name="area" fullWidth required label="Area of service / expertise"
                rules={REQUIRED_TEXT}
              />
            </FieldCell>
          </FieldRow>
        </PmuSection>

        <PmuSection title="Location">
          <FieldRow>
            <FieldCell span={{ xs: 12, md: 6 }}>
              <StateSelect />
            </FieldCell>
            <FieldCell span={{ xs: 12, md: 6 }}>
              <DistrictSelect />
            </FieldCell>
          </FieldRow>
        </PmuSection>

        <PmuSection title="Contact & KYC">
          <FieldRow>
            <FieldCell span={{ xs: 12, md: 6 }}>
              <RhfTextField
                name="contact" fullWidth required label="Contact"
                placeholder="+91 98xxxxxxxx"
                rules={{
                  validate: (v) => {
                    const s = String(v || '').trim()
                    if (!s) return 'Required.'
                    if (!PHONE_RE.test(s)) return 'Enter a valid phone number.'
                    return true
                  },
                }}
              />
            </FieldCell>
            <FieldCell span={{ xs: 12, md: 6 }}>
              <RhfTextField
                name="email" fullWidth required type="email" label="Email"
                placeholder="bdsp@example.com"
                rules={{
                  validate: (v) => {
                    const s = String(v || '').trim()
                    if (!s) return 'Required.'
                    if (!EMAIL_RE.test(s)) return 'Enter a valid email address.'
                    return true
                  },
                }}
              />
            </FieldCell>
            <FieldCell>
              <RhfTextField
                name="kyc" fullWidth required multiline minRows={2} label="KYC"
                placeholder="PAN / Aadhaar / GSTIN, or any KYC identifier"
                rules={REQUIRED_TEXT}
              />
            </FieldCell>
          </FieldRow>
        </PmuSection>
      </PmuFormShell>

      <Dialog open={importOpen} onClose={() => { setImportOpen(false); setImportFile(null) }} maxWidth="sm" fullWidth>
        <DialogTitle>Import BDSPs</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Upload a CSV or Excel file. Each row becomes one BDSP entry and is sent to the SIDBI HO Checker for approval individually.
          </DialogContentText>
          <Alert severity="info" sx={{ mb: 2 }}>
            Columns expected (in order): {CSV_TEMPLATE_HEADERS.join(', ')}
          </Alert>
          <Divider sx={{ my: 2 }} />
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" gap={1}>
            <Button variant="outlined" startIcon={<CloudUploadOutlinedIcon />} onClick={() => importRef.current?.click()} sx={{ textTransform: 'none' }}>
              {importFile ? 'Replace file' : 'Choose file'}
            </Button>
            <input ref={importRef} type="file" hidden accept={IMPORT_ACCEPT} onChange={onPickImport} />
            <Button variant="text" startIcon={<FileDownloadOutlinedIcon />} onClick={downloadTemplate} sx={{ textTransform: 'none' }}>
              Download template
            </Button>
          </Stack>
          {importFile && (
            <Chip
              sx={{ mt: 2, maxWidth: '100%' }}
              label={`${importFile.name} · ${formatFileSize(importFile.size)}`}
              onDelete={() => setImportFile(null)}
              deleteIcon={<CloseRoundedIcon />}
              variant="outlined"
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setImportOpen(false); setImportFile(null) }} disabled={importing}>Cancel</Button>
          <Button variant="contained" onClick={confirmImport} disabled={!importFile || importing}>
            {importing ? 'Importing…' : 'Import'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

const REQUIRED_TEXT = { validate: (v) => (String(v || '').trim() ? true : 'Required.') }

// ─── State + district cascade ─────────────────────────────────────────────
// Matches the IA registration form: State drives the District options,
// and picking a new state clears the previously-selected district so a
// stale value can't sneak through submit.
//
// Both selects subscribe only to their own field paths — `useWatch({ name: 'state' })`
// inside DistrictSelect is a single-value subscription, so typing in an
// unrelated field never re-renders either dropdown.
function StateSelect() {
  return (
    <RhfTextField name="state" select fullWidth required label="State" rules={REQUIRED_TEXT}>
      <MenuItem value=""><em>— Select —</em></MenuItem>
      {STATES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
    </RhfTextField>
  )
}

function DistrictSelect() {
  const state = useWatch({ name: 'state' })
  const { setValue } = useFormContext()
  const districts = useMemo(() => districtsOf(state), [state])

  // If the current state's district list no longer contains the picked
  // district (e.g. after switching states), reset it. `shouldValidate:
  // false` so we don't fire an error immediately on reset.
  const districtValue = useWatch({ name: 'district' })
  const stale = districtValue && !districts.includes(districtValue)
  useEffect(() => {
    if (stale) setValue('district', '', { shouldValidate: false, shouldDirty: false })
  }, [stale, setValue])

  return (
    <RhfTextField
      name="district"
      select fullWidth required
      label="District"
      rules={REQUIRED_TEXT}
      disabled={!state}
      helperText={!state ? 'Pick a state first' : undefined}
    >
      <MenuItem value=""><em>— Select —</em></MenuItem>
      {districts.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
    </RhfTextField>
  )
}
