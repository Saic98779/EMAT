import { useCallback, useMemo, useState } from 'react'
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
import {
  usePincodeDistricts, usePincodeStates,
  useIAs, useUsersByRole,
} from '../../queries'
import { formatUser } from '../../apis/users'

// Sub-stages an IA can sit at once it's past In-Principle (L1) approval.
// The BSE proposal form lets GT link the candidate to any post-L1 IA
// regardless of where it currently sits in the L2 / documentation
// chain.
//
// UAT 2026-09-30 — earlier we fanned out to `/registrations/stage/{id}`
// once per sub-stage (12 parallel calls, doubled by React Strict Mode).
// That storm slowed the page AND thrashed the schema options as each
// query resolved in turn, which caused the IA dropdown to reset its
// selection whenever the user clicked (FormRenderer nulls `selVal` when
// the picked option briefly disappears from the option list). Switched
// to a single `useIAs()` fetch + client-side filter — one HTTP round
// trip, one stable option list, dropdown selection sticks.
// Backend sometimes emits `currentStage` as "STAGE.SUB_STAGE" and
// sometimes as the bare "SUB_STAGE" enum; strip the dotted prefix so
// downstream `BSE_ELIGIBLE_SUBSTAGES.has(...)` matches either shape.
// Mirrors `stripStagePrefix` in apis/industryAssociations.js — kept
// locally so BseCandidate doesn't have to import from an internal.
const stripStageDot = (raw) => {
  if (!raw || typeof raw !== 'string') return raw
  const dot = raw.indexOf('.')
  return dot >= 0 ? raw.slice(dot + 1) : raw
}

