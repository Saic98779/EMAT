import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Stack, Typography, Button, Chip,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import { PageHeader, StatusChip, Mono } from '../../components/shared'
import { useData } from '../../store'

const inr = (n) => '₹' + n.toLocaleString('en-IN')

export default function IaRequests() {
  const navigate = useNavigate()
  const { salaryRequests } = useData()

  return (
    <Box>
      <PageHeader
        title="BSE Salary Requests"
        subtitle="Disbursement requests you have raised with the GT field team."
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/ia/requests/new')}>New Request</Button>}
      />
      <Stack spacing={2}>
        {salaryRequests.map((r) => (
          <Card key={r.id}>
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                <Box sx={{ minWidth: 110 }}>
                  <Typography variant="h6" fontWeight={800}>{inr(r.amount)}</Typography>
                  <Mono>{r.id}</Mono>
                </Box>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography fontWeight={700} fontSize="0.95rem">BSE Salary — {r.bse} · {r.month}</Typography>
                  <Typography variant="body2" color="text.secondary">{r.agency} · Invoice {r.invoiceNo} · {r.date}</Typography>
                  <Stack direction="row" spacing={0.75} mt={1} flexWrap="wrap">
                    {r.docs.map((d) => (
                      <Chip key={d} size="small" variant="outlined" icon={<DescriptionOutlinedIcon />} label={d} />
                    ))}
                  </Stack>
                </Box>
                <StatusChip status={r.status} />
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  )
}
