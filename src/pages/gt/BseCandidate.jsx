import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button, Snackbar, Alert, Chip, Paper, CircularProgress } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EastIcon from '@mui/icons-material/East'
import FormRenderer, { fieldError } from '../../components/FormRenderer'
import { makeBseCandidateSchema } from '../../formSchemas'
import { createBseRecommendation } from '../../apis/bseRecommendations'
import { uploadFilesBatch } from '../../apis/files'
import { encodeFilename } from '../../fileFieldLabels'
import { useData } from '../../store'
import { useUsersByRole } from '../../queries'
import { formatUser } from '../../apis/users'

// Every File instance picked across all file-typed fields, tagged with the
// field name so DocUpload can later show which slot each file came from.
function collectFiles(values) {
  const out = []
  for (const [name, v] of Object.entries(values)) {
    if (!Array.isArray(v)) continue
    for (const item of v) if (item instanceof File) out.push({ file: item, slug: name })
  }
  return out
}

// First unmet requirement (missing required field or a validation error), if any.
function firstProblem(schema, values) {
  for (const sec of schema.sections) {
    for (const f of sec.fields) {
      if (f.showIf && !f.showIf(values)) continue
      const v = values[f.name]
      const filled = Array.isArray(v) ? v.length > 0 : v != null && v !== ''
      if (f.required && !filled) return `${sec.title}: “${f.label}” is required`
      const err = fieldError(f, v, values)
      if (err) return `${sec.title}: ${f.label} — ${err}`
    }
  }
  return null
}

export default function BseCandidate() {
  const navigate = useNavigate()
  const { ias, refreshIAs, addBseCandidate } = useData()
  const [values, setValues] = useState({})
  const [toast, setToast] = useState({ severity: '', msg: '' })
  const [busy, setBusy] = useState(false)
  const [showAllErrors, setShowAllErrors] = useState(false)
  const setValue = useCallback((name, v) => setValues((p) => ({ ...p, [name]: v })), [])

  // The IA list is loaded lazily by the `/gt/ias` page — refetch here so this
  // page works when opened directly (deep link / navigation from dashboard).
  useEffect(() => {
    const ctrl = new AbortController()
    refreshIAs({ signal: ctrl.signal })
    return () => ctrl.abort()
  }, [refreshIAs])

  // Only IAs whose In-Principle Approval is cleared (stage >= 1) are eligible,
  // and only records that carry a backend `uuid` — we can't POST without one.
  const approvedIAs = useMemo(
    () => ias.filter((i) => (i.stage ?? 0) >= 1 && i.uuid),
    [ias],
  )

  // "Offer Letter Vendor" dropdown — now sourced from user accounts with role
  // `MANPOWER_AGENCY` (via GET /users/by-role) rather than the standalone
  // `vendor` table. Backend has consolidated the notion of a vendor onto the
  // user record for BSE-assignment purposes.
  //
  // Value = user.id (backend expects the linked-user id in `vendorUuid`).
  // Label = "First Last — District, State" via `formatUser`.
  const vendorsQ = useUsersByRole('MANPOWER_AGENCY')
  const vendorOptions = useMemo(
    () => (vendorsQ.data || []).map((u) => ({ value: String(u.id), label: formatUser(u) })),
    [vendorsQ.data],
  )

  const schema = useMemo(
    () => makeBseCandidateSchema(approvedIAs.map((i) => i.name), vendorOptions),
    [approvedIAs, vendorOptions],
  )

  const submit = async () => {
    if (busy) return
    if (approvedIAs.length === 0) {
      setToast({ severity: 'warning', msg: 'No In-Principle approved IA is available yet. Approve an IA before proposing a BSE.' })
      return
    }
    const problem = firstProblem(schema, values)
    if (problem) {
      setShowAllErrors(true)
      setToast({ severity: 'warning', msg: 'Please fix the highlighted fields.' })
      return
    }

    // Backend expects the IA's registrationUuid, but the form only carries the
    // display name — resolve it from the approved IA list.
    const ia = approvedIAs.find((i) => i.name === values.ia_name)
    if (!ia?.uuid) {
      setToast({ severity: 'error', msg: 'Selected IA is missing a registration reference. Refresh and try again.' })
      return
    }

    setBusy(true)
    try {
      const created = await createBseRecommendation(values, ia.uuid)
      const bseUuid = created?.uuid

      // Upload every picked file (resume, salary proof, resignation letter,
      // CV, etc.) in a single batch keyed by the new BSE record's UUID.
      // Filenames are slug-prefixed with the field name so DocUpload can
      // decode them into "Salary proof · payslip.pdf" style chips later.
      const files = collectFiles(values)
      if (bseUuid && files.length) {
        try {
          const tagged = files.map(({ file, slug }) => encodeFilename(file, slug))
          await uploadFilesBatch(bseUuid, tagged)
        } catch (fileErr) {
          setToast({
            severity: 'warning',
            msg: `Candidate saved, but file upload failed (${fileErr.message || 'unknown error'}). Retry from the candidate page.`,
          })
          addBseCandidate(values)
          const nextPath = bseUuid ? `/gt/team/${bseUuid}` : '/gt/team'
          setTimeout(() => navigate(nextPath), 1500)
          return
        }
      }

      // Keep the local store in sync so the BSE Team page reflects the new candidate.
      addBseCandidate(values)
      setToast({
        severity: 'success',
        msg: files.length
          ? `${values.bse_name || 'Candidate'} proposed — ${files.length} file${files.length === 1 ? '' : 's'} uploaded.`
          : `${values.bse_name || 'Candidate'} proposed for ${values.ia_name || 'IA'}.`,
      })
      const nextPath = bseUuid ? `/gt/team/${bseUuid}` : '/gt/team'
      setTimeout(() => navigate(nextPath), 1100)
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Failed to submit. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 940, mx: 'auto', pb: 9 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/gt/team')} sx={{ mb: 2 }}>BSE Team</Button>
      <Box textAlign="center" mb={3}>
        <Chip label="BSE Onboarding · Candidate Proposal" sx={{ bgcolor: 'primary.light', color: 'primary.dark', mb: 1.5, fontWeight: 700 }} />
        <Typography variant="h4">Propose a BSE Candidate</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 640, mx: 'auto' }}>
          To be filled by GT Field Manager. Captures candidate profile, salary expectations, documents and your recommendation for the selected Industry Association.
        </Typography>
      </Box>

      <FormRenderer schema={schema} accent="primary" values={values} setValue={setValue} showAllErrors={showAllErrors} />

      <Paper elevation={3} sx={{ position: 'sticky', bottom: 16, mt: 3, p: 1.5, borderRadius: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
        <Button color="inherit" onClick={() => navigate('/gt/team')} disabled={busy}>Cancel</Button>
        <Button
          variant="contained"
          endIcon={busy ? <CircularProgress size={16} color="inherit" /> : <EastIcon />}
          onClick={submit}
          disabled={busy}
        >
          {busy ? 'Submitting…' : 'Submit Proposal'}
        </Button>
      </Paper>

      <Snackbar
        open={!!toast.msg}
        autoHideDuration={3500}
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
