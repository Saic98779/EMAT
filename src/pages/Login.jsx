import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Grid, Stack, Typography, TextField, Button, Alert, CircularProgress,
} from '@mui/material'
import LoginIcon from '@mui/icons-material/Login'
import AuthHero from '../components/AuthHero'
import { useAuth } from '../auth'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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

        </Box>
      </Grid>
    </Grid>
  )
}
