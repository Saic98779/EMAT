import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, TableHead, TableBody, TableRow, TableCell, Box, Typography, Button,
  Alert, CircularProgress, Stack, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions, Snackbar,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn'
import EditNoteIcon from '@mui/icons-material/EditNote'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { PageHeader, StatusChip, Mono } from '../../components/shared'
import { deleteIndustryAssociation } from '../../apis/industryAssociations'
import { useIAs, useBranchesByStates, keys } from '../../queries'
import { useAuth } from '../../auth'

// Contextual primary action per IA status (GT). Kept as small outlined
// buttons so long labels don't wrap onto two lines and no single colour
// dominates the table.
const ACTION_SX = { whiteSpace: 'nowrap', minWidth: 0, textTransform: 'none' }

// Backend sometimes hands back an opaque id (numeric primary key, UUID,
// or a dev sentinel like "hyd-branch-uuid") in fields that should display
// a human name — until the name-resolving query hydrates. Show '—' in
// that intermediate state instead of leaking the raw id into the UI.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Sub-stages where Cluster Expert has a decision affordance — keep in sync
// with `TRANSITIONS` in `src/apis/stageActions.js`. Anything not in this
// set is either upstream of CE or already past their turn.
const CE_ACTIONABLE_STAGES = new Set([
  'ACTION_PLAN_SUBMITTED',
  'DETAILED_APPRAISAL_APPROVAL_BY_SDE',
])

// Timestamp used to sort the list — accept either `raw.createdAt` (backend
// primary source) or `raw.updatedAt` as a fallback. Returns 0 when parsing
// fails so the id-based tie-break kicks in.
function tsFor(ia) {
  const raw = ia?.raw?.createdAt || ia?.raw?.updatedAt || null
  if (!raw) return 0
  const t = Date.parse(raw)
  return Number.isFinite(t) ? t : 0
}

// Resolve the branch column value robustly. The IA DTO stores `sidbiBranch`
// as either a number or a string depending on backend version; the branch
// dropdown map is keyed off whatever type the /branch/dropdown endpoint
// emits. Comparing both as strings makes the lookup work either way.
// Falls back to `raw.sidbiBranchName` (some backend builds include an
// expanded name), then the id itself when it's a human string, and finally
// an em-dash when nothing usable is present.
function branchLabel(ia, byId) {
  const raw = ia?.raw?.sidbiBranch ?? ia?.branch ?? null
  if (raw != null && raw !== '' && raw !== '—') {
    const asStr = String(raw)
    for (const [key, name] of byId) {
      if (String(key) === asStr) return name
    }
    if (!isLikelyId(raw)) return asStr
  }
  const expanded = ia?.raw?.sidbiBranchName
  if (expanded && typeof expanded === 'string') return expanded
  return '—'
}

function isLikelyId(v) {
  if (v == null) return true
  const s = String(v).trim()
  if (!s) return true
  if (/^\d+$/.test(s)) return true                              // numeric primary key
  if (UUID_RE.test(s)) return true                              // UUID
  if (/-uuid$/i.test(s)) return true                            // dev sentinel: hyd-branch-uuid
  if (/^[a-z0-9]{16,}$/i.test(s) && !/\s/.test(s)) return true  // long opaque token
  return false
}

