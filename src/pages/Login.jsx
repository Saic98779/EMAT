import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Grid, Stack, Typography, TextField, Button, Alert, CircularProgress,
  IconButton, Tooltip,
} from '@mui/material'
import LoginIcon from '@mui/icons-material/Login'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import { alpha, useTheme } from '@mui/material/styles'
import AuthHero from '../components/AuthHero'
import { useAuth } from '../auth'
import { fetchCaptcha } from '../apis/captcha'

// Login
// ────────────────────────────────────────────────────────────────────────
// Sign-in form with backend-driven captcha. Flow:
//   1. On mount → GET /captcha, cache { captchaId, image }.
//   2. Show the image next to a "type the text you see" input.
//   3. On submit → POST /users/login { username, password, captchaId,
//      captchaAnswer }. Backend validates captcha (single-use, ~2 min
//      TTL) before touching the password check.
//   4. On failure → refetch a new captcha automatically; the previous
//      one is spent even if the failure was a wrong password.
//   5. Refresh button lets the user request a new challenge if the
//      current image is unreadable.
export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const theme = useTheme()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [captchaAnswer, setCaptchaAnswer] = useState('')
  const [captcha, setCaptcha] = useState(null) // { captchaId, image }
  const [captchaLoading, setCaptchaLoading] = useState(false)
  const [captchaError, setCaptchaError] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Abort in-flight captcha fetches when the user hits refresh mid-load
  // or when the component unmounts. Otherwise a stale response can
  // overwrite the freshly-requested one.
  const captchaAbortRef = useRef(null)

  const loadCaptcha = useCallback(async () => {
    if (captchaAbortRef.current) captchaAbortRef.current.abort()
    const ctrl = new AbortController()
    captchaAbortRef.current = ctrl
    setCaptchaLoading(true)
    setCaptchaError('')
    setCaptchaAnswer('')
    try {
      const data = await fetchCaptcha({ signal: ctrl.signal })
      if (ctrl.signal.aborted) return
      setCaptcha({ captchaId: data.captchaId, image: data.image })
    } catch (err) {
      if (ctrl.signal.aborted) return
      setCaptchaError(err.message || 'Failed to load captcha. Try Refresh.')
      setCaptcha(null)
    } finally {
      if (!ctrl.signal.aborted) setCaptchaLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCaptcha()
    return () => {
      if (captchaAbortRef.current) captchaAbortRef.current.abort()
    }
  }, [loadCaptcha])

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setError('')
    if (!username.trim() || !password) {
      setError('Enter your username and password.')
      return
    }
    if (!captcha?.captchaId) {
      setError('Captcha still loading — please wait a moment.')
      return
    }
    if (!captchaAnswer.trim()) {
      setError('Type the text shown in the captcha image.')
      return
    }
    setBusy(true)
    try {
      const data = await login(username.trim(), password, {
        id: captcha.captchaId,
        answer: captchaAnswer.trim(),
      })
      navigate(`/${data.role}`)
    } catch (err) {
      setError(err.message || 'Sign-in failed. Try again.')
      // Captcha is single-use — always refetch after a failed attempt so
      // the user gets a fresh challenge to try again with.
      loadCaptcha()
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

            {/* Captcha — image on the left (dominant), answer input + refresh
                on the right. Kept in a single row on desktop so it doesn't
                push the submit button off-screen; stacks on very narrow
                viewports via the responsive direction. */}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              alignItems={{ sm: 'stretch' }}
            >
              <Box
                sx={{
                  width: { xs: '100%', sm: 168 },
                  height: 64,
                  border: 1,
                  borderColor: alpha(theme.palette.text.primary, 0.15),
                  borderRadius: 1,
                  overflow: 'hidden',
                  background: alpha(theme.palette.text.primary, 0.025),
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                {captchaLoading && !captcha ? (
                  <CircularProgress size={20} />
                ) : captcha?.image ? (
                  <Box
                    component="img"
                    src={captcha.image}
                    alt="Captcha challenge"
                    sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                    {captchaError || 'Loading…'}
                  </Typography>
                )}
              </Box>

              <TextField
                name="captchaAnswer"
                label="Captcha"
                placeholder="Type the text above"
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value)}
                disabled={busy || captchaLoading}
                autoComplete="off"
                inputProps={{
                  autoCapitalize: 'characters',
                  autoCorrect: 'off',
                  spellCheck: 'false',
                }}
                fullWidth
              />

              <Tooltip title="Refresh captcha" arrow>
                <span>
                  <IconButton
                    onClick={loadCaptcha}
                    disabled={busy || captchaLoading}
                    aria-label="Refresh captcha"
                    sx={{
                      alignSelf: { sm: 'center' },
                      border: 1,
                      borderColor: alpha(theme.palette.text.primary, 0.15),
                      borderRadius: 1,
                    }}
                  >
                    {captchaLoading
                      ? <CircularProgress size={16} />
                      : <RefreshRoundedIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>

            {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
            <Button
              type="submit"
              size="large"
              variant="contained"
              startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <LoginIcon />}
              disabled={busy || captchaLoading}
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
