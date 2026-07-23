import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Grid, Stack, Typography, Avatar, ToggleButtonGroup, ToggleButton,
  TextField, Button, Card, CardContent, List, ListItemButton, ListItemText,
  Divider, Chip,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import LoginIcon from '@mui/icons-material/Login'
import Logo from '../components/Logo'
import sidbiLogo from '../assets/sidbi-logo.png'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import GppGoodOutlinedIcon from '@mui/icons-material/GppGoodOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import EastIcon from '@mui/icons-material/East'
import { useAuth } from '../auth'
import { DEMO_CREDS } from '../data'
import { monoFont } from '../theme'

const STEPS = [
  { icon: DescriptionOutlinedIcon, label: 'Capture' },
  { icon: GppGoodOutlinedIcon, label: 'Appraise' },
  { icon: PaymentsOutlinedIcon, label: 'Disburse' },
]

const ROLE_TABS = [
  { key: 'gt', tag: 'Field', label: 'GT Team' },
  { key: 'sde', tag: 'Appraisal', label: 'SIDBI SDE' },
  { key: 'bse', tag: 'Field', label: 'BSE' },
  { key: 'ia', tag: 'Association', label: 'IA' },
]

function Hero() {
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

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [role, setRole] = useState('gt')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('demo123')

  const submit = () => { login(role); navigate(`/${role}`) }
  const fillDemo = (cred) => { setRole(cred.role); setEmail(cred.email); setPassword('demo123') }

  return (
    <Grid container sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Grid size={{ xs: 12, md: 6 }} sx={{ display: { xs: 'none', md: 'block' } }}><Hero /></Grid>

      <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 2.5, md: 6 } }}>
        <Box sx={{ width: '100%', maxWidth: 430 }}>
          <Typography variant="h4">Sign in</Typography>
          <Typography color="text.secondary" mb={3}>Select your role to continue to the portal.</Typography>

          <ToggleButtonGroup exclusive fullWidth value={role} onChange={(_, v) => v && setRole(v)} sx={{ mb: 3, gap: 1 }}>
            {ROLE_TABS.map((r) => (
              <ToggleButton key={r.key} value={r.key}
                sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 1, px: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: '10px !important' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.62rem', lineHeight: 1.3 }} noWrap>{r.tag}</Typography>
                <Typography fontWeight={700} fontSize="0.82rem" noWrap>{r.label}</Typography>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Stack spacing={2.5}>
            <TextField label="Email" placeholder="name@org.in" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
            <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth />
            <Button size="large" variant="contained" startIcon={<LoginIcon />} onClick={submit} fullWidth>Sign in to eMAT</Button>
          </Stack>

          <Stack direction="row" spacing={1.25} alignItems="center" justifyContent="center" sx={{ mt: 3, color: 'text.secondary' }}>
            <Typography variant="caption" sx={{ letterSpacing: '0.14em' }}>IN ASSOCIATION WITH</Typography>
            <Box component="img" src={sidbiLogo} alt="SIDBI" sx={{ height: 26, width: 'auto', objectFit: 'contain', display: 'block' }} />
          </Stack>

          <Card variant="outlined" sx={{ mt: 3, boxShadow: 'none' }}>
            <CardContent sx={{ py: 1 }}>
              <Typography variant="overline" color="text.secondary">Demo credentials — click to fill</Typography>
              <List disablePadding>
                {DEMO_CREDS.map((c, i) => (
                  <Box key={c.email}>
                    {i > 0 && <Divider component="li" />}
                    <ListItemButton onClick={() => fillDemo(c)} sx={{ px: 1 }}>
                      <ListItemText
                        primary={c.name} secondary={c.email}
                        primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem' }}
                        secondaryTypographyProps={{ sx: { fontFamily: monoFont, fontSize: '0.78rem' } }}
                      />
                      <Chip label="demo123" size="small" variant="outlined" color="primary" />
                    </ListItemButton>
                  </Box>
                ))}
              </List>
            </CardContent>
          </Card>
        </Box>
      </Grid>
    </Grid>
  )
}
