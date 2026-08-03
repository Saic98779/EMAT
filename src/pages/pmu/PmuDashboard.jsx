import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Grid, Stack, Typography, Button, Divider, Avatar, Alert,
  CircularProgress, Chip,
} from '@mui/material'
import EastIcon from '@mui/icons-material/East'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import { StatCard, SectionCard, GreetingBanner, Mono } from '../../components/shared'
import { useBseList } from '../../queries'
import { useAuth } from '../../auth'

// GT PMU landing page. The whole role is one job — review BSE recommendations
// that GT has recommended and that PMU hasn't decided yet — so the dashboard
// is a compact split of pending vs. decided.
export default function PmuDashboard() {
  const navigate = useNavigate()
  const { roleInfo } = useAuth()
  const { data: all = [], isLoading, error } = useBseList()

  // Same gate as PmuQueue.
  const gtOk = (r) => String(r.raw?.gtRecommendation || '').toLowerCase() === 'recommended'
  const pmuDecided = (r) => !!String(r.raw?.pmuRecommendation || '').trim()

  const reviewable = useMemo(() => all.filter(gtOk), [all])
  const pending = useMemo(() => reviewable.filter((r) => !pmuDecided(r)), [reviewable])
  const decided = useMemo(() => reviewable.filter(pmuDecided), [reviewable])

  const row = (r) => (
    <Stack key={r.uuid} direction="row" alignItems="center" spacing={2}
      onClick={() => navigate(`/gt/pmu/${r.uuid}`)}
      sx={{ py: 1.5, px: 1, mx: -1, borderRadius: 2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
      <Avatar variant="rounded" sx={{ bgcolor: 'primary.light', color: 'primary.dark', width: 40, height: 40 }}>
        <FactCheckOutlinedIcon fontSize="small" />
      </Avatar>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography fontWeight={600} fontSize="0.92rem" noWrap>{r.name}</Typography>
        <Mono>{r.ia}</Mono>
      </Box>
      {r.raw?.pmuRecommendation && (
        <Chip size="small"
          color={r.raw.pmuRecommendation === 'Recommended' ? 'success' : r.raw.pmuRecommendation === 'Not Recommended' ? 'error' : 'default'}
          label={r.raw.pmuRecommendation}
          sx={{ fontWeight: 700 }} />
      )}
    </Stack>
  )

  return (
    <Box>
      <GreetingBanner
        date={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        greeting={`Welcome, ${roleInfo?.user?.name?.split(' ')[0] || 'PMU Reviewer'}`}
        subtitle="Review BSE candidates the GT Field Manager has recommended and record your PMU decision with remarks."
        badge="GT PMU"
        action={
          <Button variant="contained" endIcon={<EastIcon />} onClick={() => navigate('/gt/pmu/queue')}
            sx={{ bgcolor: 'common.white', color: 'primary.dark', '&:hover': { bgcolor: 'grey.100' } }}>
            Full queue
          </Button>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message || 'Failed to load BSE recommendations'}</Alert>}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 4 }}><StatCard icon="team" value={reviewable.length} label="Recommended by GT" accent="primary" /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><StatCard icon="clock" value={pending.length} label="Awaiting your decision" accent="warning" /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><StatCard icon="shield" value={decided.length} label="Decided" accent="success" /></Grid>
      </Grid>

      <Grid container spacing={2.5} mt={1}>
        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard title="Awaiting your decision" subtitle="Candidates the GT Field Manager has recommended.">
            {isLoading && all.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} /></Box>
            ) : pending.length === 0 ? (
              <Typography color="text.secondary">Nothing awaiting your decision.</Typography>
            ) : (
              <Stack divider={<Divider />}>{pending.slice(0, 6).map(row)}</Stack>
            )}
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <SectionCard title="Already decided" subtitle="Your recommendation is on record.">
            {decided.length === 0
              ? <Typography color="text.secondary">No decisions recorded yet.</Typography>
              : <Stack divider={<Divider />}>{decided.slice(0, 6).map(row)}</Stack>}
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  )
}
