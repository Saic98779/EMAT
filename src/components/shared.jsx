import {
  Card, CardContent, Chip, Box, Typography, Stack, LinearProgress, Avatar,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import GppGoodOutlinedIcon from '@mui/icons-material/GppGoodOutlined'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined'
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import { monoFont } from '../theme'

export const iconMap = {
  proposal: DescriptionOutlinedIcon,
  money: PaymentsOutlinedIcon,
  action: DescriptionOutlinedIcon,
  clock: AccessTimeOutlinedIcon,
  team: GroupsOutlinedIcon,
  shield: GppGoodOutlinedIcon,
  calendar: CalendarMonthOutlinedIcon,
  route: RouteOutlinedIcon,
  bolt: BoltOutlinedIcon,
}

// Maps a domain status string to a MUI palette color.
export function statusColor(status) {
  const s = status.toLowerCase()
  if (s.includes('approved') || s.includes('disbursed') || s.includes('sanction') || s.includes('completed')) return 'success'
  if (s.includes('reject')) return 'error'
  if (s.includes('change') || s.includes('revise')) return 'secondary'
  if (s.includes('final') || s.includes('sidbi') || s.includes('l2') || s.includes('scheduled') || s.includes('submitted') || s.includes('screened') || s.includes('awaiting')) return 'info'
  if (s.includes('pending') || s.includes('review') || s.includes('action') || s.includes('l1') || s.includes('disburse')) return 'warning'
  return 'default'
}

// Soft-filled chip: light tinted background + dark text.
export function StatusChip({ status, size = 'small' }) {
  const color = statusColor(status)
  if (color === 'default') return <Chip label={status} size={size} variant="outlined" />
  return <Chip label={status} size={size} sx={{ bgcolor: `${color}.light`, color: `${color}.dark`, fontWeight: 700 }} />
}

// Gradient hero header for dashboards.
export function GreetingBanner({ date, greeting, subtitle, action, badge }) {
  return (
    <Card sx={{
      mb: 3, color: 'common.white', position: 'relative', overflow: 'hidden', border: 0,
      background: (t) => `linear-gradient(120deg, ${t.palette.primary.dark} 0%, #0d3a52 55%, ${t.palette.success.dark} 135%)`,
    }}>
      {/* decorative rings */}
      <Box sx={{ position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: '50%', bgcolor: alpha('#fff', 0.06) }} />
      <Box sx={{ position: 'absolute', right: 80, bottom: -90, width: 200, height: 200, borderRadius: '50%', bgcolor: alpha('#fff', 0.05) }} />
      <CardContent sx={{ p: { xs: 3, md: 4 }, position: 'relative' }}>
        <Stack direction="row" justifyContent="space-between" alignItems={{ md: 'center' }} flexWrap="wrap" gap={2}>
          <Box>
            <Stack direction="row" spacing={1.5} alignItems="center" mb={0.5}>
              <Typography variant="overline" sx={{ color: alpha('#fff', 0.7) }}>{date}</Typography>
              {badge && <Chip size="small" label={badge} sx={{ bgcolor: alpha('#fff', 0.16), color: '#fff', fontWeight: 700 }} />}
            </Stack>
            <Typography variant="h4">{greeting}</Typography>
            <Typography sx={{ color: alpha('#fff', 0.78), mt: 0.75, maxWidth: 560 }}>{subtitle}</Typography>
          </Box>
          {action}
        </Stack>
      </CardContent>
    </Card>
  )
}

export function StatCard({ icon, value, label, flag, accent = 'primary', delta }) {
  const Icon = iconMap[icon] || DescriptionOutlinedIcon
  const up = delta?.dir !== 'down'
  return (
    <Card sx={{
      height: '100%', position: 'relative', overflow: 'hidden',
      transition: 'transform .2s, box-shadow .2s',
      '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 10px 30px rgba(15,23,42,0.10)' },
    }}>
      <Box sx={{ position: 'absolute', inset: 0, background: (t) => `linear-gradient(135deg, ${alpha(t.palette[accent].main, 0.07)}, transparent 55%)` }} />
      <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, bgcolor: `${accent}.main` }} />
      <CardContent sx={{ position: 'relative', pl: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Avatar variant="rounded" sx={{ bgcolor: `${accent}.light`, color: `${accent}.dark`, width: 44, height: 44 }}>
            <Icon fontSize="small" />
          </Avatar>
          {flag && (
            <Chip size="small" label={flag}
              sx={{ bgcolor: flag === 'action due' ? 'warning.light' : 'secondary.light', color: flag === 'action due' ? 'warning.dark' : 'secondary.dark', fontWeight: 700 }} />
          )}
        </Stack>
        <Typography variant="h4" fontWeight={700}>{value}</Typography>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
        </Stack>
        {delta && (
          <Stack direction="row" alignItems="center" spacing={0.5} mt={1}
            sx={{ color: up ? 'success.main' : 'error.main' }}>
            {up ? <TrendingUpIcon sx={{ fontSize: 16 }} /> : <TrendingDownIcon sx={{ fontSize: 16 }} />}
            <Typography variant="caption" fontWeight={700}>{delta.text}</Typography>
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}

export function PageHeader({ overline, title, subtitle, action }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2} mb={3}>
      <Box>
        {overline && <Typography variant="overline" color="text.secondary">{overline}</Typography>}
        <Typography variant="h4">{title}</Typography>
        {subtitle && <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, maxWidth: 620 }}>{subtitle}</Typography>}
      </Box>
      {action}
    </Stack>
  )
}

export function SectionCard({ title, subtitle, action, children, sx }) {
  return (
    <Card sx={{ height: '100%', ...sx }}>
      <CardContent sx={{ p: 3 }}>
        {(title || action) && (
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={subtitle ? 0.5 : 2}>
            <Typography variant="h6">{title}</Typography>
            {action}
          </Stack>
        )}
        {subtitle && <Typography variant="body2" color="text.secondary" mb={2}>{subtitle}</Typography>}
        {children}
      </CardContent>
    </Card>
  )
}

// A labelled progress row (used for pipeline / throughput breakdowns).
export function StatBars({ rows }) {
  return (
    <Stack spacing={2.2}>
      {rows.map((r) => (
        <Box key={r.label}>
          <Stack direction="row" justifyContent="space-between" mb={0.75}>
            <Typography variant="body2" color="text.secondary">{r.label}</Typography>
            <Typography variant="subtitle2">{r.value}{r.suffix || ''}</Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, (r.value / (r.total || 100)) * 100)}
            color={r.color || 'primary'}
            sx={{ bgcolor: 'action.hover' }}
          />
        </Box>
      ))}
    </Stack>
  )
}

export const Mono = ({ children, sx }) => (
  <Typography component="span" sx={{ fontFamily: monoFont, fontSize: '0.8rem', color: 'text.secondary', ...sx }}>
    {children}
  </Typography>
)
