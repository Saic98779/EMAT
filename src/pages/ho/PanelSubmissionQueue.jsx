import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert, Box, Button, Chip, CircularProgress, IconButton, InputAdornment,
  Stack, TextField, Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import { PageHeader, Mono } from '../../components/shared'
import { useBseList } from '../../queries'

// PanelSubmissionQueue
// ────────────────────────────────────────────────────────────────────────
// Dedicated workspace for whoever handles panel approval letter uploads
// (typically the committee coordinator, not the HO Maker who ran the
// committee itself). Lists BSE candidates where the committee has
// recorded a decision but the signed panel approval letter is still
// pending upload. Row click opens the per-candidate upload page.
//
// Filter is purely status-driven — no need to expose the intermediate
// stages here (that's what HoBseReview is for). Keeps this surface
// laser-focused on "upload the letter, save, done."

function needsPanelUpload(r) {
  const dto = r.raw || r
  return !!dto.committeeRecommendation && !dto.committeeMom
}

export default function PanelSubmissionQueue() {
  const theme = useTheme()
  const navigate = useNavigate()
  const { data: all = [], isLoading, isFetching, error, refetch } = useBseList()
  const [q, setQ] = useState('')

  const rows = useMemo(() => all.filter(needsPanelUpload), [all])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((r) => (
      (r.name || '').toLowerCase().includes(term) ||
      (r.ia || '').toLowerCase().includes(term) ||
      (r.email || '').toLowerCase().includes(term)
    ))
  }, [rows, q])

  const initialLoading = isLoading && all.length === 0

  return (
    <Box sx={{ maxWidth: 1120, mx: 'auto', pb: 6 }}>
      <PageHeader
        overline="BSE · Panel submission"
        title="Panel Submissions"
        subtitle="Candidates whose committee has decided — upload the signed panel approval letter here."
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mt: 2.5, mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search by candidate, IA or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ maxWidth: 360, flex: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />
        <Box sx={{ flex: 1 }} />
        <IconButton
          size="small"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh"
          sx={{ border: 1, borderColor: alpha(theme.palette.text.primary, 0.14) }}
        >
          {isFetching ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
        </IconButton>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error.message || 'Failed to load candidates.'}</Alert>
      )}

      {initialLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress size={24} /></Box>
      ) : filtered.length === 0 ? (
        <EmptyState anyRows={rows.length > 0} query={q} />
      ) : (
        <Stack spacing={1.25}>
          {filtered.map((r) => <PanelRow key={r.id} row={r} onClick={() => navigate(`/sde/panel-submissions/${r.id}`)} />)}
        </Stack>
      )}
    </Box>
  )
}

function PanelRow({ row, onClick }) {
  const theme = useTheme()
  const dto = row.raw || {}
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      sx={{
        display: 'block', cursor: 'pointer',
        borderRadius: 2, border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        bgcolor: '#fff',
        px: 2.25, py: 1.75,
        transition: 'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease',
        '&:hover': {
          borderColor: alpha(theme.palette.primary.main, 0.35),
          boxShadow: `0 6px 20px ${alpha(theme.palette.text.primary, 0.06)}`,
          transform: 'translateY(-1px)',
        },
        '&:focus-visible': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: 2,
        },
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.005em',
              color: theme.palette.text.primary,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {row.name || '—'}
          </Typography>
          <Stack direction="row" alignItems="center" spacing={0.5} flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
            {row.ia && row.ia !== '—' && (
              <Chip
                label={<><Box component="span" sx={{ color: theme.palette.text.disabled, mr: 0.5 }}>IA</Box>{row.ia}</>}
                size="small"
                sx={{
                  height: 20, fontSize: 12,
                  bgcolor: alpha(theme.palette.text.primary, 0.04),
                  color: theme.palette.text.primary,
                  '.MuiChip-label': { px: 1 },
                }}
              />
            )}
            <Chip
              label={<><Box component="span" sx={{ color: theme.palette.text.disabled, mr: 0.5 }}>Committee</Box>{dto.committeeRecommendation}</>}
              size="small"
              color={dto.committeeRecommendation === 'Recommended' ? 'success' : 'default'}
              variant="outlined"
              sx={{ height: 20, fontSize: 12, fontWeight: 600, '.MuiChip-label': { px: 1 } }}
            />
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.75 }}>
            <AccessTimeRoundedIcon sx={{ fontSize: 12, color: theme.palette.text.disabled }} />
            <Typography sx={{ fontSize: 11.5, color: theme.palette.text.disabled }}>
              Committee decision {dto.committeeDate || '—'} · <Mono>{row.email || '—'}</Mono>
            </Typography>
          </Stack>
        </Box>

        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexShrink: 0 }}>
          <Chip
            size="small"
            color="warning"
            icon={<DescriptionOutlinedIcon sx={{ fontSize: 14 }} />}
            label="Letter pending"
            sx={{ fontWeight: 600 }}
          />
          <ArrowForwardRoundedIcon sx={{ fontSize: 16, color: theme.palette.text.disabled }} />
        </Stack>
      </Stack>
    </Box>
  )
}

function EmptyState({ anyRows, query }) {
  const theme = useTheme()
  const copy = query.trim()
    ? { title: 'No matches', body: 'Try a different search term.' }
    : anyRows
      ? { title: 'Nothing pending', body: 'Every candidate with a committee decision has their panel letter on file.' }
      : { title: 'Nothing pending', body: 'You\'ll see BSE candidates here once their committee has decided and the letter is due.' }
  return (
    <Box
      sx={{
        border: 1, borderColor: alpha(theme.palette.text.primary, 0.09),
        borderRadius: 2, bgcolor: '#fff', textAlign: 'center',
        py: 6, px: 3,
      }}
    >
      <Box
        sx={{
          width: 44, height: 44, borderRadius: '50%', mx: 'auto', mb: 1.5,
          display: 'grid', placeItems: 'center',
          bgcolor: alpha(theme.palette.text.primary, 0.05),
          color: theme.palette.text.disabled,
        }}
      >
        <DescriptionOutlinedIcon />
      </Box>
      <Typography sx={{ fontSize: 15, fontWeight: 700, color: theme.palette.text.primary }}>
        {copy.title}
      </Typography>
      <Typography sx={{ mt: 0.5, fontSize: 13, color: theme.palette.text.secondary, maxWidth: 460, mx: 'auto' }}>
        {copy.body}
      </Typography>
    </Box>
  )
}
