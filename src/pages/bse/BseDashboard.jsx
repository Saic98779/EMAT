import { useNavigate } from 'react-router-dom'
import {
  Box, Grid, Stack, Typography, Button, Card, CardContent, Divider, Avatar,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EastIcon from '@mui/icons-material/East'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined'
import { LineChart } from '@mui/x-charts/LineChart'
import { StatCard, StatBars, SectionCard, GreetingBanner, StatusChip } from '../../components/shared'
import { bseStats } from '../../data'
import AttendanceCalendar from './AttendanceCalendar'
import { useAuth } from '../../auth'

export default function BseDashboard() {
  const navigate = useNavigate()
  const { roleInfo } = useAuth()
  const s = bseStats

  return (
    <Box>
      <GreetingBanner
        date="Monday, 22 June 2026"
        greeting={`Hi, ${roleInfo.user.name.split(' ')[0]}`}
        subtitle="Log field visits, raise attendance for off-site days, and claim field expenses."
        badge="🔥 16-day streak"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/bse/disbursals/new')}
            sx={{ bgcolor: 'common.white', color: 'primary.dark', '&:hover': { bgcolor: 'grey.100' } }}>
            Raise Disbursal
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
          <SectionCard title="My recent requests" action={<Button size="small" endIcon={<EastIcon />} onClick={() => navigate('/bse/disbursals')}>All disbursals</Button>}>
            <Stack divider={<Divider />}>
              {s.recent.map((r) => (
                <Stack key={r.title} direction="row" alignItems="center" spacing={2} sx={{ py: 1.5, px: 1, mx: -1, borderRadius: 2, '&:hover': { bgcolor: 'action.hover' } }}>
                  <Avatar variant="rounded" sx={{ bgcolor: 'primary.light', color: 'primary.dark', width: 40, height: 40 }}><PaymentsOutlinedIcon fontSize="small" /></Avatar>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography fontWeight={600} fontSize="0.92rem">{r.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{r.meta}</Typography>
                  </Box>
                  <StatusChip status={r.badge} />
                </Stack>
              ))}
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <SectionCard title="Attendance this month" subtitle="Jun 1 – Jun 22, 2026">
            <StatBars rows={s.attendanceMonth} />
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard title="Attendance — June 2026" subtitle="Field-visit & branch days, tracked daily">
            <AttendanceCalendar />
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={2.5}>
            <Card sx={{ color: '#fff', border: 0, position: 'relative', overflow: 'hidden', background: (t) => `linear-gradient(140deg, ${t.palette.secondary.dark}, ${t.palette.secondary.main})` }}>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                  <BoltOutlinedIcon fontSize="small" />
                  <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.8)' }}>Current streak</Typography>
                </Stack>
                <Stack direction="row" alignItems="baseline" spacing={1}>
                  <Typography variant="h3" fontWeight={800}>{s.streak.days}</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.85)' }}>working days</Typography>
                </Stack>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', mt: 0.5 }}>{s.streak.note}</Typography>
              </CardContent>
            </Card>
            <SectionCard title="Field expense" subtitle="Claimed · last 5 weeks">
              <LineChart
                height={170}
                xAxis={[{ scaleType: 'point', data: s.expense.labels }]}
                series={[{ data: s.expense.data, color: 'var(--mui-palette-secondary-main)', area: true, showMark: true, curve: 'monotoneX' }]}
                yAxis={[{ width: 44 }]}
                margin={{ top: 10, bottom: 20, left: 0, right: 8 }}
                grid={{ horizontal: true }}
                sx={{ '& .MuiAreaElement-root': { fillOpacity: 0.15 } }}
              />
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  )
}
