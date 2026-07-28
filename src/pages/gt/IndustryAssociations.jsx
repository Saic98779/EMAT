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
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn'
import EditNoteIcon from '@mui/icons-material/EditNote'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { PageHeader, StatusChip, Mono } from '../../components/shared'
import { deleteIndustryAssociation } from '../../apis/industryAssociations'
import { useIAs, useBranchesByStates, keys } from '../../queries'

// Contextual primary action per IA status (GT). Kept as small outlined
// buttons so long labels don't wrap onto two lines and no single colour
// dominates the table.
const ACTION_SX = { whiteSpace: 'nowrap', minWidth: 0, textTransform: 'none' }

function rowAction(ia, navigate, basePath) {
  const go = (path) => (e) => { e.stopPropagation(); navigate(path) }
  const view = (
    <Button size="small" variant="outlined" startIcon={<VisibilityOutlinedIcon />}
      onClick={go(`${basePath}/${ia.id}`)} sx={ACTION_SX}>View</Button>
  )
  if (!basePath.startsWith('/gt')) return view
  if (ia.status === 'Detailed Pending')
    return <Button size="small" variant="outlined" color="primary" startIcon={<AssignmentTurnedInIcon />}
      onClick={go(`/gt/ias/${ia.id}/appraisal`)} sx={ACTION_SX}>Appraisal</Button>
  if (ia.status === 'Changes Requested')
    return <Button size="small" variant="outlined" color="warning" startIcon={<EditNoteIcon />}
      onClick={go(`/gt/ias/${ia.id}/appraisal`)} sx={ACTION_SX}>Revise</Button>
  if (ia.status === 'Approved')
    return <Button size="small" variant="outlined" color="primary" startIcon={<PaymentsOutlinedIcon />}
      onClick={go(`/gt/ias/${ia.id}/capex`)} sx={ACTION_SX}>Disburse</Button>
  return view
}

export default function IndustryAssociations({ basePath = '/gt/ias' }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: ias = [], isLoading: iasLoading, isFetching, error: iasErrorObj, refetch } = useIAs()
  const iasError = iasErrorObj?.message || null
  // Fetch branch dropdowns for every state present in the list, then use the
  // combined map to resolve each row's `sidbiBranch` UUID → branchName.
  const { byUuid: branchNameByUuid } = useBranchesByStates(ias.map((i) => i.state))
  const isGt = basePath.startsWith('/gt')
  const [confirm, setConfirm] = useState(null) // IA pending soft-delete
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState({ severity: '', msg: '' })

  const doDelete = async () => {
    if (!confirm?.uuid) return
    setDeleting(true)
    try {
      await deleteIndustryAssociation(confirm.uuid)
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
            {isGt && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/gt/ias/new')}>
                In-Principle Approval
              </Button>
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
                    {isGt && ' Click “In-Principle Approval” to add the first one.'}
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
                <TableCell><Typography variant="body2">{branchNameByUuid.get(ia.branch) || ia.branch}</Typography></TableCell>
                <TableCell><StatusChip status={ia.status} /></TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                    {rowAction(ia, navigate, basePath)}
                    {isGt && ia.uuid && (
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
