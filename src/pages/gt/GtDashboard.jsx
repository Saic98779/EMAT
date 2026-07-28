import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Grid, Box, Stack, Typography, Button, Card, CardContent, Avatar, Chip, Divider,
  CircularProgress,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EastIcon from '@mui/icons-material/East'
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined'
import { BarChart } from '@mui/x-charts/BarChart'
import { StatCard, StatBars, SectionCard, GreetingBanner, iconMap, statusColor } from '../../components/shared'
import { gtStats } from '../../data'
import { useAuth } from '../../auth'
import {
  listBseRecommendationsByGtStatus,
  fromDto as bseFromDto,
} from '../../apis/bseRecommendations'

// The backend's initial gt-recommendation status. Adjust if the enum uses a
// different label ("PENDING", "None", etc.).
const GT_PENDING_STATUS = 'Pending'

export default function GtDashboard() {
  const navigate = useNavigate()
  const { roleInfo } = useAuth()
  const s = gtStats

  const [pendingBse, setPendingBse] = useState([])
  const [pendingBseLoading, setPendingBseLoading] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    setPendingBseLoading(true)
    listBseRecommendationsByGtStatus(GT_PENDING_STATUS, { signal: ctrl.signal })
      .then((data) => {
        const list = Array.isArray(data)
          ? data
          : (Array.isArray(data?.content) ? data.content
            : (Array.isArray(data?.items) ? data.items : []))
        setPendingBse(list.map(bseFromDto))
      })
      .catch((err) => { if (err.name !== 'AbortError') setPendingBse([]) })
      .finally(() => setPendingBseLoading(false))
    return () => ctrl.abort()
  }, [])

  return (
    <Box>
      <GreetingBanner
        date="Monday, 22 June 2026"
        greeting={`Good morning, ${roleInfo.user.name.split(' ')[0]}`}
        subtitle="Capture Industry Association proposals, take them through SIDBI appraisal, and clear your field team’s requests."
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/gt/ias/new')}
            sx={{ bgcolor: 'common.white', color: 'primary.dark', '&:hover': { bgcolor: 'grey.100' } }}>
            In-Principle Approval
          </Button>
        }
      />

      <Grid container spacing={2.5} mb={1}>
        {s.cards.map((c) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={c.label}><StatCard {...c} /></Grid>
        ))}
      </Grid>

      <Grid container spacing={2.5} mt={1}>
        <Grid size={12}>
          <SectionCard
            title="BSE candidates awaiting your recommendation"
            subtitle={`Filtered by gt-recommendation status = “${GT_PENDING_STATUS}”.`}
            action={<Button size="small" endIcon={<EastIcon />} onClick={() => navigate('/gt/team')}>BSE Team</Button>}
          >
            {pendingBseLoading && pendingBse.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={22} />
              </Box>
            ) : pendingBse.length === 0 ? (
              <Typography color="text.secondary">No BSE candidates pending your recommendation.</Typography>
            ) : (
              <Stack divider={<Divider />} spacing={0}>
                {pendingBse.slice(0, 6).map((c) => (
                  <Stack key={c.uuid} direction="row" alignItems="center" spacing={2}
                    onClick={() => navigate(`/gt/team/${c.uuid}`)}
                    sx={{ py: 1.5, px: 1, mx: -1, borderRadius: 2, cursor: 'pointer', transition: 'background .15s', '&:hover': { bgcolor: 'action.hover' } }}>
                    <Avatar variant="rounded" sx={{ bgcolor: 'primary.light', color: 'primary.dark', width: 40, height: 40 }}>
                      <PersonSearchOutlinedIcon fontSize="small" />
                    </Avatar>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography fontWeight={600} fontSize="0.92rem">{c.name}</Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {c.ia} · {c.qualification} · {c.experience}
                      </Typography>
                    </Box>
                    <Chip label={c.status} size="small" sx={{ bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 700 }} />
                  </Stack>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard title="Needs your attention" action={<Button size="small" endIcon={<EastIcon />} onClick={() => navigate('/gt/ias')}>All IAs</Button>}>
            <Stack divider={<Divider />} spacing={0}>
              {s.attention.map((a) => {
                const Icon = iconMap[a.icon]
                const color = statusColor(a.badge)
                return (
                  <Stack key={a.title} direction="row" alignItems="center" spacing={2} onClick={() => a.to && navigate(a.to)}
                    sx={{ py: 1.5, px: 1, mx: -1, borderRadius: 2, cursor: a.to ? 'pointer' : 'default', transition: 'background .15s', '&:hover': { bgcolor: 'action.hover' } }}>
                    <Avatar variant="rounded" sx={{ bgcolor: `${color === 'default' ? 'primary' : color}.light`, color: `${color === 'default' ? 'primary' : color}.dark`, width: 40, height: 40 }}>
                      <Icon fontSize="small" />
                    </Avatar>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography fontWeight={600} fontSize="0.92rem">{a.title}</Typography>
                      <Typography variant="body2" color="text.secondary">{a.meta}</Typography>
                    </Box>
                    <Chip label={a.badge} size="small"
                      sx={{ bgcolor: `${color === 'default' ? 'primary' : color}.light`, color: `${color === 'default' ? 'primary' : color}.dark`, fontWeight: 700 }} />
                  </Stack>
                )
              })}
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={2.5}>
            <SectionCard title="Pipeline by stage" subtitle="All active Industry Associations">
              <StatBars rows={s.pipeline} />
            </SectionCard>
            <SectionCard title="Appraisal funnel" subtitle="Industry Associations, capture → sanction">
              <Stack spacing={1.25}>
                {s.funnel.map((f, i) => (
                  <Stack key={f.label} direction="row" alignItems="center" spacing={2}>
                    <Box sx={{
                      height: 36, borderRadius: 2, display: 'flex', alignItems: 'center', pl: 1.5, minWidth: 48,
                      width: `${(f.value / s.funnel[0].value) * 100}%`,
                      background: (t) => `linear-gradient(90deg, ${t.palette.primary.dark}, ${t.palette.primary.main})`,
                      opacity: 1 - i * 0.16,
                    }}>
                      <Typography color="#fff" fontWeight={700} fontSize="0.85rem">{f.value}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">{f.label}</Typography>
                  </Stack>
                ))}
              </Stack>
            </SectionCard>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard title="This week" subtitle="Items handled per day">
            <BarChart
              height={210}
              xAxis={[{ scaleType: 'band', data: s.week.labels }]}
              series={[{ data: s.week.data, color: 'var(--mui-palette-primary-main)' }]}
              yAxis={[{ width: 28 }]}
              margin={{ top: 10, bottom: 20, left: 0, right: 0 }}
              borderRadius={8}
              grid={{ horizontal: true }}
            />
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Grid container spacing={2.5} sx={{ height: '100%' }}>
            <Grid size={6}>
              <Card sx={{ height: '100%' }}><CardContent sx={{ p: 3 }}>
                <Typography variant="overline" color="text.secondary">Avg L1 turnaround</Typography>
                <Typography variant="h3" color="primary.main" fontWeight={800}>{s.week.avgL1}</Typography>
                <Typography variant="body2" color="text.secondary">per proposal</Typography>
              </CardContent></Card>
            </Grid>
            <Grid size={6}>
              <Card sx={{ height: '100%', color: '#fff', border: 0, background: (t) => `linear-gradient(140deg, ${t.palette.secondary.dark}, ${t.palette.secondary.main})` }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.75)' }}>Detailed completion</Typography>
                  <Typography variant="h3" fontWeight={800}>{s.week.completion}</Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>of started</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  )
}
