import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Grid, Card, CardContent, Stack, Typography, Avatar, Button,
  CircularProgress, Alert, Chip, TextField, InputAdornment,
} from '@mui/material'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import { PageHeader } from '../../components/shared'
import { useData } from '../../store'
import { searchBseRecommendations, fromDto as bseFromDto } from '../../apis/bseRecommendations'

// Initials from the candidate's display name — fallback to "?" so we never
// render an empty Avatar.
function initialsOf(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

// Header colour code for the BSE's current pipeline status. Values match
// `statusFrom()` in apis/bseRecommendations.js.
function statusColor(status) {
  switch (status) {
    case 'Onboarded': return 'success'
    case 'Committee reviewed': return 'info'
    case 'HO reviewed': return 'info'
    case 'PMU reviewed': return 'warning'
    case 'Proposed by GT': return 'primary'
    default: return 'default'
  }
}

export default function BseTeam() {
  const navigate = useNavigate()
  const {
    bseCandidates,
    bseCandidatesLoading,
    bseCandidatesError,
    refreshBseCandidates,
  } = useData()

  useEffect(() => {
    const ctrl = new AbortController()
    refreshBseCandidates({ signal: ctrl.signal })
    return () => ctrl.abort()
  }, [refreshBseCandidates])

  // Backend-driven search. Empty query → use the store's full list.
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null) // null = no active search
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setSearchResults(null)
      setSearchError('')
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setSearching(true)
      setSearchError('')
      try {
        const data = await searchBseRecommendations(q, { signal: ctrl.signal })
        const list = Array.isArray(data)
          ? data
          : (Array.isArray(data?.content) ? data.content
            : (Array.isArray(data?.items) ? data.items : []))
        setSearchResults(list.map(bseFromDto))
      } catch (err) {
        if (err.name === 'AbortError') return
        setSearchError(err.message || 'Search failed')
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [query])

  const visible = useMemo(
    () => (searchResults != null ? searchResults : bseCandidates),
    [searchResults, bseCandidates],
  )

  return (
    <Box>
      <PageHeader
        title="BSE team"
        subtitle="Business Support Executives reporting to your field team."
        action={
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              startIcon={<PersonAddAlt1OutlinedIcon />}
              onClick={() => navigate('/gt/team/candidate/new')}
            >
              Propose BSE
            </Button>
            <Button
              variant="contained"
              startIcon={<PaymentsOutlinedIcon />}
              onClick={() => navigate('/gt/team/salary')}
            >
              Disburse Salary
            </Button>
          </Stack>
        }
      />

      <TextField
        fullWidth
        size="small"
        placeholder="Search BSE candidates by name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              {searching ? <CircularProgress size={18} /> : <SearchIcon fontSize="small" />}
            </InputAdornment>
          ),
          endAdornment: query ? (
            <InputAdornment position="end">
              <Button size="small" onClick={() => setQuery('')} startIcon={<ClearIcon />}>Clear</Button>
            </InputAdornment>
          ) : null,
        }}
      />

      {(bseCandidatesError || searchError) && (
        <Alert severity="error" sx={{ mb: 2 }}>{searchError || bseCandidatesError}</Alert>
      )}

      {(bseCandidatesLoading || searching) && visible.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary">
              {query
                ? `No BSE candidates match “${query}”.`
                : 'No BSE candidates yet. Propose one to get started.'}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2.5}>
          {visible.map((m) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={m.uuid || m.id}>
              <Card
                sx={{ height: '100%', cursor: 'pointer', transition: 'box-shadow .15s', ':hover': { boxShadow: 4 } }}
                onClick={() => navigate(`/gt/team/${m.uuid}`)}
              >
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                    <Avatar sx={{ bgcolor: 'secondary.main', width: 44, height: 44 }}>
                      {initialsOf(m.name)}
                    </Avatar>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography fontWeight={700} noWrap>{m.name}</Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>{m.ia}</Typography>
                    </Box>
                    <Chip size="small" color={statusColor(m.status)} label={m.status} />
                  </Stack>

                  <Stack direction="row" spacing={1.5}>
                    <Stat label="Qualification" value={m.qualification} />
                    <Stat label="Experience" value={m.experience} />
                  </Stack>

                  <Stack direction="row" spacing={1.5} mt={1.5}>
                    <Stat label="Expected salary" value={m.expectedSalary ? `₹${m.expectedSalary}` : '—'} />
                    <Stat label="Recommendation" value={m.recommendation} />
                  </Stack>

                  <Button
                    size="small"
                    fullWidth
                    variant="outlined"
                    startIcon={<PaymentsOutlinedIcon />}
                    sx={{ mt: 2 }}
                    onClick={(e) => { e.stopPropagation(); navigate('/gt/team/salary') }}
                  >
                    Disburse salary
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  )
}

function Stat({ label, value }) {
  return (
    <Box sx={{ flex: 1, bgcolor: 'background.default', borderRadius: 2, p: 1.5, minWidth: 0 }}>
      <Typography variant="body2" fontWeight={600} noWrap>{value ?? '—'}</Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Box>
  )
}
