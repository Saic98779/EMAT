import { useNavigate } from 'react-router-dom'
import { Box, Grid, Stack, Typography, Button, Divider, Avatar } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import { StatCard, SectionCard, GreetingBanner, StatusChip } from '../../components/shared'
import { manpowerProfile } from '../../data'
import { useData } from '../../store'
import { useAuth } from '../../auth'

const inr = (n) => '₹' + (n || 0).toLocaleString('en-IN')

export default function MpaDashboard() {
  const navigate = useNavigate()
  const { mpaRequests } = useData()
  const { roleInfo } = useAuth()

  const remaining = manpowerProfile.sanctioned_amount - manpowerProfile.disbursed_till_date
  const pending = mpaRequests.filter((r) => /submitted|review/i.test(r.status)).length

  return (
    <Box>
      <GreetingBanner
        date="Wednesday, 22 July 2026"
        greeting={roleInfo.user.title}
        subtitle="Raise BSE salary disbursement requests. Requests route to the SIDBI HO Maker for review."
        badge="Manpower Agency"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/mpa/disburse')}
            sx={{ bgcolor: 'common.white', color: 'primary.dark', '&:hover': { bgcolor: 'grey.100' } }}>
            New Disbursement
          </Button>
        }
      />

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 4 }}><StatCard icon="money" value={inr(manpowerProfile.sanctioned_amount)} label="Sanctioned" accent="primary" /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><StatCard icon="shield" value={inr(manpowerProfile.disbursed_till_date)} label="Disbursed till date" accent="success" /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><StatCard icon="clock" value={inr(remaining)} label="Balance available" accent="warning" /></Grid>
      </Grid>

      <Box mt={2.5}>
        <SectionCard title="Recent requests" action={pending > 0 && <Typography variant="caption" color="warning.dark">{pending} awaiting HO Maker</Typography>}>
          {mpaRequests.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No requests raised yet. Click “New Disbursement” to start.</Typography>
          ) : (
            <Stack divider={<Divider />}>
              {mpaRequests.slice(0, 5).map((r) => (
                <Stack key={r.id} direction="row" alignItems="center" spacing={2} sx={{ py: 1.5 }}>
                  <Avatar variant="rounded" sx={{ bgcolor: 'primary.light', color: 'primary.dark', width: 40, height: 40 }}><PaymentsOutlinedIcon fontSize="small" /></Avatar>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography fontWeight={600} fontSize="0.92rem">{r.bses} BSE(s) · {r.month} · sought {inr(r.sought)}</Typography>
                    <Typography variant="body2" color="text.secondary">{r.id} · Invoice {r.invoiceNo} · raised {r.date}</Typography>
                  </Box>
                  <StatusChip status={r.status} />
                </Stack>
              ))}
            </Stack>
          )}
        </SectionCard>
      </Box>
    </Box>
  )
}