// Contextual primary action per IA row. Each button routes into the IA
// workspace on the appropriate tab so users land where their work is.
// Both GT and SDE workspaces use the same tab slugs — the `basePath`
// keeps navigation inside the caller's role.
function rowAction(ia, navigate, basePath, { isClusterExpert = false } = {}) {
  const go = (path) => (e) => { e.stopPropagation(); navigate(path) }
  // Workspace base for THIS IA's detail — `/gt/ias/123/workspace` etc.
  const ws = (tab) => `${basePath}/${ia.id}/workspace/${tab}`
  const workspaceBase = basePath.startsWith('/gt') ? '/gt' : '/sde'

  // Cluster Expert routing — CE reviews the Action Plan (stage 4) and
  // adds L2 comments (stage 5). Route to whichever tab owns the CURRENT
  // sub-stage rather than always sending them to /appraisal; otherwise a
  // CE with an ACTION_PLAN_SUBMITTED row gets dropped on the appraisal
  // tab, which is locked until CE approves the plan.
  if (isClusterExpert) {
    const ceTab = ia.currentStage === 'ACTION_PLAN_SUBMITTED'
      ? 'action-plan'
      : (ia.appraisal ? 'appraisal' : 'overview')
    return (
      <Button size="small" variant="outlined" color="primary" startIcon={<EditNoteIcon />}
        onClick={go(`${workspaceBase}/ias/${ia.id}/workspace/${ceTab}`)} sx={ACTION_SX}>
        Review & Comment
      </Button>
    )
  }

  const view = (
    <Button size="small" variant="outlined" startIcon={<VisibilityOutlinedIcon />}
      onClick={go(ws('overview'))} sx={ACTION_SX}>View</Button>
  )

  // Stage-driven CTAs. Prefer the enum from `ia.currentStage` when we
  // have it; fall back to the status string so pre-workflow records still
  // render a sensible button.
  const cs = ia.currentStage || ''
  const st = ia.status || ''

  // GT still needs to complete the L1 form.
  if (cs === 'ELIGIBILITY_MATRIX' || st === 'Screened · Awaiting In-Principle')
    return (
      <Button size="small" variant="outlined" color="primary" startIcon={<EditNoteIcon />}
        onClick={go(ws('l1'))} sx={ACTION_SX}>Complete In-Principle</Button>
    )

  if (!basePath.startsWith('/gt')) return view

  // Reviewer sent it back — GT needs to revise. Route by the specific
  // reverted sub-stage: CE reverting the Action Plan gets its own tab now.
  if (cs.endsWith('_REVERTED') || cs.endsWith('_REJECTED') || st === 'Changes Requested') {
    const tab = cs === 'CLUSTER_EXPERT_REVERTED' ? 'action-plan'
      : cs.startsWith('DETAILED_APPRAISAL') ? 'appraisal'
      : cs.startsWith('SUSTAINABILITY') ? 'sustainability'
      : 'l1'
    return (
      <Button size="small" variant="outlined" color="warning" startIcon={<EditNoteIcon />}
        onClick={go(ws(tab))} sx={ACTION_SX}>Revise</Button>
    )
  }

  // L1 approved (SDE cleared In-Principle) → GT's next step is Sustainability.
  if (cs === 'IN_PRINCIPLE_APPROVAL_OF_IA_SDE_APPROVAL')
    return (
      <Button size="small" variant="outlined" color="primary" startIcon={<AssignmentTurnedInIcon />}
        onClick={go(ws('sustainability'))} sx={ACTION_SX}>Sustainability</Button>
    )

  // Sustainability submitted → GT fills the Action Plan (Annexure IV).
  if (cs === 'SUSTAINABILITY_MATRIX_SUBMITTED')
    return (
      <Button size="small" variant="outlined" color="primary" startIcon={<AssignmentTurnedInIcon />}
        onClick={go(ws('action-plan'))} sx={ACTION_SX}>Fill Action Plan</Button>
    )

  // Action Plan with CE — GT can only wait; landing on action-plan shows
  // the "Awaiting Cluster Expert" banner + read-only view of what they filed.
  if (cs === 'ACTION_PLAN_SUBMITTED')
    return (
      <Button size="small" variant="outlined" startIcon={<VisibilityOutlinedIcon />}
        onClick={go(ws('action-plan'))} sx={ACTION_SX}>View Action Plan</Button>
    )

  // CE approved the Action Plan (or the L2 form is still open for edits).
  if (cs === 'CLUSTER_EXPERT_APPROVED'
      || (st === 'Final Review (L2)' && ia.appraisal && !ia.appraisal.isSidbeApproved)) {
    return (
      <Button size="small" variant="outlined" color="primary" startIcon={<AssignmentTurnedInIcon />}
        onClick={go(ws('appraisal'))} sx={ACTION_SX}>Complete Detailed Appraisal</Button>
    )
  }

  // Fully approved — hand-off to disbursement (still legacy route for now).
  if (st === 'Approved')
    return (
      <Button size="small" variant="outlined" color="primary" startIcon={<PaymentsOutlinedIcon />}
        onClick={go(`/gt/ias/${ia.id}/capex`)} sx={ACTION_SX}>Disburse</Button>
    )

  return view
}

