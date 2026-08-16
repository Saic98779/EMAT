import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Box, Typography, Button, Snackbar, Alert, Chip, Paper, CircularProgress, Stack } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EastIcon from '@mui/icons-material/East'
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import FormRenderer, { fieldError } from '../../components/FormRenderer'
import EligibilityMatrixModal from '../../components/EligibilityMatrixModal'
import { makeInPrincipleSchema } from '../../formSchemas'
import {
  createIndustryAssociation,
  toFormValues as iaToFormValues,
} from '../../apis/industryAssociations'
import { uploadFilesBatch } from '../../apis/files'
import { encodeFilename } from '../../fileFieldLabels'
import {
  useBranchesByState, useSdesByBranch, useIA, useUpdateIA, useApproveIA, keys,
} from '../../queries'
import { useAuth } from '../../auth'

// Two modes:
//   • Create  (`/gt/ias/new`)      — POST a fresh IA (rare now that the
//                                    eligibility flow creates the record).
//   • Complete (`/gt/ias/:id/in-principle`) — hydrate an existing IA that
//                                    was created by the eligibility matrix
//                                    step, then PUT-merge the additions.
// Fields already captured by the matrix header (state, IA name, PAN,
// email) are seeded and rendered read-only in complete mode.

const HEADER_FIELDS_LOCKED_IN_COMPLETE_MODE = new Set([
  'ia_name', 'state', 'pan_no', 'email',
])

// First unmet requirement (missing required field or a validation error), if
// any. Whitespace-only strings count as empty.
function firstProblem(schema, values) {
  for (const sec of schema.sections) {
    for (const f of sec.fields) {
      if (f.showIf && !f.showIf(values)) continue
      const v = values[f.name]
      const filled = Array.isArray(v)
        ? v.length > 0
        : (typeof v === 'string' ? v.trim() !== '' : v != null && v !== '')
      if (f.required && !filled) return `${sec.title}: “${f.label}” is required`
      const err = fieldError(f, v, values)
      if (err) return `${sec.title}: ${f.label} — ${err}`
    }
  }
  return null
}

