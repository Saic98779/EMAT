import { useDeferredValue, useMemo, useRef, useState } from 'react'
import {
  Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText,
  DialogTitle, Divider, Stack,
} from '@mui/material'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import {
  PmuFormShell, PmuSection, FieldRow, FieldCell,
  formatFileSize, EMAIL_RE, PHONE_RE,
  FormTextField, useFieldHandlers,
} from './_shared'
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

const REQUIRED = ['name', 'rationale', 'theme', 'area', 'state', 'district', 'contact', 'email', 'kyc']

const INITIAL = {
  name: '', rationale: '', theme: '', area: '',
  state: '', district: '',
  contact: '', email: '', kyc: '',
}

export default function DiaBdspOnboarding() {
  const [values, setValues] = useState(INITIAL)
  const [touched, setTouched] = useState({})
  const [showAllErrors, setShowAllErrors] = useState(false)
  const [toast, setToast] = useState(null)

  const [submitting, setSubmitting] = useState(false)

  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const importRef = useRef(null)

  const { set, blur } = useFieldHandlers(setValues, setTouched)
  // Defer validation so keystrokes stay snappy — see 3C form for rationale.
  const deferredValues = useDeferredValue(values)
  const errors = useMemo(() => validate(deferredValues), [deferredValues])
  const errFor = (name) => (showAllErrors || touched[name]) ? errors[name] : ''

  const reset = () => { setValues(INITIAL); setTouched({}); setShowAllErrors(false) }

  const submit = async (e) => {
    e.preventDefault()
    setShowAllErrors(true)
    if (Object.keys(errors).length > 0) {
      setToast({ severity: 'warning', msg: 'Please fix the highlighted fields.' })
      return
    }
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
      reset()
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Submit failed.' })
    } finally {
      setSubmitting(false)
    }
  }

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
      // Fallback: generate the CSV client-side if the backend template
      // endpoint hasn't been implemented yet or returned an error.
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
        onSubmit={submit} onReset={reset}
        submitting={submitting}
        toast={toast} onToastClose={() => setToast(null)}
      >
        <PmuSection first title="BDSP identity">
          <FieldRow>
            <FieldCell span={{ xs: 12, md: 6 }}>
              <FormTextField
                fullWidth required label="Name of BDSP"
                value={values.name} onChange={set('name')} onBlur={blur('name')}
                error={!!errFor('name')} helperText={errFor('name')}
              />
            </FieldCell>
            <FieldCell span={{ xs: 12, md: 6 }}>
              <FormTextField
                fullWidth required label="Theme"
                value={values.theme} onChange={set('theme')} onBlur={blur('theme')}
                error={!!errFor('theme')} helperText={errFor('theme')}
              />
            </FieldCell>
            <FieldCell>
              <FormTextField
                fullWidth required multiline minRows={2}
                label="Rationale for onboarding BDSP"
                value={values.rationale} onChange={set('rationale')} onBlur={blur('rationale')}
                error={!!errFor('rationale')} helperText={errFor('rationale')}
              />
            </FieldCell>
            <FieldCell>
              <FormTextField
                fullWidth required label="Area of service / expertise"
                value={values.area} onChange={set('area')} onBlur={blur('area')}
                error={!!errFor('area')} helperText={errFor('area')}
              />
            </FieldCell>
          </FieldRow>
        </PmuSection>

        <PmuSection title="Location">
          <FieldRow>
            <FieldCell span={{ xs: 12, md: 6 }}>
              <FormTextField
                fullWidth required label="State"
                value={values.state} onChange={set('state')} onBlur={blur('state')}
                error={!!errFor('state')} helperText={errFor('state')}
              />
            </FieldCell>
            <FieldCell span={{ xs: 12, md: 6 }}>
              <FormTextField
                fullWidth required label="District"
                value={values.district} onChange={set('district')} onBlur={blur('district')}
                error={!!errFor('district')} helperText={errFor('district')}
              />
            </FieldCell>
          </FieldRow>
        </PmuSection>

        <PmuSection title="Contact & KYC">
          <FieldRow>
            <FieldCell span={{ xs: 12, md: 6 }}>
              <FormTextField
                fullWidth required label="Contact"
                placeholder="+91 98xxxxxxxx"
                value={values.contact} onChange={set('contact')} onBlur={blur('contact')}
                error={!!errFor('contact')} helperText={errFor('contact')}
              />
            </FieldCell>
            <FieldCell span={{ xs: 12, md: 6 }}>
              <FormTextField
                fullWidth required type="email" label="Email"
                placeholder="bdsp@example.com"
                value={values.email} onChange={set('email')} onBlur={blur('email')}
                error={!!errFor('email')} helperText={errFor('email')}
              />
            </FieldCell>
            <FieldCell>
              <FormTextField
                fullWidth required multiline minRows={2} label="KYC"
                placeholder="PAN / Aadhaar / GSTIN, or any KYC identifier"
                value={values.kyc} onChange={set('kyc')} onBlur={blur('kyc')}
                error={!!errFor('kyc')} helperText={errFor('kyc')}
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

function validate(v) {
  const errs = {}
  for (const k of REQUIRED) if (!String(v[k] || '').trim()) errs[k] = 'Required.'
  if (v.email && !EMAIL_RE.test(v.email.trim())) errs.email = 'Enter a valid email address.'
  if (v.contact && !PHONE_RE.test(v.contact.trim())) errs.contact = 'Enter a valid phone number.'
  return errs
}
