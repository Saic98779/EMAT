import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Box, Typography, Button, Snackbar, Alert, Chip, Paper, CircularProgress,
  Stack, Card, CardContent, TextField, MenuItem, Autocomplete,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EastIcon from '@mui/icons-material/East'
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
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
  useBranchesByState, useSdesByBranch, useIA, useUpdateIA,
  useEligibilityRegistrationsDropdown, keys,
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
  const { id: routeId } = useParams()
  const isCompleteMode = !!routeId
  const qc = useQueryClient()
  const { user, role } = useAuth()

  // Per workflow: SDE-initiated In-Principle records are auto-approved
  // by the backend (role-based inference on POST — SIDBI_SDE gets
  // `isSidbeApproved=true` stamped server-side, other roles don't).
  // The client just POSTs like normal. `isSdeActor` here is UI-only —
  // used to route back to /sde on cancel/back and to tweak the button
  // label / subtitle. Whether the auto-approval actually happened is
  // read from the POST response's `isSidbeApproved` field.
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

  // ── Picker (create mode only) ────────────────────────────────────────────
  // Fetch the "IAs with an eligibility matrix on record" dropdown. GT / SDE
  // must pick from this list before starting In-Principle — a blank
  // registration isn't reachable anymore.
  const dropdownQ = useEligibilityRegistrationsDropdown({ enabled: !isCompleteMode })
  const [pickedId, setPickedId] = useState(null)
  const dropdownOptions = useMemo(() => dropdownQ.data || [], [dropdownQ.data])

  // One useIA call serves both modes. In complete mode it looks up the
  // route id (drives the form seed below). In picker mode it looks up
  // the picked id so we can preview the IA before committing.
  const lookupId = isCompleteMode ? routeId : pickedId
  const iaQ = useIA(lookupId, { enabled: !!lookupId })

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
    () => (branchesQ.data || []).map((b) => ({ value: b.id, label: b.branchName })),
    [branchesQ.data],
  )
  const sdeOptions = useMemo(
    () => (sdesQ.data || []).map((s) => ({ value: s.id, label: s.name })),
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
      let regId = routeId
      // `autoApproved` is *reported by the backend*, not decided here.
      // Backend inspects the caller's JWT: SIDBI_SDE → sets
      // `isSidbeApproved = true` + stamps `sidbeApprovedByUserId` on the
      // response. Any other role → leaves `isSidbeApproved` null. Client
      // does no chained PATCH and no role-based branching — the only
      // reason we still read the flag is to tune the success toast.
      let autoApproved = false

      if (isCompleteMode) {
        // PUT-merge into the existing IA. Backend merges non-null fields
        // (see manual smoke test 2026-08-16), so sending the full form
        // values is safe — the four header fields round-trip unchanged.
        const updated = await updateM.mutateAsync({
          id: routeId,
          values,
          extra: { updatedBy: user?.username },
        })
        autoApproved = updated?.isSidbeApproved === true
      } else {
        const created = await createIndustryAssociation(values)
        regId = created?.id
        autoApproved = created?.isSidbeApproved === true
      }

      const files = collectFiles()
      if (regId && files.length) {
        const tagged = files.map(({ file, slug }) => encodeFilename(file, slug))
        try {
          await uploadFilesBatch(regId, tagged)
          setToast({ severity: 'success', msg: `${values.ia_name || 'IA'} saved — ${files.length} file${files.length === 1 ? '' : 's'} uploaded${autoApproved ? ' and auto-approved' : ''}.` })
        } catch (err) {
          setToast({
            severity: 'warning',
            msg: `IA saved. File upload failed (${err.message || 'unknown error'}). Retry from the IA page.`,
          })
        }
      } else {
        setToast({
          severity: 'success',
          msg: isCompleteMode
            ? `${values.ia_name || 'IA'} — In-Principle profile submitted${autoApproved ? ' and auto-approved (SDE)' : ' for SDE review'}.`
            : autoApproved
              ? `${values.ia_name || 'New IA'} created and auto-approved (SDE-initiated).`
              : `${values.ia_name || 'New IA'} added to the onboarding pipeline.`,
        })
      }

      // `useIAs` has `refetchOnMount: false`, so plain invalidation only
      // marks the list stale — the user would still see the pre-submit
      // rows when they navigate back. `refetchType: 'all'` forces the
      // refetch now, even though the list query is currently inactive.
      qc.invalidateQueries({ queryKey: keys.ias.lists(), refetchType: 'all' })
      if (regId) qc.invalidateQueries({ queryKey: keys.ias.detail(regId), refetchType: 'all' })
      const nextPath = regId ? `${iaListPath}/${regId}` : iaListPath
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

  // ── Picker screen ────────────────────────────────────────────────────────
  // Not in complete mode → we haven't picked an IA yet. Show a dropdown of
  // IAs that already have an eligibility matrix; on continue we navigate
  // to the complete-mode route which hydrates the form with the picked
  // IA's fields.
  if (!isCompleteMode) {
    const previewIa = pickedId ? iaQ.data : null
    const previewRaw = previewIa?.raw
    const continueDisabled = !pickedId || iaQ.isLoading
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto', pb: 6 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(iaListPath)}>IA Onboarding</Button>
        </Stack>
        <Box textAlign="center" mb={3}>
          <Chip label="Level 1 · In-Principle Approval" sx={{ bgcolor: 'primary.light', color: 'primary.dark', mb: 1.5, fontWeight: 700 }} />
          <Typography variant="h4">Select an Industry Association</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 560, mx: 'auto' }}>
            Pick an IA that already has an eligibility matrix on record. Its
            name, PAN, email and state will be prefilled on the In-Principle
            form — you complete the rest of the profile there.
          </Typography>
        </Box>

        <Card>
          <CardContent sx={{ p: 3 }}>
            <Autocomplete
              options={dropdownOptions}
              loading={dropdownQ.isLoading}
              getOptionLabel={(o) => o?.name || ''}
              isOptionEqualToValue={(a, b) => a?.id === b?.id}
              value={dropdownOptions.find((o) => o.id === pickedId) || null}
              onChange={(_e, v) => setPickedId(v?.id || null)}
              renderInput={(params) => (
                <TextField {...params}
                  label="Eligibility-scored IA *"
                  placeholder={dropdownQ.isLoading ? 'Loading…' : 'Search by name…'}
                  helperText={
                    dropdownQ.error
                      ? (dropdownQ.error.message || 'Failed to load the IA list')
                      : dropdownOptions.length === 0 && !dropdownQ.isLoading
                        ? 'No IAs have an eligibility matrix yet. Start with the Eligibility Matrix.'
                        : 'Only IAs with an eligibility matrix are shown.'
                  }
                  error={!!dropdownQ.error}
                />
              )}
            />

            {previewRaw && (
              <Box sx={{
                mt: 3, p: 2, borderRadius: 1.5,
                border: '1px solid', borderColor: 'divider',
                bgcolor: 'action.hover',
              }}>
                <Typography variant="overline" color="text.secondary"
                  sx={{ letterSpacing: '0.14em', fontWeight: 700 }}>
                  Prefilled from Eligibility
                </Typography>
                <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                  <PreviewRow label="Name" value={previewRaw.industryAssociationName} />
                  <PreviewRow label="State" value={previewRaw.state} />
                  <PreviewRow label="PAN" value={previewRaw.panNo} mono />
                  <PreviewRow label="Email" value={previewRaw.email} mono />
                </Stack>
              </Box>
            )}

            {pickedId && iaQ.isLoading && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
                <CircularProgress size={14} />
                <Typography variant="caption" color="text.secondary">Loading IA details…</Typography>
              </Stack>
            )}

            <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 3 }}>
              <Button
                variant="outlined"
                startIcon={<FactCheckOutlinedIcon />}
                onClick={() => navigate(`${isSdeActor ? '/sde' : '/gt'}/eligibility/new`)}
                sx={{ textTransform: 'none' }}
              >
                Start with Eligibility Matrix
              </Button>
              <Button
                variant="contained"
                endIcon={<EastIcon />}
                onClick={() => navigate(`${iaListPath}/${pickedId}/in-principle`)}
                disabled={continueDisabled}
              >
                Continue
              </Button>
            </Stack>
          </CardContent>
        </Card>
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
          disabled={!routeId}  // no matrix to view until the IA exists
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
        registrationId={routeId}
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

// Compact "LABEL — value" line used in the picker's Prefilled-from-
// Eligibility preview. Falls back to em-dash when the value is null so
// the row always has consistent height.
function PreviewRow({ label, value, mono }) {
  const hasValue = value != null && value !== ''
  return (
    <Stack direction="row" spacing={1} alignItems="baseline">
      <Typography variant="caption" color="text.secondary"
        sx={{ letterSpacing: '0.06em', fontWeight: 700, textTransform: 'uppercase', minWidth: 56 }}>
        {label}
      </Typography>
      <Typography variant="body2"
        sx={{ color: hasValue ? 'text.primary' : 'text.disabled', fontWeight: hasValue ? 600 : 400,
              fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' : undefined }}>
        {hasValue ? value : '—'}
      </Typography>
    </Stack>
  )
}