export default function IndustryAssociations({ basePath = '/gt/ias' }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { rawRole } = useAuth()
  const { data: iasAll = [], isLoading: iasLoading, isFetching, error: iasErrorObj, refetch } = useIAs()
  const iasError = iasErrorObj?.message || null
  // Cluster Expert has decision affordances at exactly two sub-stages
  // (see stageActions.js TRANSITIONS):
  //   • ACTION_PLAN_SUBMITTED               — CE approves / reverts action plan
  //   • DETAILED_APPRAISAL_APPROVAL_BY_SDE  — CE adds comments before HO Maker
  // Any other stage is either upstream of CE (nothing to review yet) or
  // downstream (CE already acted, HO Maker owns the record). Trim the
  // list to just those two so CE's queue only shows actionable work.
  const isClusterExpert = rawRole === 'CLUSTER_EXPERT'
  const isHoMaker = rawRole === 'SIDBI_HO_MAKER'
  const iasFiltered = isClusterExpert
    ? iasAll.filter((i) => CE_ACTIONABLE_STAGES.has(i.currentStage))
    : iasAll
  // Newest-first ordering. Prefer the backend `createdAt` timestamp; fall
  // back to the numeric `id` when a row is missing the field so legacy
  // records still sort deterministically. Sort is stable — do it once
  // here rather than push it into the query so the SDE / CE variants of
  // this page share the same reordering.
  const ias = [...iasFiltered].sort((a, b) => {
    const at = tsFor(a)
    const bt = tsFor(b)
    if (at !== bt) return bt - at
    return (Number(b.id) || 0) - (Number(a.id) || 0)
  })
  // Fetch branch dropdowns for every state present in the list, then use the
  // combined map to resolve each row's `sidbiBranch` id → branchName.
  const { byId: branchNameById } = useBranchesByStates(ias.map((i) => i.state))
  const isGt = basePath.startsWith('/gt')
  const isSde = basePath.startsWith('/sde')
  // GT and SDE workspaces both host the initiation buttons — SDE-initiated
  // records are auto-approved on the server (see InPrincipleApproval).
  // Cluster Expert + HO Maker share the SDE workspace but neither initiates
  // any of these flows (routes are also guarded in App.jsx); hide the
  // buttons so the affordance matches the routing.
  const canInitiate = (isGt || isSde) && !isClusterExpert && !isHoMaker
  const [confirm, setConfirm] = useState(null) // IA pending soft-delete
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState({ severity: '', msg: '' })

  const doDelete = async () => {
    if (!confirm?.id) return
    setDeleting(true)
    try {
      await deleteIndustryAssociation(confirm.id)
      setToast({ severity: 'success', msg: `${confirm.name} deactivated.` })
      setConfirm(null)
      qc.invalidateQueries({ queryKey: keys.ias.all })
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Failed to delete.' })
    } finally {
      setDeleting(false)
    }
  }

  const initialLoading = iasLoading && ias.length === 0
  const refetching = isFetching && ias.length > 0

  return (
    <Box>
      <PageHeader
        title={isGt ? 'Industry Association Onboarding' : 'Industry Associations'}
        subtitle={
          initialLoading
            ? 'Loading…'
            : `${ias.length} association${ias.length === 1 ? '' : 's'} across the appraisal pipeline`
        }
        action={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={refetching ? <CircularProgress size={16} /> : <RefreshIcon />}
              onClick={() => refetch()}
              disabled={iasLoading}
            >
              {refetching ? 'Refreshing…' : 'Refresh'}
            </Button>
            {canInitiate && (
              <>
                {!isSde && (
                  // GT lands in the new workspace shell — Eligibility is the
                  // first tab and the entry point for a fresh IA. SDE keeps
                  // the legacy standalone screen until its own workspace port.
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => navigate('/gt/ias/new/workspace/eligibility')}
                  >
                    Start a new IA
                  </Button>
                )}
                {isSde && (
                  <>
                    <Button
                      variant="outlined"
                      startIcon={<FactCheckOutlinedIcon />}
                      onClick={() => navigate('/sde/eligibility/new')}
                    >
                      Eligibility Matrix
                    </Button>
                    <Button variant="contained" startIcon={<AddIcon />}
                      onClick={() => navigate('/sde/ias/new')}>
                      In-Principle Approval
                    </Button>
                  </>
                )}
              </>
            )}
          </Stack>
        }
      />

      {iasError && (
        <Alert severity="error" sx={{ mb: 2 }} action={
          <Button color="inherit" size="small" onClick={() => refetch()}>Retry</Button>
        }>
          {iasError}
        </Alert>
      )}

      {initialLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
      <Card>
        <Table sx={{ '& tbody tr:last-of-type td': { border: 0 } }}>
          <TableHead>
            <TableRow>
              <TableCell>Association</TableCell>
              <TableCell>SIDBI Branch</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!iasLoading && ias.length === 0 && !iasError && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">
                    No Industry Associations yet.
                    {canInitiate && ' Click “In-Principle Approval” to add the first one.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {ias.map((ia) => (
              <TableRow key={ia.id} hover onClick={() => navigate(`${basePath}/${ia.id}`)} sx={{ cursor: 'pointer' }}>
                <TableCell>
                  <Typography fontWeight={700} fontSize="0.95rem">{ia.name}</Typography>
                  <Mono>{[ia.city, ia.state].filter((x) => x && x !== '—').join(' · ') || '—'}</Mono>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{branchLabel(ia, branchNameById)}</Typography>
                </TableCell>
                <TableCell><StatusChip status={ia.status} /></TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                    {rowAction(ia, navigate, basePath, { isClusterExpert })}
                    {isGt && ia.id != null && (
                      <Tooltip title="Deactivate">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => { e.stopPropagation(); setConfirm(ia) }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      )}

      <Dialog
        open={!!confirm}
        onClose={() => !deleting && setConfirm(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '6px' } }}
      >
        <DialogTitle sx={{ pb: 0.5, fontWeight: 700 }}>Deactivate association?</DialogTitle>
        <DialogContent sx={{ pb: 1 }}>
          <Typography fontWeight={600}>{confirm?.name}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {[confirm?.city, confirm?.state].filter((x) => x && x !== '—').join(', ') || '—'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setConfirm(null)} disabled={deleting} color="inherit" size="small">Cancel</Button>
          <Button color="error" variant="contained" size="small" onClick={doDelete} disabled={deleting}>
            {deleting ? 'Deactivating…' : 'Deactivate'}
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
