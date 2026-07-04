import { Box, Card, CardContent, Stack, Typography, Avatar } from '@mui/material'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import { PageHeader, StatusChip, Mono } from '../../components/shared'
import { fieldVisits } from '../../data'

export default function MyFieldVisits() {
  return (
    <Box>
      <PageHeader title="My field visits" subtitle="Site visits to Industry Associations and their member units." />
      <Stack spacing={2}>
        {fieldVisits.map((v) => (
          <Card key={v.id}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar variant="rounded" sx={{ bgcolor: 'action.hover', color: 'secondary.main' }}>
                  <LocationOnOutlinedIcon fontSize="small" />
                </Avatar>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="baseline">
                    <Mono sx={{ color: 'secondary.main' }}>{v.id}</Mono>
                    <Typography fontWeight={700}>{v.name}</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">{v.place} · {v.date} · {v.units}</Typography>
                  <Typography variant="body2" color="text.disabled">{v.purpose}</Typography>
                </Box>
                <StatusChip status={v.status} />
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  )
}
