import { useNavigate } from 'react-router-dom'
import {
  Box, Grid, Stack, Typography, Button, Card, CardContent, Avatar, Divider,
} from '@mui/material'
import EastIcon from '@mui/icons-material/East'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import GppGoodOutlinedIcon from '@mui/icons-material/GppGoodOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import { BarChart } from '@mui/x-charts/BarChart'
import { PieChart } from '@mui/x-charts/PieChart'
import { StatCard, StatBars, SectionCard, GreetingBanner, StatusChip } from '../../components/shared'
import { sdeStats, approvalQueue } from '../../data'
import { useAuth } from '../../auth'

const QUEUE_ICON = { 'Review L1': DescriptionOutlinedIcon, 'Final L2': GppGoodOutlinedIcon, Disburse: PaymentsOutlinedIcon }
const PIE_COLOR = { success: '#16a34a', secondary: '#0d9488', error: '#dc2626' }

export default function SdeDashboard() {
  const navigate = useNavigate()
  const { roleInfo } = useAuth()
  const s = sdeStats

  return (
    <Box>
      <GreetingBanner
        date="Monday, 22 June 2026"
        greeting={`Good morning, ${roleInfo.user.name.split(' ')[0]}`}
        subtitle="Appraise Industry Association proposals at both levels and authorise field disbursals."
        badge="4 awaiting review"
        action={
          <Button variant="contained" endIcon={<EastIcon />} onClick={() => navigate('/sde/queue')}
            sx={{ bgcolor: 'common.white', color: 'primary.dark', '&:hover': { bgcolor: 'grey.100' } }}>
            Open queue
          </Button>
        }
      />

      <Grid container spacing={2.5}>
        {s.cards.map((c) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={c.label}><StatCard {...c} /></Grid>
        ))}
      </Grid>

      <Grid container spacing={2.5} mt={1}>
        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard title="Approval queue" action={<Button size="small" endIcon={<EastIcon />} onClick={() => navigate('/sde/queue')}>Open queue</Button>}>
            <Stack divider={<Divider />}>
              {approvalQueue.map((q) => {
                const Icon = QUEUE_ICON[q.badge] || DescriptionOutlinedIcon
                return (
                  <Stack key={q.name} direction="row" alignItems="center" spacing={2} sx={{ py: 1.5, px: 1, mx: -1, borderRadius: 2, '&:hover': { bgcolor: 'action.hover' } }}>
                    <Avatar variant="rounded" sx={{ bgcolor: 'primary.light', color: 'primary.dark', width: 40, height: 40 }}><Icon fontSize="small" /></Avatar>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography fontWeight={600} fontSize="0.92rem">{q.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{q.meta}</Typography>
                    </Box>
                    <StatusChip status={q.badge} />
                  </Stack>
                )
              })}
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <SectionCard title="This month" subtitle="Appraisal throughput">
            <StatBars rows={s.month} />
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard title="Appraisal throughput" subtitle="Decisions cleared per week · last 6 weeks">
            <BarChart
              height={220}
              xAxis={[{ scaleType: 'band', data: s.throughput.labels }]}
              series={[{ data: s.throughput.data, color: 'var(--mui-palette-primary-main)' }]}
              yAxis={[{ width: 28 }]}
              margin={{ top: 10, bottom: 20, left: 0, right: 0 }}
              borderRadius={8}
              grid={{ horizontal: true }}
            />
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={2.5} sx={{ height: '100%' }}>
            <Card sx={{ color: '#fff', border: 0, background: (t) => `linear-gradient(140deg, ${t.palette.primary.dark}, ${t.palette.primary.main})` }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.7)' }}>Avg turnaround</Typography>
                <Stack direction="row" alignItems="baseline" spacing={1}>
                  <Typography variant="h3" fontWeight={800}>{s.avgTurnaround}</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>days / decision</Typography>
                </Stack>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mt: 0.5 }}>Across L1 + L2 appraisals this month</Typography>
              </CardContent>
            </Card>
            <SectionCard title="Decision mix" subtitle="Month to date">
              <Stack direction="row" alignItems="center" spacing={1}>
                <PieChart
                  height={150} width={150}
                  series={[{
                    innerRadius: 42, outerRadius: 68, paddingAngle: 2, cornerRadius: 4,
                    data: s.decisionMix.map((d, i) => ({ id: i, value: d.value, label: d.label, color: PIE_COLOR[d.color] })),
                  }]}
                  hideLegend
                />
                <Stack spacing={1.25} flexGrow={1}>
                  {s.decisionMix.map((d) => (
                    <Stack key={d.label} direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: `${d.color}.main` }} />
                        <Typography variant="body2" color="text.secondary">{d.label}</Typography>
                      </Stack>
                      <Typography variant="subtitle2">{d.value}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  )
}
