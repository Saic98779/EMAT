import { useNavigate } from 'react-router-dom'
import { Box, Grid, Stack, Typography, Button, Divider, Avatar } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EastIcon from '@mui/icons-material/East'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import { StatCard, SectionCard, GreetingBanner, StatusChip } from '../../components/shared'
import { useData } from '../../store'
import { useAuth } from '../../auth'

const inr = (n) => '₹' + n.toLocaleString('en-IN')

export default function IaDashboard() {
  const navigate = useNavigate()
  const { salaryRequests } = useData()
  const { roleInfo } = useAuth()

  const pending = salaryRequests.filter((r) => r.status === 'Submitted to GT').length
  const approved = salaryRequests.filter((r) => /approv|disburs/i.test(r.status)).length

  return (
    <Box>
      <GreetingBanner
        date="Monday, 22 June 2026"
        greeting={roleInfo.user.title}
        subtitle="Raise BSE salary disbursement requests, attach invoices, and track their approval by the GT field team."
        badge="Industry Association"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/ia/requests/new')}
            sx={{ bgcolor: 'common.white', color: 'primary.dark', '&:hover': { bgcolor: 'grey.100' } }}>
            New Request
          </Button>
        }
      />

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 4 }}><StatCard icon="money" value={salaryRequests.length} label="Total requests" accent="primary" /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><StatCard icon="clock" value={pending} label="Awaiting GT approval" accent="warning" /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><StatCard icon="shield" value={approved} label="Approved / disbursed" accent="success" /></Grid>
      </Grid>

      <Box mt={2.5}>
        <SectionCard title="Recent requests" action={<Button size="small" endIcon={<EastIcon />} onClick={() => navigate('/ia/requests')}>All requests</Button>}>
          <Stack divider={<Divider />}>
            {salaryRequests.slice(0, 5).map((r) => (
              <Stack key={r.id} direction="row" alignItems="center" spacing={2} sx={{ py: 1.5 }}>
                <Avatar variant="rounded" sx={{ bgcolor: 'primary.light', color: 'primary.dark', width: 40, height: 40 }}><PaymentsOutlinedIcon fontSize="small" /></Avatar>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography fontWeight={600} fontSize="0.92rem">BSE Salary — {r.bse} · {r.month} · {inr(r.amount)}</Typography>
                  <Typography variant="body2" color="text.secondary">{r.id} · Invoice {r.invoiceNo} · {r.date}</Typography>
                </Box>
                <StatusChip status={r.status} />
              </Stack>
            ))}
          </Stack>
        </SectionCard>
      </Box>
    </Box>
  )
}
