import { useNavigate } from 'react-router-dom'
import { Box, Card, CardContent, Stack, Typography, Button } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { PageHeader, StatusChip, Mono } from '../../components/shared'
import { useData } from '../../store'
import { monoFont } from '../../theme'

const inr = (n) => '₹' + n.toLocaleString('en-IN')

export default function BseDisbursals() {
  const navigate = useNavigate()
  const { disbursals } = useData()
  return (
    <Box>
      <PageHeader
        title="Disbursals"
        subtitle="Your field expense claims. Approved by GT (L1) then SIDBI SDE (L2) before release."
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/bse/disbursals/new')}>Raise Disbursal</Button>}
      />
      <Stack spacing={2}>
        {disbursals.map((d) => (
          <Card key={d.id}>
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                <Box sx={{ minWidth: 96 }}>
                  <Typography variant="h6" fontWeight={800}>{inr(d.amount)}</Typography>
                  <Mono>{d.id}</Mono>
                </Box>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography fontWeight={700} fontSize="0.95rem">{d.title}</Typography>
                  <Typography variant="body2" color="text.secondary">{d.category} · {d.date}</Typography>
                  <Typography sx={{ fontFamily: monoFont, fontSize: '0.78rem', color: 'text.disabled', mt: 0.25 }}>{d.flow}</Typography>
                </Box>
                <StatusChip status={d.status} />
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  )
}
