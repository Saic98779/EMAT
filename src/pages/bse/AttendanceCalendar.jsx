import { Box, Stack, Typography } from '@mui/material'
import { attendanceCalendar } from '../../data'

const DOW = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

const STYLE = {
  visit: { bg: 'success.light', color: 'success.dark', border: 'success.light' },
  branch: { bg: 'info.light', color: 'info.dark', border: 'info.light' },
  weekend: { bg: 'transparent', color: 'text.disabled', border: 'divider' },
  future: { bg: 'transparent', color: 'text.disabled', border: 'divider' },
}

const LEGEND = [
  { label: 'Field visit', color: 'success.main' },
  { label: 'At branch', color: 'info.main' },
  { label: 'Weekend', color: 'action.disabled' },
]

export default function AttendanceCalendar() {
  return (
    <Box>
      <Stack direction="row" spacing={2} justifyContent="flex-end" mb={1.5}>
        {LEGEND.map((l) => (
          <Stack key={l.label} direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: l.color }} />
            <Typography variant="caption" color="text.secondary">{l.label}</Typography>
          </Stack>
        ))}
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {DOW.map((d) => (
          <Typography key={d} variant="caption" align="center" color="text.secondary" fontWeight={700}>{d}</Typography>
        ))}
        {attendanceCalendar.map((c) => {
          const st = STYLE[c.type]
          return (
            <Box key={c.d} sx={{
              aspectRatio: '1 / 1', borderRadius: 2, border: '1px solid', borderColor: st.border,
              bgcolor: st.bg, color: st.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 600, fontSize: '0.9rem', opacity: c.type === 'future' ? 0.4 : 1,
            }}>
              {c.d}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
