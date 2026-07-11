import { useNavigate } from 'react-router-dom'
import { Box, Grid, Card, CardContent, Stack, Typography, Avatar, Button } from '@mui/material'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import { PageHeader } from '../../components/shared'
import { bseTeam } from '../../data'

export default function BseTeam() {
  const navigate = useNavigate()
  return (
    <Box>
      <PageHeader
        title="BSE team"
        subtitle="Business Support Executives reporting to your field team."
        action={<Button variant="contained" startIcon={<PaymentsOutlinedIcon />} onClick={() => navigate('/gt/team/salary')}>Disburse Salary</Button>}
      />
      <Grid container spacing={2.5}>
        {bseTeam.map((m) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={m.name}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center" mb={2.5}>
                  <Avatar sx={{ bgcolor: 'secondary.main', width: 44, height: 44 }}>{m.initials}</Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography fontWeight={700}>{m.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{m.region}</Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={1.5}>
                  {[{ v: m.visits, l: 'Visits (MTD)' }, { v: m.open, l: 'Open requests' }].map((x) => (
                    <Box key={x.l} sx={{ flex: 1, bgcolor: 'background.default', borderRadius: 2, p: 1.5 }}>
                      <Typography variant="h5">{x.v}</Typography>
                      <Typography variant="caption" color="text.secondary">{x.l}</Typography>
                    </Box>
                  ))}
                </Stack>
                <Button size="small" fullWidth variant="outlined" startIcon={<PaymentsOutlinedIcon />} sx={{ mt: 2 }}
                  onClick={() => navigate('/gt/team/salary')}>
                  Disburse salary
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