const BSE_ELIGIBLE_SUBSTAGES = new Set([
  'IN_PRINCIPLE_APPROVAL_OF_IA_SDE_APPROVAL',
  'SUSTAINABILITY_MATRIX_SUBMITTED',
  'SUSTAINABILITY_MATRIX_APPROVED',
  'SUSTAINABILITY_MATRIX_AND_ACTION_PLAN_COMPLETED',
  'ACTION_PLAN_SUBMITTED',
  'CLUSTER_EXPERT_APPROVED',
  'DETAILED_APPRAISAL_SUBMITTED',
  'DETAILED_APPRAISAL_APPROVAL_BY_SDE',
  'DETAILED_APPRAISAL_CE_COMMENTS_SUBMITTED',
  'DETAILED_APPRAISAL_APPROVAL_BY_HO_MAKER',
  'DETAILED_APPRAISAL_APPROVAL_BY_HO_CHECKER',
  'DOCUMENTATION_OF_IA',
])

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
  const { addBseCandidate } = useData()
  const [values, setValues] = useState({})
  const [toast, setToast] = useState({ severity: '', msg: '' })
  const [busy, setBusy] = useState(false)
  const [showAllErrors, setShowAllErrors] = useState(false)
  const setValue = useCallback((name, v) => setValues((p) => {
    // Cascade: clear the dependent district whenever state changes so
    // a stale district (from the old state's list) doesn't ride the
    // submit if the user hasn't re-picked yet.
    if (name === 'state' && p.state !== v) return { ...p, state: v, district: '' }
    return { ...p, [name]: v }
  }), [])

  // Only IAs whose In-Principle Approval is cleared (any post-L1 stage)
  // are eligible for BSE proposal. Single `useIAs()` fetch + client-side
  // `currentStage` filter — see the comment above the substage set for
  // why we moved off `useRegistrationsByStages`. The returned rows are
  // already the wrapped shape from `useIAs` (`{ id, name, raw, … }`),
  // so we normalise from `.raw` where the underlying DTO fields live.
  const iasQ = useIAs()
  const approvedIAs = useMemo(() => {
    const rows = iasQ.data || []
    return rows
      .filter((r) => {
        if (!r || r.id == null) return false
        // Two-track eligibility, matching what `iaFromDto` calls L1-cleared:
        //   1. `currentStage` sits in one of the post-L1 sub-stages (new
        //      workflow, backend keeps this in sync).
        //   2. Legacy fallback — record predates the sub-stage tracking
        //      but carries the old boolean `isSidbeApproved = true`.
        //      Without this fallback, IAs that were L1-approved before
        //      the stage column was added silently drop out of the
        //      dropdown even though the server-side by-stage endpoint
        //      (the old fetch path) would have surfaced them.
        const stage = r.currentStage || stripStageDot(r.raw?.currentStage)
        if (stage && BSE_ELIGIBLE_SUBSTAGES.has(stage)) return true
        if (r.raw?.isSidbeApproved === true) return true
        return false
      })
      .map((r) => ({
        id: r.id,
        name: r.raw?.industryAssociationName || r.name || String(r.id),
        state: r.raw?.state || r.state || '',
        district: r.raw?.district || r.district || '',
        raw: r.raw || r,
      }))
    // Stable key so a re-fetch returning the same rows doesn't spawn a
    // fresh reference and thrash the schema/dropdown option identity.
    // Includes both the sub-stage (new workflow) and the legacy
    // `isSidbeApproved` flag so either signal changing forces a rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(iasQ.data || []).map((r) => `${r?.id}:${r?.currentStage || r?.raw?.currentStage || ''}:${r?.raw?.isSidbeApproved ? 'A' : '_'}`).join('|')])

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

  // State / district picker options — backed by the /pincodes master
  // (client UAT 2026-09-28). One call each, cached forever. District
  // list refetches when state changes; the cascade in setValue below
  // clears district when state flips so a stale value can't slip
  // through.
  const statesQ = usePincodeStates()
  const districtsQ = usePincodeDistricts(values.state)
  // Content-based memoisation — a React Query refetch that returns the
  // same list still hands us a fresh array reference, and that fresh
  // reference would cascade into `schema` regeneration → SectionCard
  // re-render → MUI Select occasionally losing an in-flight click on
  // the IA dropdown. Comparing the joined content keeps `stateOptions`
  // / `districtOptions` reference-stable across refetches with identical
  // data, so the schema regenerates only when the actual option set
  // changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stateOptions = useMemo(() => statesQ.data || [], [(statesQ.data || []).join('|')])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const districtOptions = useMemo(() => districtsQ.data || [], [(districtsQ.data || []).join('|')])

  const schema = useMemo(
    // Pass the full `{ id, name }` objects — the schema factory builds
    // its Select options as `{ value: id, label: name }` so duplicate IA
    // names stay individually selectable (see the comment on the
    // ia_name field in makeBseCandidateSchema).
    () => makeBseCandidateSchema(
      approvedIAs,
      vendorOptions,
      { states: stateOptions, districts: districtOptions },
    ),
    [approvedIAs, vendorOptions, stateOptions, districtOptions],
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

    // `values.ia_name` now carries the IA's registrationId (as string —
    // the select stores option `value`, which we built as `String(ia.id)`
    // in the schema factory). Resolve the wrapped IA record for the name
    // + downstream reference.
    const ia = approvedIAs.find((i) => String(i.id) === String(values.ia_name))
    if (!ia?.id) {
      setToast({ severity: 'error', msg: 'Selected IA is missing a registration reference. Refresh and try again.' })
      return
    }

    setBusy(true)
    try {
      const created = await createBseRecommendation(values, ia.id)
      const bseId = created?.id

      // Upload every picked file (resume, salary proof, resignation letter,
      // CV, etc.) in a single batch keyed by the new BSE record's id.
      // Filenames are slug-prefixed with the field name so DocUpload can
      // decode them into "Salary proof · payslip.pdf" style chips later.
      const files = collectFiles(values)
      if (bseId && files.length) {
        try {
          const tagged = files.map(({ file, slug }) => encodeFilename(file, slug))
          await uploadFilesBatch(bseId, 'bse', bseId, tagged)
        } catch (fileErr) {
          setToast({
            severity: 'warning',
            msg: `Candidate saved, but file upload failed (${fileErr.message || 'unknown error'}). Retry from the candidate page.`,
          })
          addBseCandidate(values)
          const nextPath = bseId ? `/gt/team/${bseId}` : '/gt/team'
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
          : `${values.bse_name || 'Candidate'} proposed for ${ia.name || 'IA'}.`,
      })
      const nextPath = bseId ? `/gt/team/${bseId}` : '/gt/team'
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
        autoHideDuration={5000}
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
