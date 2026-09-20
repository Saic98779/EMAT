import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, Stack, Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import { PageHeader } from '../../components/shared'
import { useActionPlan } from '../../queries'
import { StatusPill } from '../checker/CheckerReview'

// ActionPlanView
// ────────────────────────────────────────────────────────────────────────
// Read-only detail of one submitted action plan. Deliberately quiet: no
// accent stripes, no numbered avatars, no icon headers on sub-sections.
// Section titles carry the visual hierarchy; content does the talking.

export default function ActionPlanView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const planQ = useActionPlan(id)
  const dto = planQ.data
  const status = dto?.status || null
  const isRevert = status === 'REVERT'

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', pb: 6 }}>
      <Button
        component={Link}
        to="/gt/action-plans"
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 1, textTransform: 'none', color: 'text.secondary' }}
      >
        Action Plans
      </Button>

      <PageHeader
        overline="Industry Association"
        title="Action plan"
        subtitle="Read-only view of a submitted action plan."
      />

      {planQ.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : planQ.error ? (
        <Alert severity="error" sx={{ mt: 2 }}>{planQ.error.message || 'Failed to load action plan.'}</Alert>
      ) : !dto ? (
        <Box sx={{ mt: 3 }}>
          <Alert severity="warning">Action plan not found.</Alert>
          <Button variant="outlined" onClick={() => navigate('/gt/action-plans')} sx={{ mt: 2, textTransform: 'none' }}>
            Back to list
          </Button>
        </Box>
      ) : (
        <>
          <Header dto={dto} />
          {isRevert && <RevertBanner remarks={dto.remarks} />}
          <ActivitiesList activities={dto.activities || []} />
        </>
      )}
    </Box>
  )
}

// ─── Header card ───────────────────────────────────────────────────────
function Header({ dto }) {
  const theme = useTheme()
  const status = dto?.status || null
  const activityCount = (dto.activities || []).length

  return (
    <Box
      sx={{
        mt: 2,
        borderRadius: 2,
        border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        bgcolor: '#fff',
        px: 3, py: 2.5,
      }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={2}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            sx={{
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '-0.015em',
              color: theme.palette.text.primary,
              lineHeight: 1.25,
            }}
          >
            {dto.industryAssociationName || 'Untitled IA'}
          </Typography>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 0.5 }}>
            <MetaBit label="State" value={dto.state || '—'} />
            <MetaBit label="Activities" value={String(activityCount)} />
            <MetaBit label="Submitted by" value={dto.createdBy || 'Unknown'} />
            <MetaBit label="Submitted on" value={formatDateTime(dto.createdAt) || '—'} />
            {dto.approvedDate && (
              <MetaBit label="Decision on" value={formatDate(dto.approvedDate)} />
            )}
          </Stack>
        </Box>
        <StatusPill status={status} />
      </Stack>
    </Box>
  )
}

function MetaBit({ label, value }) {
  const theme = useTheme()
  return (
    <Stack direction="row" spacing={0.75} alignItems="baseline">
      <Typography sx={{ fontSize: 11.5, color: theme.palette.text.disabled, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: theme.palette.text.primary }}>
        {value}
      </Typography>
    </Stack>
  )
}

// ─── Revert banner ─────────────────────────────────────────────────────
function RevertBanner({ remarks }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        mt: 2, p: 2, borderRadius: 2,
        border: 1,
        borderColor: alpha(theme.palette.warning.main, 0.4),
        bgcolor: alpha(theme.palette.warning.main, 0.05),
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <HistoryRoundedIcon sx={{ fontSize: 20, color: theme.palette.warning.dark, mt: 0.15 }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: theme.palette.warning.dark }}>
            Sent back for changes
          </Typography>
          {remarks
            ? (
              <Typography sx={{ mt: 0.5, fontSize: 13, whiteSpace: 'pre-wrap', color: theme.palette.text.primary }}>
                {remarks}
              </Typography>
            ) : (
              <Typography sx={{ mt: 0.5, fontSize: 12.5, color: theme.palette.text.secondary }}>
                No remarks were left — reach out to the checker for guidance.
              </Typography>
            )}
        </Box>
      </Stack>
    </Box>
  )
}

