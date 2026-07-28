import { memo } from 'react'
import { Box, Stack, Typography, Avatar } from '@mui/material'
import { alpha } from '@mui/material/styles'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import GppGoodOutlinedIcon from '@mui/icons-material/GppGoodOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import EastIcon from '@mui/icons-material/East'
import Logo from './Logo'
import sidbiLogo from '../assets/sidbi-logo.png'

// The dark gradient hero used on the sign-in page. Kept as its own component
// so heavy sx callbacks / icons don't re-render on every form keystroke.
const STEPS = [
  { icon: DescriptionOutlinedIcon, label: 'Capture' },
  { icon: GppGoodOutlinedIcon, label: 'Appraise' },
  { icon: PaymentsOutlinedIcon, label: 'Disburse' },
]

// memo() with no prop comparator: since this component takes no props, it
// renders exactly once and is skipped on every subsequent parent re-render —
// so the form's per-keystroke state changes don't drag this subtree along.
function AuthHero() {
  return (
    <Box sx={{
      height: '100%', minHeight: { md: '100vh' }, p: { xs: 4, md: 7 }, color: 'common.white',
      display: 'flex', flexDirection: 'column',
      background: (t) => `linear-gradient(150deg, ${t.palette.primary.dark} 0%, #0b1e46 55%, ${t.palette.secondary.dark} 130%)`,
    }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box sx={{ bgcolor: '#fff', borderRadius: 2, p: 0.75, display: 'flex' }}><Logo size={44} /></Box>
        <Box>
          <Typography fontWeight={800} fontSize="1.35rem" lineHeight={1}>eMAT</Typography>
          <Typography variant="caption" sx={{ letterSpacing: '0.22em', color: alpha('#fff', 0.6) }}>PORTAL</Typography>
        </Box>
        <Box sx={{ height: 44, width: '1px', bgcolor: alpha('#fff', 0.25), mx: 1.5 }} />
        <Box sx={{ bgcolor: '#fff', borderRadius: 2, p: 0.25, display: 'flex' }}>
          <Box component="img" src={sidbiLogo} alt="SIDBI" sx={{ height: 54, width: 'auto', objectFit: 'contain', display: 'block' }} />
        </Box>
      </Stack>

      <Box sx={{ mt: 'auto' }}>
        <Typography variant="overline" sx={{ color: alpha('#fff', 0.65) }}>Enterprise Monitoring &amp; Appraisal</Typography>
        <Typography variant="h3" sx={{ mt: 1, mb: 2, maxWidth: 460 }}>
          One platform, from field capture to fund disbursal.
        </Typography>
        <Typography sx={{ color: alpha('#fff', 0.72), maxWidth: 440, mb: 5 }}>
          Industry Association onboarding, multi-level appraisal, and field operations — tracked
          end to end across GT, SIDBI SDE and BSE teams.
        </Typography>

        <Stack direction="row" alignItems="center" spacing={1.5}>
          {STEPS.map((s, i) => (
            <Stack key={s.label} direction="row" alignItems="center" spacing={1.5}>
              <Stack alignItems="center" spacing={1}>
                <Avatar variant="rounded" sx={{ bgcolor: alpha('#fff', 0.12), color: '#fff', width: 46, height: 46 }}>
                  <s.icon fontSize="small" />
                </Avatar>
                <Typography variant="caption" sx={{ color: alpha('#fff', 0.85) }}>{s.label}</Typography>
              </Stack>
              {i < STEPS.length - 1 && <EastIcon sx={{ color: alpha('#fff', 0.3), mb: 3 }} />}
            </Stack>
          ))}
        </Stack>
      </Box>

      <Stack direction="row" spacing={2.5} sx={{ mt: 6, color: alpha('#fff', 0.6), fontSize: '0.8rem', flexWrap: 'wrap' }}>
        {['Secure SSO-ready', 'Audit-trailed', 'RBI-aligned workflow'].map((t) => (
          <Stack key={t} direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'secondary.light' }} />
            <span>{t}</span>
          </Stack>
        ))}
      </Stack>
    </Box>
  )
}

export default memo(AuthHero)
