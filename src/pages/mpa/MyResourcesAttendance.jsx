import { useMemo, useState } from 'react'
import {
  Box, Card, Table, TableHead, TableBody, TableRow, TableCell, Typography,
  Alert, TextField, MenuItem, Chip, Stack,
} from '@mui/material'
import ConstructionIcon from '@mui/icons-material/Construction'
import { PageHeader, Mono } from '../../components/shared'
import { useAuth } from '../../auth'
import { useBseByUserSelected } from '../../queries'

// Vendor / Consultancy — "View Attendance of My Resources".
// Per spec: build the menu + basic structure now, real attendance data comes
// in a later phase. The month picker and resource list are wired against the
// same vendor-selected endpoint MyResources uses, but the "Working Days"
// column is stubbed until the attendance API lands.

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]

export default function MyResourcesAttendance() {
  const { user } = useAuth()
  const bsesQ = useBseByUserSelected(user?.userId)

  const [month, setMonth] = useState(() => MONTHS[new Date().getMonth()])
  const [year, setYear] = useState(CURRENT_YEAR)

  const rows = useMemo(() => bsesQ.data || [], [bsesQ.data])

  return (
    <Box>
      <PageHeader
        title="Attendance of My Resources"
        subtitle="Working days recorded for each BSE this month."
      />

      <Alert
        severity="info"
        icon={<ConstructionIcon />}
        sx={{ mb: 2.5 }}
      >
        <Typography fontWeight={700}>Coming soon</Typography>
        <Typography variant="body2">
          The attendance dashboard is on the roadmap. Until then, this page shows the
          list of your resources — the Working Days column will populate once the
          attendance API is live.
        </Typography>
      </Alert>

      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          select size="small" label="Month" value={month}
          onChange={(e) => setMonth(e.target.value)} sx={{ minWidth: 160 }}
        >
          {MONTHS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
        </TextField>
        <TextField
          select size="small" label="Year" value={year}
          onChange={(e) => setYear(Number(e.target.value))} sx={{ minWidth: 120 }}
        >
          {YEARS.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
        </TextField>
      </Stack>

      <Card>
        <Table sx={{ '& tbody tr:last-of-type td': { border: 0 } }}>
          <TableHead>
            <TableRow>
              <TableCell width={72}>S.No</TableCell>
              <TableCell>IA Name</TableCell>
              <TableCell>Resource Name</TableCell>
              <TableCell>Mob No</TableCell>
              <TableCell>Working Days</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">No resources assigned yet.</Typography>
                </TableCell>
              </TableRow>
            )}
            {rows.map((r, i) => (
              <TableRow key={r.uuid} hover>
                <TableCell><Mono>{i + 1}</Mono></TableCell>
                <TableCell>{r.industryAssociationName || '—'}</TableCell>
                <TableCell>{r.bseName || '—'}</TableCell>
                <TableCell><Mono>{r.mobileNumber || '—'}</Mono></TableCell>
                <TableCell>
                  <Chip size="small" variant="outlined" label="Coming soon" sx={{ color: 'text.disabled' }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </Box>
  )
}
