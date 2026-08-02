import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Table, TableHead, TableBody, TableRow, TableCell, Box, Typography,
  Button, Alert, CircularProgress, TextField, InputAdornment, Chip,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { PageHeader, StatusChip, Mono } from '../../components/shared'
import { useIAs } from '../../queries'
import { unpackHoDecision } from '../../apis/industryAssociationAppraisals'

const ACTION_SX = { whiteSpace: 'nowrap', minWidth: 0, textTransform: 'none' }

// Full list of Industry Associations for the SIDBI HO Maker — only ones the
// Cluster Expert has commented on (CE has no separate approve action, so a
// non-empty clusterExpertComments is the gate). The actual decision happens
// on HoIaReview (via the row's Review button).
export default function HoIaApprovals() {
  const navigate = useNavigate()
  const { data: allIas = [], isLoading, isFetching, error, refetch } = useIAs()
  const [q, setQ] = useState('')

  const commented = allIas.filter((i) => !!String(i.appraisal?.clusterExpertComments || '').trim())

  const filtered = q.trim()
    ? commented.filter((i) =>
        i.name.toLowerCase().includes(q.trim().toLowerCase()) ||
        (i.city || '').toLowerCase().includes(q.trim().toLowerCase()))
    : commented

  const initialLoading = isLoading && allIas.length === 0
  const refetching = isFetching && allIas.length > 0

  return (
    <Box>
      <PageHeader
        title="IA Approvals"
        subtitle={initialLoading ? 'Loading…' : `${filtered.length} application${filtered.length === 1 ? '' : 's'}`}
        action={
          <Button variant="outlined" startIcon={refetching ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={() => refetch()} disabled={isLoading}>
            {refetching ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />

      <TextField
        size="small" placeholder="Search by association or city…" value={q}
        onChange={(e) => setQ(e.target.value)}
        sx={{ mb: 2, maxWidth: 360 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => refetch()}>Retry</Button>}>
          {error.message || 'Failed to load applications'}
        </Alert>
      )}

      {initialLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <Card>
          <Table sx={{ '& tbody tr:last-of-type td': { border: 0 } }}>
            <TableHead>
              <TableRow>
                <TableCell>Association</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Your decision</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 && !error && (
                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">No applications found.</Typography>
                </TableCell></TableRow>
              )}
              {filtered.map((i) => {
                const decision = unpackHoDecision(i.appraisal).decision
                return (
                  <TableRow key={i.id} hover onClick={() => navigate(`/sde/ias/${i.id}/ho-review`)} sx={{ cursor: 'pointer' }}>
                    <TableCell>
                      <Typography fontWeight={700} fontSize="0.95rem">{i.name}</Typography>
                      <Mono>{[i.city, i.state].filter((x) => x && x !== '—').join(' · ') || '—'}</Mono>
                    </TableCell>
                    <TableCell><StatusChip status={i.status} /></TableCell>
                    <TableCell>
                      {decision
                        ? <Chip size="small" color={decision === 'Approved' ? 'success' : 'error'} label={decision} />
                        : <Typography variant="body2" color="text.secondary">Pending</Typography>}
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="outlined" startIcon={<VisibilityOutlinedIcon />}
                        onClick={(e) => { e.stopPropagation(); navigate(`/sde/ias/${i.id}/ho-review`) }} sx={ACTION_SX}>
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </Box>
  )
}
