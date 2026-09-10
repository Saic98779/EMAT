import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { keys, useAllStages, useUpdateIA } from '../../../../queries'
import { uploadFilesBatch } from '../../../../apis/files'
import { encodeFilename } from '../../../../fileFieldLabels'
import { useAuth } from '../../../../auth'
import { STAGE } from '../../../../apis/registrationStages'
import { stageIdForStage } from '../../../../apis/stageActions'
import { advanceIndustryAssociationStage } from '../../../../apis/industryAssociations'

// useRegistrationSubmit
// ────────────────────────────────────────────────────────────────────────
// Encapsulates the L1 submit flow so the tab component stays focused on
// layout + validation.
//
// Behaviour
//   1. PUT-merges form values into the existing IA registration (backend
//      merges non-null fields).
//   2. Collects any picked File objects from form state and posts them as
//      a batch to /files/{id}/batch, tagging each with its field-name slug
//      so the server-side file table remembers which slot the file came
//      from.
//   3. Invalidates the IA detail + list caches so the workspace tracker
//      picks up the new state immediately.
//   4. Navigates to the Sustainability tab on success (next stage).
//
// Returns
//   submit(values)   async — the caller invokes with the current form values
//   submitting       Boolean
//   toast            { severity, msg } | null   — surface via Snackbar
//   clearToast       () => void
export function useRegistrationSubmit({ iaId, basePath = '/gt' }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const updateM = useUpdateIA()
  const { user } = useAuth()
  // Master stage list — used to resolve the numeric `stageId` we need to
  // stamp on the PUT so the backend can advance `currentStage` and append
  // a history row. Cached for an hour by useAllStages, so this is free.
  const stagesQ = useAllStages()

  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  // Guard against concurrent double-submits (double-click, keyboard repeat).
  // The busy flag flips synchronously, but a stronger latch on a ref
  // guarantees a second call is a no-op even inside the same tick.
  const inflightRef = useRef(false)

  const submit = useCallback(async (values) => {
    if (!iaId) {
      setToast({ severity: 'error', msg: 'This IA does not have an id yet — reopen from the queue.' })
      return
    }
    if (inflightRef.current) return
    inflightRef.current = true
    setSubmitting(true)
    try {
      // Backend bug: a single PUT that carries both scalar field values
      // AND a `stageId` advances the stage but silently drops every
      // scalar field (updatedBy = SYSTEM, currentStage moves, but
      // constitutionType / district / apex / … all land as null).
      // Verified on IA 121 and IA 127. Workaround: split the submit
      // into two PUTs.
      //   1. Save the L1 form fields — no stageId in this body.
      //   2. Advance the workflow — stageId + comments only, no fields.
      // Backend treats field-omission as "leave unchanged" (merge, not
      // replace), so the fields we wrote in step 1 stay intact.
      const stageId = stageIdForStage(
        stagesQ.data,
        STAGE.IN_PRINCIPLE_APPROVAL_OF_IA,
        'IN_PRINCIPLE_APPROVAL_OF_IA_SUBMITTED',
      )
      const updated = await updateM.mutateAsync({
        id: iaId,
        values,                       // ← fields only, no stageId
        extra: { updatedBy: user?.username },
      })
      // Second PUT — stage advance only. Bypasses `toPayload` because
      // that adapter fills every scalar with `null` when omitted from
      // the input; sending 40 explicit nulls alongside stageId would
      // either trip the same field-drop bug or actively clear the
      // fields we just saved. This helper sends ONLY {stageId,
      // stageComments} and lets the backend's merge semantics preserve
      // everything else.
      if (stageId != null) {
        await advanceIndustryAssociationStage(iaId, {
          stageId,
          stageComments: 'GT submitting for L1 review',
        })
      }
      const autoApproved = updated?.isSidbeApproved === true

      const files = collectFiles(values)
      if (files.length) {
        const tagged = files.map(({ file, slug }) => encodeFilename(file, slug))
        try {
          await uploadFilesBatch(iaId, tagged)
          setToast({
            severity: 'success',
            msg: `Saved — ${files.length} file${files.length === 1 ? '' : 's'} uploaded${autoApproved ? ' and auto-approved' : ''}.`,
          })
        } catch (err) {
          setToast({
            severity: 'warning',
            msg: `Saved. File upload failed (${err?.message || 'unknown error'}). Retry from the Documents tab.`,
          })
        }
      } else {
        setToast({
          severity: 'success',
          msg: autoApproved
            ? 'Registration saved and auto-approved (SDE-initiated).'
            : 'Registration submitted for L1 review.',
        })
      }

      // Push the invalidations before the navigation so the workspace
      // tracker on the next tab renders with the freshest data.
      qc.invalidateQueries({ queryKey: keys.ias.lists(), refetchType: 'all' })
      qc.invalidateQueries({ queryKey: keys.ias.detail(iaId), refetchType: 'all' })
      qc.invalidateQueries({ queryKey: keys.ias.stageHistory(iaId) })

      setTimeout(() => navigate(`${basePath}/ias/${iaId}/workspace/sustainability`), 900)
    } catch (err) {
      setToast({ severity: 'error', msg: err?.message || 'Failed to submit. Please try again.' })
    } finally {
      inflightRef.current = false
      setSubmitting(false)
    }
  }, [iaId, updateM, user, qc, navigate, stagesQ.data, basePath])

  const clearToast = useCallback(() => setToast(null), [])

  return { submit, submitting, toast, clearToast }
}

// Collect File objects from any array-typed form field. Each entry is
// tagged with its `slug` (field name) so the batch uploader can rename
// files to `<slug>__<originalName>` before hitting the file bucket.
function collectFiles(values) {
  const out = []
  for (const [name, v] of Object.entries(values || {})) {
    if (!Array.isArray(v)) continue
    for (const item of v) {
      if (item instanceof File) out.push({ file: item, slug: name })
    }
  }
  return out
}