export default function InPrincipleApproval() {
  const navigate = useNavigate()
  const { id: routeUuid } = useParams()
  const isCompleteMode = !!routeUuid
  const qc = useQueryClient()
  const { user, role } = useAuth()

  // Per workflow: SDE-initiated In-Principle records are auto-approved
  // (no separate SDE review step needed). We chain POST create + PATCH
  // approve — the /approve endpoint is server-side role-gated to
  // SIDBI_SDE so we can't accidentally auto-approve as another role even
  // if this branch fires.
  const isSdeActor = role === 'sde'
  // Where "back" / "cancel" go — SDE stays in the SDE workspace, GT stays
  // in the GT workspace. Computed early so the loading/error guards below
  // can reference it.
  const iaListPath = isSdeActor ? '/sde/ias' : '/gt/ias'

  const [values, setValues] = useState({})
  const [toast, setToast] = useState({ severity: '', msg: '' })
  const [busy, setBusy] = useState(false)
  const [showAllErrors, setShowAllErrors] = useState(false)
  const [matrixOpen, setMatrixOpen] = useState(false)

  // Fetch the existing IA in complete mode. Only fires when we have a uuid.
  const iaQ = useIA(routeUuid, { enabled: isCompleteMode })

  // Seed form once the DTO arrives. `iaToFormValues` maps backend keys to
  // the snake-cased form field names this schema expects (email, pan_no,
  // state, ia_name, constitution_type, apex_* …).
  const seededRef = useRef(false)
  useEffect(() => {
    if (!isCompleteMode || seededRef.current) return
    const dto = iaQ.data?.raw
    if (!dto) return
    setValues(iaToFormValues(dto))
    seededRef.current = true
  }, [isCompleteMode, iaQ.data])

  const updateM = useUpdateIA()
  const approveM = useApproveIA()

  // Cascade: when `state` changes we reset the dependent branch + SDE fields
  // so stale UUIDs don't accidentally submit. Handled inline in setValue.
  const setValue = useCallback((name, v) => {
    // In complete mode the four header fields are locked; ignore any writes.
    if (isCompleteMode && HEADER_FIELDS_LOCKED_IN_COMPLETE_MODE.has(name)) return
    setValues((prev) => {
      if (name === 'state') return { ...prev, state: v, sidbi_branch: '', select_sde: '' }
      if (name === 'sidbi_branch') return { ...prev, sidbi_branch: v, select_sde: '' }
      return { ...prev, [name]: v }
    })
  }, [isCompleteMode])

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

  // In complete mode we walk the schema and mark the four header fields
  // read-only. Also drop `required` on them so the "missing field" check
  // doesn't complain if the DTO ever came back with a null (defensive —
  // shouldn't happen since eligibility mandates them).
  const schema = useMemo(() => {
    const base = makeInPrincipleSchema({ branchOptions, sdeOptions, branchHelp, sdeHelp })
    if (!isCompleteMode) return base
    return {
      ...base,
      sections: base.sections.map((sec) => ({
        ...sec,
        fields: sec.fields.map((f) => (
          HEADER_FIELDS_LOCKED_IN_COMPLETE_MODE.has(f.name)
            ? { ...f, readOnly: true, required: false, help: 'Captured on the eligibility matrix — read-only here.' }
            : f
        )),
      })),
    }
  }, [branchOptions, sdeOptions, branchHelp, sdeHelp, isCompleteMode])

  const prevOptionsHash = useRef('')
  useEffect(() => {
    const hash = `${branchOptions.length}:${sdeOptions.length}`
    prevOptionsHash.current = hash
  }, [branchOptions, sdeOptions])

  const collectFiles = () => {
    const out = []
    for (const [name, v] of Object.entries(values)) {
      if (!Array.isArray(v)) continue
      for (const item of v) if (item instanceof File) out.push({ file: item, slug: name })
    }
    return out
  }

  const submit = async () => {
    if (busy) return
    const problem = firstProblem(schema, values)
    if (problem) {
      setShowAllErrors(true)
      setToast({ severity: 'warning', msg: 'Please fix the highlighted fields.' })
      return
    }
    setBusy(true)
    try {
      let regUuid = routeUuid

      if (isCompleteMode) {
        // PUT-merge into the existing IA. Backend confirmed to merge non-
        // null fields (see manual smoke test 2026-08-16), so sending the
        // full form values is safe — the four header fields are echoed
        // back unchanged.
        await updateM.mutateAsync({
          uuid: routeUuid,
          values,
          extra: { updatedBy: user?.username },
        })
      } else {
        const created = await createIndustryAssociation(values)
        regUuid = created?.uuid
      }

      // ── SDE-initiated auto-approval ──
      // Chain PATCH /approve so the record moves straight to L1-approved.
      // The endpoint is server-side role-gated to SIDBI_SDE; if a non-SDE
      // user ever lands here the call 403s and we surface a warning
      // instead of silently leaving the record un-approved.
      let autoApproved = false
      if (isSdeActor && regUuid) {
        try {
          await approveM.mutateAsync({ uuid: regUuid, isSidbeApproved: true })
          autoApproved = true
        } catch (err) {
          setToast({
            severity: 'warning',
            msg: `IA saved but auto-approve failed (${err.message || 'unknown error'}). Approve from the queue.`,
          })
        }
      }

      const files = collectFiles()
      if (regUuid && files.length) {
        const tagged = files.map(({ file, slug }) => encodeFilename(file, slug))
        try {
          await uploadFilesBatch(regUuid, tagged)
          setToast({ severity: 'success', msg: `${values.ia_name || 'IA'} saved — ${files.length} file${files.length === 1 ? '' : 's'} uploaded${autoApproved ? ' and auto-approved' : ''}.` })
        } catch (err) {
          setToast({
            severity: 'warning',
            msg: `IA saved. File upload failed (${err.message || 'unknown error'}). Retry from the IA page.`,
          })
        }
      } else if (!isSdeActor || autoApproved) {
        setToast({
          severity: 'success',
          msg: isCompleteMode
            ? `${values.ia_name || 'IA'} — In-Principle profile submitted${autoApproved ? ' and auto-approved (SDE)' : ' for SDE review'}.`
            : autoApproved
              ? `${values.ia_name || 'New IA'} created and auto-approved (SDE-initiated).`
              : `${values.ia_name || 'New IA'} added to the onboarding pipeline.`,
        })
      }

      qc.invalidateQueries({ queryKey: keys.ias.lists() })
      if (regUuid) qc.invalidateQueries({ queryKey: keys.ias.detail(regUuid) })
      // SDE flows land back in the SDE IA workspace; GT flows in the GT one.
      const nextPath = regUuid ? `${iaListPath}/${regUuid}` : iaListPath
      setTimeout(() => navigate(nextPath), 900)
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Failed to submit. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  // Loading state: waiting for the IA fetch in complete mode.
  if (isCompleteMode && iaQ.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  }
  if (isCompleteMode && iaQ.error) {
    return (
      <Box sx={{ maxWidth: 940, mx: 'auto' }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(iaListPath)} sx={{ mb: 2 }}>Back</Button>
        <Alert severity="error">{iaQ.error.message || 'Failed to load IA'}</Alert>
      </Box>
    )
  }

  const submitLabel = busy
    ? 'Submitting…'
    : isSdeActor
      ? 'Create & Auto-Approve'
      : isCompleteMode
        ? 'Submit for SDE Review'
        : 'Submit for Review'

  return (
    <Box sx={{ maxWidth: 940, mx: 'auto', pb: 9 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(iaListPath)}>IA Onboarding</Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AssessmentOutlinedIcon />}
          onClick={() => setMatrixOpen(true)}
          sx={{ textTransform: 'none' }}
          disabled={!routeUuid}  // no matrix to view until the IA exists
        >
          View Eligibility Matrix
        </Button>
      </Stack>

      <Box textAlign="center" mb={3}>
        <Chip
          label={isSdeActor ? 'Level 1 · Auto-Approved on Submit' : 'Level 1 · In-Principle Approval'}
          sx={{
            bgcolor: isSdeActor ? 'success.light' : 'primary.light',
            color: isSdeActor ? 'success.dark' : 'primary.dark',
            mb: 1.5, fontWeight: 700,
          }}
        />
        <Typography variant="h4">In-Principle Approval</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 620, mx: 'auto' }}>
          {isSdeActor
            ? 'Capture the Industry Association profile. On submit the record is created and auto-approved (SDE-initiated flow — no separate review step).'
            : isCompleteMode
              ? `Complete the ${values.ia_name || 'IA'} profile. Header fields (name, state, PAN, email) were captured on the eligibility matrix and are locked here.`
              : 'Capture the Industry Association profile. On submit, it enters the pipeline and goes to the SIDBI SDE for review.'}
        </Typography>
      </Box>

      <FormRenderer schema={schema} accent="primary" values={values} setValue={setValue} showAllErrors={showAllErrors} />

      <EligibilityMatrixModal
        open={matrixOpen}
        onClose={() => setMatrixOpen(false)}
        registrationUuid={routeUuid}
      />

      <Paper elevation={3} sx={{ position: 'sticky', bottom: 16, mt: 3, p: 1.5, borderRadius: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
        <Button color="inherit" onClick={() => navigate(iaListPath)} disabled={busy}>Cancel</Button>
        <Button
          variant="contained"
          endIcon={busy ? <CircularProgress size={16} color="inherit" /> : <EastIcon />}
          onClick={submit}
          disabled={busy}
        >
          {submitLabel}
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
