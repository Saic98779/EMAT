import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Table, TableHead, TableBody, TableRow, TableCell, Box, Typography,
  Button, Alert, CircularProgress, TextField, InputAdornment, Chip,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { PageHeader, StatusChip, Mono } from '../../components/shared'
import StatusFilterBar from '../../components/StatusFilterBar'
import { useIAs } from '../../queries'
import { unpackHoDecision } from '../../apis/industryAssociationAppraisals'

const ACTION_SX = { whiteSpace: 'nowrap', minWidth: 0, textTransform: 'none' }

// Chip-based stage filter shown above the IA list (UAT 2026-09-28) —
// lets HO Maker / Checker slice by outcome instead of scanning the
// full mixed list. Each chip carries a Set of sub-stages it matches.
const STAGE_FILTERS = [
  { key: 'all',       label: 'All',                        tone: 'default', matches: null },
  { key: 'pending',   label: 'Pending review',             tone: 'warning', matches: new Set(['DETAILED_APPRAISAL_CE_COMMENTS_SUBMITTED']) },
  { key: 'ho_maker',  label: 'HO Maker approved',          tone: 'info',    matches: new Set(['DETAILED_APPRAISAL_APPROVAL_BY_HO_MAKER']) },
  { key: 'ho_checker',label: 'HO Checker approved',        tone: 'success', matches: new Set(['DETAILED_APPRAISAL_APPROVAL_BY_HO_CHECKER']) },
  { key: 'reverted',  label: 'Reverted',                   tone: 'warning', matches: new Set(['DETAILED_APPRAISAL_REVERTED_BY_HO_MAKER', 'DETAILED_APPRAISAL_REVERTED_BY_HO_CHECKER']) },
  { key: 'rejected',  label: 'Rejected',                   tone: 'error',   matches: new Set(['DETAILED_APPRAISAL_REJECTED_BY_HO_MAKER', 'DETAILED_APPRAISAL_REJECTED_BY_HO_CHECKER']) },
  { key: 'panel',     label: 'Panel submitted',            tone: 'info',    matches: new Set(['DETAILED_APPRAISAL_SUBMITTED_BY_PANEL']) },
]

// Sub-stages HO Maker + HO Checker own. Drives the filter that decides
// which IAs land in the approvals table. Both roles share this page —
// each acts at their own sub-stage (Maker at CE_COMMENTS_SUBMITTED,
// Checker at APPROVAL_BY_HO_MAKER). Keep in sync with
// `HoMakerDashboard.jsx#HO_REVIEWABLE_STAGES`.
const HO_REVIEWABLE_STAGES = new Set([
  'DETAILED_APPRAISAL_CE_COMMENTS_SUBMITTED',
  'DETAILED_APPRAISAL_APPROVAL_BY_HO_MAKER',
  'DETAILED_APPRAISAL_REJECTED_BY_HO_MAKER',
  'DETAILED_APPRAISAL_REVERTED_BY_HO_MAKER',
  // HO Checker sub-stages (2026-09-28) — final signer sees them here
  // too so they can find IAs post their own decision.
  'DETAILED_APPRAISAL_APPROVAL_BY_HO_CHECKER',
  'DETAILED_APPRAISAL_REJECTED_BY_HO_CHECKER',
  'DETAILED_APPRAISAL_REVERTED_BY_HO_CHECKER',
  'DETAILED_APPRAISAL_SUBMITTED_BY_PANEL',
])

// Full list of Industry Associations for the SIDBI HO Maker — filtered
// on `currentStage`, not the (often-empty) clusterExpertComments text
// column. The CE step advances the workflow whether or not the CE
// leaves a comment string, and gating on the string means HO's queue
// misses IAs the workflow says are theirs. The actual decision happens
// on HoIaReview (via the row's Review button).
export default function HoIaApprovals() {
  const navigate = useNavigate()
  const { data: allIas = [], isLoading, isFetching, error, refetch } = useIAs()
  const [q, setQ] = useState('')
  const [stageFilter, setStageFilter] = useState('all')

  const commented = allIas
    .filter((i) => HO_REVIEWABLE_STAGES.has(i.currentStage))
    // Newest first — prefer updatedAt (most recent activity) then
    // createdAt, then id as a stable tiebreaker.
    .slice()
    .sort((a, b) => {
      const at = new Date(a?.raw?.updatedAt || a?.raw?.createdAt || 0).getTime()
      const bt = new Date(b?.raw?.updatedAt || b?.raw?.createdAt || 0).getTime()
      if (at !== bt) return bt - at
      return (Number(b?.id) || 0) - (Number(a?.id) || 0)
    })

  // Per-chip counts drive both the filter chip badges and the applied
  // filter. `null` matches means "all rows".
  const counts = useMemo(() => {
    const out = {}
    for (const f of STAGE_FILTERS) {
      out[f.key] = f.matches ? commented.filter((i) => f.matches.has(i.currentStage)).length : commented.length
    }
    return out
  }, [commented])

  const activeFilter = STAGE_FILTERS.find((f) => f.key === stageFilter) || STAGE_FILTERS[0]
  const stageFiltered = activeFilter.matches
    ? commented.filter((i) => activeFilter.matches.has(i.currentStage))
    : commented

  const filtered = q.trim()
    ? stageFiltered.filter((i) =>
        i.name.toLowerCase().includes(q.trim().toLowerCase()) ||
        (i.city || '').toLowerCase().includes(q.trim().toLowerCase()))
    : stageFiltered

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

      <StatusFilterBar
        label="Filter"
        value={stageFilter}
        onChange={setStageFilter}
        filters={STAGE_FILTERS.map((f) => ({ key: f.key, label: f.label, tone: f.tone, count: counts[f.key] }))}
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
                  <TableRow key={i.id} hover onClick={() => navigate(`/sde/ias/${i.id}/workspace/appraisal`)} sx={{ cursor: 'pointer' }}>
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
                        onClick={(e) => { e.stopPropagation(); navigate(`/sde/ias/${i.id}/workspace/appraisal`) }} sx={ACTION_SX}>
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
