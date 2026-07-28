import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Box, Typography, Button, Snackbar, Alert, Chip, Paper, CircularProgress } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EastIcon from '@mui/icons-material/East'
import FormRenderer, { fieldError } from '../../components/FormRenderer'
import { makeInPrincipleSchema } from '../../formSchemas'
import { createIndustryAssociation } from '../../apis/industryAssociations'
import { uploadFile } from '../../apis/files'
import { useBranchesByState, useSdesByBranch, keys } from '../../queries'

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

export default function InPrincipleApproval() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [values, setValues] = useState({})
  const [toast, setToast] = useState({ severity: '', msg: '' })
  const [busy, setBusy] = useState(false)

  // Cascade: when `state` changes we reset the dependent branch + SDE fields
  // so stale UUIDs don't accidentally submit. Handled inline in setValue.
  const setValue = useCallback((name, v) => {
    setValues((prev) => {
      if (name === 'state') return { ...prev, state: v, sidbi_branch: '', select_sde: '' }
      if (name === 'sidbi_branch') return { ...prev, sidbi_branch: v, select_sde: '' }
      return { ...prev, [name]: v }
    })
  }, [])

  // Live dropdown data driven by the current state / branch selections.
  const branchesQ = useBranchesByState(values.state)
  const sdesQ = useSdesByBranch(values.sidbi_branch)

  const branchOptions = useMemo(
    () => (branchesQ.data || []).map((b) => ({ value: b.uuid, label: b.branchName })),
    [branchesQ.data],
  )
  const sdeOptions = useMemo(
    () => (sdesQ.data || []).map((s) => ({ value: s.uuid, label: s.name })),
    [sdesQ.data],
  )

  // Distinguish "field is disabled because prerequisite missing" from
  // "prerequisite picked but backend returned an empty list".
  const branchHelp = !values.state
    ? 'Pick a state first'
    : branchesQ.isFetching
      ? 'Loading branches…'
      : branchOptions.length === 0
        ? 'No SIDBI branches configured for this state yet.'
        : undefined
  const sdeHelp = !values.sidbi_branch
    ? 'Pick a SIDBI branch first'
    : sdesQ.isFetching
      ? 'Loading SDEs…'
      : sdeOptions.length === 0
        ? 'No SDEs posted at this branch yet.'
        : undefined

  const schema = useMemo(
    () => makeInPrincipleSchema({ branchOptions, sdeOptions, branchHelp, sdeHelp }),
    [branchOptions, sdeOptions, branchHelp, sdeHelp],
  )

  // If the currently-selected branch UUID isn't in the new branch list (because
  // the state changed and the cascade reset already fired, or the list finished
  // loading after the field), noop — the reset in setValue already handled it.
  // Same for SDE. Kept explicit as a safety net.
  const prevOptionsHash = useRef('')
  useEffect(() => {
    const hash = `${branchOptions.length}:${sdeOptions.length}`
    prevOptionsHash.current = hash
  }, [branchOptions, sdeOptions])

  // Collect every File instance picked across all file-typed fields.
  const collectFiles = () => {
    const out = []
    for (const v of Object.values(values)) {
      if (!Array.isArray(v)) continue
      for (const item of v) if (item instanceof File) out.push(item)
    }
    return out
  }

  const submit = async () => {
    if (busy) return
    const problem = firstProblem(schema, values)
    if (problem) { setToast({ severity: 'warning', msg: problem }); return }
    setBusy(true)
    try {
      const created = await createIndustryAssociation(values)
      const regUuid = created?.uuid

      // Upload picked files SEQUENTIALLY under the new registration's UUID.
      // Parallel POSTs to the same parent were producing partial failures
      // (backend serialises writes; duplicate filenames also collide).
      // Sequential is a few seconds slower but consistently succeeds.
      const files = collectFiles()
      if (regUuid && files.length) {
        const failures = []
        for (const f of files) {
          try { await uploadFile(regUuid, f) }
          catch (err) { failures.push({ name: f.name, msg: err.message || 'unknown error' }) }
        }
        if (failures.length) {
          const first = failures[0]
          setToast({
            severity: 'warning',
            msg: `IA created. ${failures.length} of ${files.length} file${files.length === 1 ? '' : 's'} failed (e.g. "${first.name}": ${first.msg}). Retry from the IA page.`,
          })
        } else {
          setToast({ severity: 'success', msg: `${values.ia_name || 'New IA'} added — ${files.length} file${files.length === 1 ? '' : 's'} uploaded.` })
        }
      } else {
        setToast({ severity: 'success', msg: `${values.ia_name || 'New IA'} added to the onboarding pipeline.` })
      }

      // Invalidate the shared IA cache so /gt/ias reflects the new record.
      qc.invalidateQueries({ queryKey: keys.ias.lists() })
      const nextPath = regUuid ? `/gt/ias/${regUuid}` : '/gt/ias'
      setTimeout(() => navigate(nextPath), 900)
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Failed to submit. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 940, mx: 'auto', pb: 9 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/gt/ias')} sx={{ mb: 2 }}>IA Onboarding</Button>
      <Box textAlign="center" mb={3}>
        <Chip label="Level 1 · In-Principle Approval" sx={{ bgcolor: 'primary.light', color: 'primary.dark', mb: 1.5, fontWeight: 700 }} />
        <Typography variant="h4">In-Principle Approval</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 620, mx: 'auto' }}>
          Capture the Industry Association profile. On submit, it enters the pipeline and goes to the SIDBI SDE for review.
        </Typography>
      </Box>

      <FormRenderer schema={schema} accent="primary" values={values} setValue={setValue} />

      <Paper elevation={3} sx={{ position: 'sticky', bottom: 16, mt: 3, p: 1.5, borderRadius: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
        <Button color="inherit" onClick={() => navigate('/gt/ias')} disabled={busy}>Cancel</Button>
        <Button
          variant="contained"
          endIcon={busy ? <CircularProgress size={16} color="inherit" /> : <EastIcon />}
          onClick={submit}
          disabled={busy}
        >
          {busy ? 'Submitting…' : 'Submit for Review'}
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