// ─── Activities ────────────────────────────────────────────────────────
function ActivitiesList({ activities }) {
  const theme = useTheme()
  if (!activities.length) {
    return (
      <Box sx={{ mt: 3, p: 4, borderRadius: 2, border: 1, borderColor: alpha(theme.palette.text.primary, 0.09), bgcolor: '#fff', textAlign: 'center' }}>
        <Typography sx={{ fontSize: 13, color: theme.palette.text.disabled }}>
          No activities were recorded on this plan.
        </Typography>
      </Box>
    )
  }
  return (
    <Stack spacing={2} sx={{ mt: 3 }}>
      {activities.map((a, i) => <ActivityCard key={a.id ?? i} index={i} a={a} />)}
    </Stack>
  )
}

function ActivityCard({ index, a }) {
  const theme = useTheme()
  const name = String(a.nameOfActivity || '').trim() || 'Untitled activity'

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        bgcolor: '#fff',
      }}
    >
      <Box
        sx={{
          px: 3, py: 1.75,
          borderBottom: 1,
          borderColor: alpha(theme.palette.text.primary, 0.06),
        }}
      >
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.palette.text.disabled }}>
          Activity {a.activityNo || index + 1}
        </Typography>
        <Typography sx={{ mt: 0.25, fontSize: 16, fontWeight: 700, letterSpacing: '-0.005em', color: theme.palette.text.primary }}>
          {name}
        </Typography>
      </Box>

      <Box sx={{ px: 3, py: 2.5 }}>
        <ReadRow items={[
          { label: 'Month',                      value: a.monthToBeHeld },
          { label: 'Technical service provider', value: a.technicalServiceProvider },
        ]} span={2} />

        <SectionRule label="Budget" />

        <ReadRow items={[
          { label: 'Total cost',      value: money(a.totalCost) },
          { label: '% SIDBI support', value: pct(a.percentSupportBySidbi) },
          { label: '% Other support', value: pct(a.percentSupportByOthers) },
          { label: '% IA contribution', value: pct(a.percentContributionByIa) },
        ]} span={4} />

        <SectionRule label="Participation" />

        <ReadRow items={[
          { label: 'Members',     value: num(a.expectedParticipantMembers) },
          { label: 'Non-members', value: num(a.expectedParticipantNonMembers) },
        ]} span={2} />

        <SectionRule label="Expected results" />

        <ReadRow items={[
          { label: 'Output',                                   value: a.expectedOutput,                    multiline: true },
          { label: 'Outcome',                                  value: a.expectedOutcome,                   multiline: true },
          { label: 'Income-generating activity (now / future)', value: a.expectedIncomeGeneratingActivity,  multiline: true },
        ]} span={1} />
      </Box>
    </Box>
  )
}

function SectionRule({ label }) {
  const theme = useTheme()
  return (
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ my: 2 }}>
      <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.palette.text.disabled }}>
        {label}
      </Typography>
      <Divider sx={{ flex: 1, borderColor: alpha(theme.palette.text.primary, 0.06) }} />
    </Stack>
  )
}

// items = [{ label, value, multiline }]. `span` chooses columns per row
// (out of 12): 1 = full width, 2 = 2 columns, 4 = 4 columns.
function ReadRow({ items, span = 3 }) {
  const theme = useTheme()
  const cols = Math.max(1, span)
  const width = 12 / cols
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        columnGap: 3, rowGap: 2,
      }}
    >
      {items.map((it, i) => (
        <Box
          key={`${it.label}::${i}`}
          sx={{
            gridColumn: {
              xs: 'span 12',
              sm: it.multiline ? 'span 12' : `span ${Math.min(12, width * 2)}`,
              md: `span ${it.multiline ? 12 : width}`,
            },
          }}
        >
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.palette.text.disabled, mb: 0.5 }}>
            {it.label}
          </Typography>
          {it.value == null || it.value === '' ? (
            <Typography sx={{ fontSize: 13.5, color: theme.palette.text.disabled }}>—</Typography>
          ) : it.multiline ? (
            <Typography sx={{ fontSize: 13.5, whiteSpace: 'pre-wrap', color: theme.palette.text.primary, lineHeight: 1.55 }}>
              {String(it.value)}
            </Typography>
          ) : (
            <Typography sx={{ fontSize: 13.5, color: theme.palette.text.primary }}>
              {String(it.value)}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────
function money(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return `₹ ${n.toLocaleString('en-IN')}`
}

function pct(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return `${round2(n)} %`
}

function num(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return n.toLocaleString('en-IN')
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function formatDate(v) {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(v) {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
