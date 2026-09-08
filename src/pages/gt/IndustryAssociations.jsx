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
import { unpackHoDecision } from '../../apis/industryAssociationAppraisals'
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

  // Cluster Expert only ever comments on the appraisal — send them
  // straight to that tab instead of the generic overview.
  if (isClusterExpert && ia.appraisal) {
    return (
      <Button size="small" variant="outlined" color="primary" startIcon={<EditNoteIcon />}
        onClick={go(`${workspaceBase}/ias/${ia.id}/workspace/appraisal`)} sx={ACTION_SX}>
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

  // Reviewer sent it back — GT needs to revise.
  if (cs.endsWith('_REVERTED') || cs.endsWith('_REJECTED') || st === 'Changes Requested') {
    // Route to the tab that owns the reverted stage so GT lands in the
    // right form. Fallback: L1.
    const tab = cs.startsWith('DETAILED_APPRAISAL') ? 'appraisal'
      : cs.startsWith('ACTION_PLAN') ? 'appraisal'
      : cs.startsWith('SUSTAINABILITY') ? 'sustainability'
      : 'l1'
    return (
      <Button size="small" variant="outlined" color="warning" startIcon={<EditNoteIcon />}
        onClick={go(ws(tab))} sx={ACTION_SX}>Revise</Button>
    )
  }

  // L1 done → GT's next step is Sustainability.
  if (cs === 'IN_PRINCIPLE_APPROVAL_OF_IA_SDE_APPROVAL' || st === 'Detailed Pending')
    return (
      <Button size="small" variant="outlined" color="primary" startIcon={<AssignmentTurnedInIcon />}
        onClick={go(ws('sustainability'))} sx={ACTION_SX}>Sustainability</Button>
    )

  // Detailed appraisal work is open — GT should keep filling it.
  if (cs === 'SUSTAINABILITY_MATRIX_SUBMITTED' || cs === 'ACTION_PLAN_SUBMITTED'
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
  // Cluster Expert shares the SDE workspace but is only a reviewer on the
  // appraisal — they don't participate in Eligibility / In-Principle /
  // Sustainability. Trim the list to rows that have an appraisal record and
  // haven't yet been decided by HO, so CE isn't distracted by IAs they
  // can't act on. Everyone else sees the full list.
  const isClusterExpert = rawRole === 'CLUSTER_EXPERT'
  const isHoMaker = rawRole === 'SIDBI_HO_MAKER'
  const ias = isClusterExpert
    ? iasAll.filter((i) => i.appraisal && !unpackHoDecision(i.appraisal).decision)
    : iasAll
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
              <TableCell>Sector</TableCell>
              <TableCell>SIDBI Branch</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!iasLoading && ias.length === 0 && !iasError && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
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
                <TableCell><Typography variant="body2">{ia.sector}</Typography></TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {branchNameById.get(ia.branch) || (ia.branch && !isLikelyId(ia.branch) ? ia.branch : '—')}
                  </Typography>
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
