import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Grid, Stack, Typography, TextField, Button, Alert, CircularProgress,
  Card, CardContent, List, ListItemButton, ListItemText, Divider, Chip,
} from '@mui/material'
import LoginIcon from '@mui/icons-material/Login'
import AuthHero from '../components/AuthHero'
import { useAuth } from '../auth'
import { monoFont } from '../theme'

// Demo accounts shown as a click-to-fill list under the sign-in form. Kept
// inline (not in data.js) because it's a dev-only convenience and the roster
// changes with backend seed data — treat this list as configuration, not code.
const DEMO_CREDS = [
  // Only GT Field Team + SIDBI SDE are wired end-to-end against the live
  // backend right now. Other roles are commented out until seed data /
  // backend endpoints for them are ready.
  { role: 'GT Field Team', username: 'Ravikant.Rai@IN.GT.COM', password: 'Password@123' },
  { role: 'GT PMU', username: 'gt_pmu', password: 'Password@123' },
  { role: 'SIDBI SDE', username: 'pushpendrat@sidbi.in', password: 'Password@123' },
  { role: 'Cluster Expert', username: 'cluster_expert', password: 'Password@123' },
  { role: 'SIDBI HO Maker', username: 'sidbi_ho_maker', password: 'Password@123' },
  { role: 'Manpower Agency', username: 'manpower_agency11', password: 'Password@123' },
  { role: 'BSE', username: 'bse_user', password: 'Password@123' },
  // { role: 'SIDBI RO', username: 'sidbi_ro', password: 'Password@123' },
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const fillDemo = (cred) => {
    setUsername(cred.username)
    setPassword(cred.password)
    setError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setError('')
    if (!username.trim() || !password) { setError('Enter your username and password.'); return }
    setBusy(true)
    try {
      const data = await login(username.trim(), password)
      navigate(`/${data.role}`)
    } catch (err) {
      setError(err.message || 'Sign-in failed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Grid container sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Grid size={{ xs: 12, md: 6 }} sx={{ display: { xs: 'none', md: 'block' } }}><AuthHero /></Grid>

      <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 2.5, md: 6 } }}>
        <Box component="form" onSubmit={submit} sx={{ width: '100%', maxWidth: 430 }}>
          <Typography variant="h4">Sign in</Typography>
          <Typography color="text.secondary" mb={3}>Enter your credentials to continue to the portal.</Typography>

          <Stack spacing={2.5}>
            <TextField
              name="username"
              label="Username"
              placeholder="your.username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              disabled={busy}
              fullWidth
            />
            <TextField
              name="password"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={busy}
              fullWidth
            />
            {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
            <Button
              type="submit"
              size="large"
              variant="contained"
              startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <LoginIcon />}
              disabled={busy}
              fullWidth
            >
              {busy ? 'Signing in…' : 'Sign in to eMAT'}
            </Button>
          </Stack>

          <Card variant="outlined" sx={{ mt: 3, boxShadow: 'none' }}>
            <CardContent sx={{ py: 1 }}>
              <Typography variant="overline" color="text.secondary">
                Demo credentials — click to fill
              </Typography>
              <List disablePadding>
                {DEMO_CREDS.map((c, i) => (
                  <Box key={c.username}>
                    {i > 0 && <Divider component="li" />}
                    <ListItemButton onClick={() => fillDemo(c)} disabled={busy} sx={{ px: 1 }}>
                      <ListItemText
                        primary={c.role}
                        secondary={c.username}
                        primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem' }}
                        secondaryTypographyProps={{ sx: { fontFamily: monoFont, fontSize: '0.78rem' } }}
                      />
                      <Chip label={c.password} size="small" variant="outlined" color="primary" />
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
