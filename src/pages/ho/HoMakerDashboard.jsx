import { useNavigate } from 'react-router-dom'
import {
  Box, Grid, Stack, Typography, Button, Divider, Avatar, Alert,
  CircularProgress, Chip,
} from '@mui/material'
import EastIcon from '@mui/icons-material/East'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import { StatCard, SectionCard, GreetingBanner, StatusChip, Mono } from '../../components/shared'
import { useIAs } from '../../queries'
import { unpackHoDecision } from '../../apis/industryAssociationAppraisals'
import { useAuth } from '../../auth'

// SIDBI HO Maker approves/rejects (with remarks) Industry Associations the
// Cluster Expert has already commented on — CE has no separate approve action,
// so a non-empty clusterExpertComments is the gate. Structurally mirrors
// ClusterExpertDashboard: same "queue split by decided/not" landing page.
export default function HoMakerDashboard() {
  const navigate = useNavigate()
  const { roleInfo } = useAuth()
  const { data: ias = [], isLoading, error } = useIAs()

  const hasComment = (i) => !!String(i.appraisal?.clusterExpertComments || '').trim()
  const reviewable = ias.filter((i) => !!i.appraisal && hasComment(i))
  const decisionOf = (i) => unpackHoDecision(i.appraisal).decision
  const pending = reviewable.filter((i) => !decisionOf(i))
  const decided = reviewable.filter((i) => !!decisionOf(i))

  const row = (i) => {
    const decision = decisionOf(i)
    return (
      <Stack key={i.id} direction="row" alignItems="center" spacing={2}
        onClick={() => navigate(`/sde/ias/${i.id}/ho-review`)}
        sx={{ py: 1.5, px: 1, mx: -1, borderRadius: 2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
        <Avatar variant="rounded" sx={{ bgcolor: 'primary.light', color: 'primary.dark', width: 40, height: 40 }}>
          <FactCheckOutlinedIcon fontSize="small" />
        </Avatar>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography fontWeight={600} fontSize="0.92rem" noWrap>{i.name}</Typography>
          <Mono>{[i.city, i.state].filter((x) => x && x !== '—').join(' · ') || '—'}</Mono>
        </Box>
        {decision && (
          <Chip size="small" color={decision === 'Approved' ? 'success' : 'error'}
            label={decision} sx={{ fontWeight: 700 }} />
        )}
        <StatusChip status={i.status} />
      </Stack>
    )
  }

  return (
    <Box>
      <GreetingBanner
        date={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        greeting={`Welcome, ${roleInfo?.user?.name?.split(' ')[0] || 'HO Maker'}`}
        subtitle="Review Industry Associations the Cluster Expert has commented on and record your approve/reject decision with remarks."
        badge="SIDBI HO Maker"
        action={
          <Button variant="contained" endIcon={<EastIcon />} onClick={() => navigate('/sde/ia-approvals')}
            sx={{ bgcolor: 'common.white', color: 'primary.dark', '&:hover': { bgcolor: 'grey.100' } }}>
            All applications
          </Button>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message || 'Failed to load applications'}</Alert>}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 4 }}><StatCard icon="team" value={reviewable.length} label="Commented by CE" accent="primary" /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><StatCard icon="clock" value={pending.length} label="Awaiting your decision" accent="warning" /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><StatCard icon="shield" value={decided.length} label="Decided" accent="success" /></Grid>
      </Grid>

      <Grid container spacing={2.5} mt={1}>
        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard title="Awaiting your decision" subtitle="Applications the Cluster Expert has commented on.">
            {isLoading && ias.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} /></Box>
            ) : pending.length === 0 ? (
              <Typography color="text.secondary">Nothing awaiting your decision.</Typography>
            ) : (
              <Stack divider={<Divider />}>{pending.map(row)}</Stack>
            )}
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <SectionCard title="Already decided" subtitle="Your approve/reject decision is on record.">
            {decided.length === 0
              ? <Typography color="text.secondary">No decisions recorded yet.</Typography>
              : <Stack divider={<Divider />}>{decided.map(row)}</Stack>}
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  )
}
