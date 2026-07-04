import { Box, Grid } from '@mui/material'
import { PageHeader, StatBars, SectionCard } from '../../components/shared'
import { bseStats } from '../../data'
import AttendanceCalendar from './AttendanceCalendar'

export default function BseAttendance() {
  return (
    <Box>
      <PageHeader title="Attendance" subtitle="Field-visit & branch days for the current cycle, tracked daily." />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 8 }}>
          <SectionCard title="June 2026" subtitle="Tap a day to view the logged activity.">
            <AttendanceCalendar />
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SectionCard title="This month" subtitle="Jun 1 – Jun 22, 2026">
            <StatBars rows={bseStats.attendanceMonth} />
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  )
}
