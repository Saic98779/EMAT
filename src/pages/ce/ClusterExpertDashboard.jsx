import { useNavigate } from 'react-router-dom'
import {
  Box, Grid, Stack, Typography, Button, Divider, Avatar, Alert,
  CircularProgress, Chip,
} from '@mui/material'
import EastIcon from '@mui/icons-material/East'
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined'
import { StatCard, SectionCard, GreetingBanner, StatusChip, Mono } from '../../components/shared'
import { useIAs } from '../../queries'
import { useAuth } from '../../auth'

// A Cluster Expert only ever does one thing: read a submitted appraisal end to
// end and leave comments. So the landing page is the work queue — applications
// that have a GT-submitted appraisal, split by whether comments exist yet.
export default function ClusterExpertDashboard() {
  const navigate = useNavigate()
  const { roleInfo } = useAuth()
  const { data: ias = [], isLoading, error } = useIAs()

  // Only appraisals that exist can be commented on; everything still at L1 is
  // not yet the Cluster Expert's business.
  const reviewable = ias.filter((i) => !!i.appraisal)
  const hasComment = (i) => !!String(i.appraisal?.clusterExpertComments || '').trim()
  const pending = reviewable.filter((i) => !hasComment(i))
  const commented = reviewable.filter(hasComment)

  const row = (i) => (
    <Stack key={i.id} direction="row" alignItems="center" spacing={2}
      onClick={() => navigate(`/sde/ias/${i.id}/appraisal`)}
      sx={{ py: 1.5, px: 1, mx: -1, borderRadius: 2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
      <Avatar variant="rounded" sx={{ bgcolor: 'primary.light', color: 'primary.dark', width: 40, height: 40 }}>
        <RateReviewOutlinedIcon fontSize="small" />
      </Avatar>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography fontWeight={600} fontSize="0.92rem" noWrap>{i.name}</Typography>
        <Mono>{[i.city, i.state].filter((x) => x && x !== '—').join(' · ') || '—'}</Mono>
      </Box>
      {hasComment(i) && <Chip size="small" color="success" label="Commented" sx={{ fontWeight: 700 }} />}
      <StatusChip status={i.status} />
    </Stack>
  )

  return (
    <Box>
      <GreetingBanner
        date={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        greeting={`Welcome, ${roleInfo?.user?.name?.split(' ')[0] || 'Cluster Expert'}`}
        subtitle="Review submitted appraisals in full and record your comments, including your view on the Terms of Assistance."
        badge="Cluster Expert"
        action={
          <Button variant="contained" endIcon={<EastIcon />} onClick={() => navigate('/sde/ias')}
            sx={{ bgcolor: 'common.white', color: 'primary.dark', '&:hover': { bgcolor: 'grey.100' } }}>
            All applications
          </Button>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message || 'Failed to load applications'}</Alert>}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 4 }}><StatCard icon="doc" value={ias.length} label="Total applications" accent="primary" /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><StatCard icon="clock" value={pending.length} label="Awaiting your comments" accent="warning" /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><StatCard icon="shield" value={commented.length} label="Commented" accent="success" /></Grid>
      </Grid>

      <Grid container spacing={2.5} mt={1}>
        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard title="Awaiting your comments" subtitle="Appraisals submitted by the GT field team.">
            {isLoading && ias.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} /></Box>
            ) : pending.length === 0 ? (
              <Typography color="text.secondary">Nothing awaiting your comments.</Typography>
            ) : (
              <Stack divider={<Divider />}>{pending.map(row)}</Stack>
            )}
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <SectionCard title="Already commented" subtitle="Your remarks are on record.">
            {commented.length === 0
              ? <Typography color="text.secondary">No comments recorded yet.</Typography>
              : <Stack divider={<Divider />}>{commented.map(row)}</Stack>}
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  )
}
