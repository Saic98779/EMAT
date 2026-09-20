import { memo, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, IconButton,
  InputAdornment, MenuItem, Snackbar, Stack, Tooltip, Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EventNoteIcon from '@mui/icons-material/EventNote'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import EmojiObjectsOutlinedIcon from '@mui/icons-material/EmojiObjectsOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import { PageHeader } from '../../components/shared'
import {
  PmuSection, FieldRow, FieldCell, RhfTextField, SHRINK_LABEL,
  useForm, useFieldArray, useWatch,
} from '../pmu/_shared'
import { useAuth } from '../../auth'
import {
  useIndustryAssociationsDropdown, useCreateActionPlan,
} from '../../queries'
import {
  blankActivity, MIN_ACTIVITIES, MAX_ACTIVITIES,
} from '../../apis/actionPlans'

// Action Plan (Annexure) — Year-1 activity plan for one Industry Association.
//
// UX shape:
//   1. A prominent "planning for" bar at the top — state chip + IA
//      selector — because everything below is scoped to one IA.
//   2. An activity summary strip (count, total budget, IGA share) so the
//      user always knows at a glance whether they're satisfying the
//      "6 activities / at least 4 IGA" rule.
//   3. Each activity is its own card with a colored left stripe (turns
//      primary once the name is filled) + numbered avatar + delete icon.
//      Fields inside are grouped by intent: Overview → Budget → People →
//      Outcomes, each with an icon micro-header. Budget carries a live
//      stacked bar showing the SIDBI / Others / IA split so the user can
//      see they hit 100% without doing arithmetic.
//
// Perf model: react-hook-form. Every `RhfTextField` is its own Controller
// with its own subscription; typing in activity 3 doesn't touch 1/2/4/5/6.

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const CURRENCY_ADORNMENT = {
  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
}
const PERCENT_ADORNMENT = {
  endAdornment: <InputAdornment position="end">%</InputAdornment>,
}

// Start with a single blank activity — 4 empty cards on mount instantiate
// ~48 RHF Controllers before the user has even seen the page, which is
// what made clicking "New Action Plan" feel slow. The "Add activity"
// button + submit validation still enforce ≥ MIN_ACTIVITIES.
function makeDefaults(activities) {
  const rows = activities?.length ? activities : [blankActivity()]
  return { registrationId: '', activities: rows }
}

export default function ActionPlan() {
  const navigate = useNavigate()
  const theme = useTheme()
  const { user } = useAuth()
  const state = user?.state || ''

  // One tiny call: `/industry-association-registrations/dropdown?state=<X>`
  // returns just what the picker needs. No `useIAs`, no `useActionPlans` —
  // this page is submit-only.
  const iasQ = useIndustryAssociationsDropdown({ state, enabled: !!state })
  const create = useCreateActionPlan()

  const methods = useForm({
    mode: 'onSubmit',
    defaultValues: makeDefaults(),
  })
  const { control, handleSubmit, reset, watch } = methods
  const registrationId = watch('registrationId')

  const iaOptions = useMemo(() => {
    const rows = iasQ.data || []
    return rows
      .map((r) => ({ value: r.id, label: r.name || r.industryAssociationName || String(r.id) }))
      .filter((o) => o.value != null)
      .sort((a, b) => String(a.label).localeCompare(String(b.label)))
  }, [iasQ.data])

  const { fields, append, remove } = useFieldArray({ control, name: 'activities' })

  const [toast, setToast] = useState(null)
  const [problem, setProblem] = useState(null)
  const busy = create.isPending

  const onSubmit = handleSubmit(async (values) => {
    const err = validateWhole({ state, registrationId: values.registrationId, activities: values.activities })
    if (err) { setProblem(err); setToast({ kind: 'warning', msg: err }); return }
    setProblem(null)
    const payload = { state, registrationId: values.registrationId, activities: values.activities }
    try {
      await create.mutateAsync(payload)
      setToast({ kind: 'success', msg: 'Action plan saved.' })
      reset(makeDefaults())
    } catch (e) {
      setToast({ kind: 'error', msg: e?.message || 'Failed to save the action plan.' })
    }
  })

  const activeIa = iaOptions.find((o) => String(o.value) === String(registrationId))

  return (
    <Box sx={{ maxWidth: 1120, mx: 'auto', pb: 12 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(-1)}
        sx={{ mb: 1, textTransform: 'none', color: 'text.secondary' }}
      >
        Back
      </Button>

      <PageHeader
        overline="Industry Association"
        title="Action Plan"
        subtitle="Year-1 activity plan for the Industry Association."
      />

      <RhfProvider methods={methods} onSubmit={onSubmit}>
        {/* ─── Planning-for banner ─── */}
        <PlanForBanner
          state={state}
          iaOptions={iaOptions}
          iasLoading={iasQ.isLoading}
          activeIaLabel={activeIa?.label}
        />

        {/* ─── Activities list ─── */}
        <Stack spacing={2.25} sx={{ mt: 3 }}>
          {fields.map((f, i) => (
            <ActivityCard
              key={f.id}
              index={i}
              onRemove={() => fields.length > MIN_ACTIVITIES && remove(i)}
              removable={fields.length > MIN_ACTIVITIES}
            />
          ))}
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => fields.length < MAX_ACTIVITIES && append(blankActivity())}
            disabled={fields.length >= MAX_ACTIVITIES}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              alignSelf: 'flex-start',
              borderStyle: 'dashed',
              borderWidth: 1.5,
            }}
          >
            Add activity
          </Button>
        </Stack>

        <StickyFooter
          theme={theme}
          problem={problem}
          busy={busy}
          onCancel={() => navigate(-1)}
        />
      </RhfProvider>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert severity={toast.kind} variant="filled" onClose={() => setToast(null)}>
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  )
}

// ─── FormProvider wrapper local to this page ──────────────────────────────
import { FormProvider } from 'react-hook-form'
import { stackedLabelSx } from '../../components/workspace/formStyles'
function RhfProvider({ methods, onSubmit, children }) {
  return (
    <FormProvider {...methods}>
      <Box component="form" onSubmit={onSubmit} noValidate sx={stackedLabelSx}>
        {children}
      </Box>
    </FormProvider>
  )
}

// ─── Planning-for banner ──────────────────────────────────────────────────
// Compact prominent bar: state chip + IA selector + create/update hint.
// Sits above the activities so the reader always knows which IA they're
// planning for even as they scroll.
function PlanForBanner({ state, iaOptions, iasLoading, activeIaLabel }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        mt: 3,
        p: 2.5,
        borderRadius: 2.5,
        border: 1,
        borderColor: alpha(theme.palette.primary.main, 0.18),
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)}, ${alpha(theme.palette.primary.main, 0.01)})`,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Typography
          sx={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: theme.palette.primary.dark,
          }}
        >
          Planning for
        </Typography>
        <Chip
          size="small"
          icon={<LocationOnOutlinedIcon sx={{ fontSize: 14 }} />}
          label={state || 'No state on your profile'}
          sx={{
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            color: theme.palette.primary.dark,
            fontWeight: 600,
            '.MuiChip-icon': { color: theme.palette.primary.dark },
          }}
        />
      </Stack>

      <FieldRow>
        <FieldCell>
          <RhfTextField
            name="registrationId"
            select fullWidth required
            label="Industry Association (IA)"
            rules={{ required: 'Pick the Industry Association.' }}
            disabled={iasLoading}
            helperText={iasLoading
              ? 'Loading associations…'
              : state
                ? `Showing associations mapped to ${state}`
                : 'Showing all associations'}
          >
            {iaOptions.length === 0 && !iasLoading && (
              <MenuItem value="" disabled>
                {state ? `No associations mapped to ${state}` : 'No associations available'}
              </MenuItem>
            )}
            {iaOptions.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </RhfTextField>
        </FieldCell>
      </FieldRow>

      {activeIaLabel && (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ mt: 1.5, color: theme.palette.success.dark }}
        >
          <CheckCircleRoundedIcon sx={{ fontSize: 16 }} />
          <Typography sx={{ fontSize: 13 }}>
            New action plan for <strong>{activeIaLabel}</strong>.
          </Typography>
        </Stack>
      )}
    </Box>
  )
}

// ─── Activity card ────────────────────────────────────────────────────────
// Not memoized — every RhfTextField inside is already its own subscription.
// This wrapper's body runs on card add/remove only.
function ActivityCard({ index, onRemove, removable }) {
  const theme = useTheme()
  const base = `activities.${index}`
  const name = useWatch({ name: `${base}.nameOfActivity` })
  const hasName = String(name || '').trim().length > 0

  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: 2.5,
        border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        bgcolor: '#fff',
        overflow: 'hidden',
      }}
    >
      {/* Left color stripe — tints in once the activity has a name */}
      <Box
        sx={{
          position: 'absolute',
          top: 0, bottom: 0, left: 0,
          width: 4,
          bgcolor: hasName ? theme.palette.primary.main : alpha(theme.palette.text.primary, 0.14),
          transition: 'background-color 150ms ease',
        }}
      />

      <Box sx={{ pl: 3, pr: 2.5, pt: 2.25, pb: 2.5 }}>
        {/* Header — numbered avatar + typed name preview + delete */}
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
          <Box
            sx={{
              width: 30, height: 30, borderRadius: '50%',
              display: 'grid', placeItems: 'center',
              bgcolor: hasName ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.text.primary, 0.06),
              color: hasName ? theme.palette.primary.dark : theme.palette.text.disabled,
              fontSize: 13, fontWeight: 700,
            }}
          >
            {index + 1}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.palette.text.disabled, lineHeight: 1 }}>
              Activity {index + 1}
            </Typography>
            <Typography
              noWrap
              sx={{
                mt: 0.25, fontSize: 15, fontWeight: 700, letterSpacing: '-0.005em',
                color: hasName ? theme.palette.text.primary : theme.palette.text.disabled,
              }}
            >
              {hasName ? name : 'Untitled activity'}
            </Typography>
          </Box>
          {removable && (
            <Tooltip title="Remove this activity">
              <IconButton size="small" onClick={onRemove} sx={{ color: theme.palette.text.disabled }}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        {/* Overview */}
        <GroupHeader icon={<EventNoteIcon fontSize="small" />} title="Overview" />
        <FieldRow>
          <FieldCell span={{ xs: 12, md: 6 }}>
            <RhfTextField
              name={`${base}.nameOfActivity`}
              fullWidth required label="Name of the activity"
              rules={{ validate: (v) => (String(v || '').trim() ? true : 'Required.') }}
            />
          </FieldCell>
          <FieldCell span={{ xs: 12, sm: 6, md: 3 }}>
            <RhfTextField
              name={`${base}.monthToBeHeld`}
              select fullWidth label="Month"
            >
              <MenuItem value=""><em>—</em></MenuItem>
              {MONTHS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
            </RhfTextField>
          </FieldCell>
          <FieldCell span={{ xs: 12, sm: 6, md: 3 }}>
            <RhfTextField
              name={`${base}.technicalServiceProvider`}
              fullWidth label="Technical service provider"
            />
          </FieldCell>
        </FieldRow>

        <Divider sx={{ my: 2.5, borderColor: alpha(theme.palette.text.primary, 0.06) }} />

        {/* Budget breakdown */}
        <GroupHeader icon={<PaymentsOutlinedIcon fontSize="small" />} title="Budget breakdown" />
        <FieldRow>
          <FieldCell span={{ xs: 12, md: 3 }}>
            <RhfTextField
              name={`${base}.totalCost`}
              fullWidth type="number" label="Total cost"
              InputProps={CURRENCY_ADORNMENT}
            />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 9 }}>
            <BudgetSplit base={base} />
          </FieldCell>
        </FieldRow>

        <Divider sx={{ my: 2.5, borderColor: alpha(theme.palette.text.primary, 0.06) }} />

        {/* Participation */}
        <GroupHeader icon={<GroupsOutlinedIcon fontSize="small" />} title="Expected participation" />
        <FieldRow>
          <FieldCell span={{ xs: 12, sm: 6 }}>
            <RhfTextField
              name={`${base}.expectedParticipantMembers`}
              fullWidth type="number" label="Members"
            />
          </FieldCell>
          <FieldCell span={{ xs: 12, sm: 6 }}>
            <RhfTextField
              name={`${base}.expectedParticipantNonMembers`}
              fullWidth type="number" label="Non-members"
            />
          </FieldCell>
        </FieldRow>

        <Divider sx={{ my: 2.5, borderColor: alpha(theme.palette.text.primary, 0.06) }} />

        {/* Outcomes */}
        <GroupHeader icon={<EmojiObjectsOutlinedIcon fontSize="small" />} title="Expected results" />
        <FieldRow>
          <FieldCell span={{ xs: 12, md: 4 }}>
            <RhfTextField
              name={`${base}.expectedOutput`}
              fullWidth multiline minRows={2}
              label="Output"
              placeholder="What will exist after the activity"
            />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 4 }}>
            <RhfTextField
              name={`${base}.expectedOutcome`}
              fullWidth multiline minRows={2}
              label="Outcome"
              placeholder="What will change for the participants"
            />
          </FieldCell>
          <FieldCell span={{ xs: 12, md: 4 }}>
            <RhfTextField
              name={`${base}.expectedIncomeGeneratingActivity`}
              fullWidth multiline minRows={2}
              label="Income-generating activity (now / future)"
              placeholder="How this drives revenue / livelihood"
            />
          </FieldCell>
        </FieldRow>
      </Box>
    </Box>
  )
}

function GroupHeader({ icon, title }) {
  const theme = useTheme()
  return (
    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1.25, color: theme.palette.text.secondary }}>
      {icon}
      <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {title}
      </Typography>
    </Stack>
  )
}

// ─── Budget split field group ─────────────────────────────────────────────
// Three % inputs + a live stacked bar showing SIDBI / Others / IA. Uses
// useWatch on just the three % paths so the bar updates without touching
// the rest of the form.
function BudgetSplit({ base }) {
  const theme = useTheme()
  const [sidbi, others, ia] = useWatch({
    name: [
      `${base}.percentSupportBySidbi`,
      `${base}.percentSupportByOthers`,
      `${base}.percentContributionByIa`,
    ],
  }) || [null, null, null]

  const nums = [num(sidbi), num(others), num(ia)]
  const anyPct = nums.some((x) => x != null)
  const total = nums.reduce((s, x) => s + (x ?? 0), 0)
  const pctOff = anyPct && Math.abs(total - 100) > 0.01

  return (
    <Box>
      <FieldRow columnGap={2} rowGap={2}>
        <FieldCell span={{ xs: 12, sm: 4 }}>
          <RhfTextField
            name={`${base}.percentSupportBySidbi`}
            fullWidth type="number" label="% SIDBI"
            error={pctOff}
            InputProps={PERCENT_ADORNMENT}
          />
        </FieldCell>
        <FieldCell span={{ xs: 12, sm: 4 }}>
          <RhfTextField
            name={`${base}.percentSupportByOthers`}
            fullWidth type="number" label="% Others"
            error={pctOff}
            InputProps={PERCENT_ADORNMENT}
          />
        </FieldCell>
        <FieldCell span={{ xs: 12, sm: 4 }}>
          <RhfTextField
            name={`${base}.percentContributionByIa`}
            fullWidth type="number" label="% IA"
            error={pctOff}
            InputProps={PERCENT_ADORNMENT}
          />
        </FieldCell>
      </FieldRow>

      {anyPct && (
        <SplitBar
          sidbi={nums[0] ?? 0}
          others={nums[1] ?? 0}
          ia={nums[2] ?? 0}
          total={total}
          off={pctOff}
        />
      )}
    </Box>
  )
}

const SplitBar = memo(function SplitBar({ sidbi, others, ia, total, off }) {
  const theme = useTheme()
  const cap = Math.max(total, 100)
  const seg = [
    { color: theme.palette.primary.main, value: sidbi, label: 'SIDBI' },
    { color: theme.palette.info.main, value: others, label: 'Others' },
    { color: theme.palette.success.main, value: ia, label: 'IA' },
  ]

  return (
    <Box sx={{ mt: 1.5 }}>
      <Box
        sx={{
          display: 'flex',
          width: '100%',
          height: 8,
          borderRadius: 999,
          overflow: 'hidden',
          bgcolor: alpha(theme.palette.text.primary, 0.06),
        }}
      >
        {seg.map((s) => (
          s.value > 0 && (
            <Box
              key={s.label}
              sx={{
                flex: `${(s.value / cap) * 100} 0 auto`,
                bgcolor: s.color,
                minWidth: 2,
              }}
            />
          )
        ))}
      </Box>
      <Stack direction="row" spacing={2} sx={{ mt: 0.75, flexWrap: 'wrap' }}>
        {seg.map((s) => (
          <Stack key={s.label} direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color }} />
            <Typography sx={{ fontSize: 11.5, color: theme.palette.text.secondary }}>
              {s.label} · {round2(s.value)}%
            </Typography>
          </Stack>
        ))}
        <Box sx={{ flex: 1 }} />
        <Typography
          sx={{
            fontSize: 11.5,
            fontWeight: 700,
            color: off ? theme.palette.warning.dark : theme.palette.success.dark,
          }}
        >
          Total {round2(total)}% {off ? '· needs to hit 100%' : '· looks good'}
        </Typography>
      </Stack>
    </Box>
  )
})

// ─── Sticky footer ────────────────────────────────────────────────────────
function StickyFooter({ theme, problem, busy, onCancel }) {
  return (
    <Box
      sx={{
        position: 'sticky', bottom: 16, mt: 4, p: 1.75, borderRadius: 2.5,
        display: 'flex', alignItems: 'center', gap: 1.5,
        border: 1,
        borderColor: problem
          ? alpha(theme.palette.warning.main, 0.4)
          : alpha(theme.palette.text.primary, 0.1),
        backdropFilter: 'blur(10px)',
        background: alpha(theme.palette.background.paper, 0.94),
        boxShadow: `0 4px 24px ${alpha(theme.palette.text.primary, 0.06)}`,
      }}
    >
      <Box
        sx={{
          width: 30, height: 30, borderRadius: '50%',
          display: 'grid', placeItems: 'center',
          bgcolor: problem
            ? alpha(theme.palette.warning.main, 0.14)
            : alpha(theme.palette.success.main, 0.14),
          color: problem ? theme.palette.warning.dark : theme.palette.success.dark,
          flexShrink: 0,
        }}
      >
        {problem
          ? <SaveIcon sx={{ fontSize: 16 }} />
          : <CheckCircleRoundedIcon sx={{ fontSize: 16 }} />}
      </Box>
      <Typography
        variant="body2"
        color={problem ? 'warning.main' : 'text.secondary'}
        sx={{ flexGrow: 1 }}
      >
        {problem || 'Ready to save this action plan.'}
      </Typography>
      <Button color="inherit" onClick={onCancel} sx={{ textTransform: 'none' }}>
        Cancel
      </Button>
      <Button
        type="submit"
        variant="contained"
        disableElevation
        startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
        disabled={busy}
        sx={{ textTransform: 'none', px: 3, fontWeight: 600 }}
      >
        {busy ? 'Saving…' : 'Save Action Plan'}
      </Button>
    </Box>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function validateWhole({ state, registrationId, activities }) {
  if (!state) return 'Your profile has no state — the action plan needs one.'
  if (!registrationId) return 'Pick the Industry Association.'
  const named = activities.filter((a) => String(a.nameOfActivity || '').trim())
  if (named.length < MIN_ACTIVITIES) {
    return `Name at least ${MIN_ACTIVITIES} activities (${named.length} so far).`
  }
  for (let i = 0; i < activities.length; i += 1) {
    const a = activities[i]
    if (!String(a.nameOfActivity || '').trim()) continue
    const keys = ['percentSupportBySidbi', 'percentSupportByOthers', 'percentContributionByIa']
    const given = keys.map((k) => num(a[k])).filter((x) => x != null)
    if (given.length) {
      const total = keys.reduce((s, k) => s + (num(a[k]) ?? 0), 0)
      if (Math.abs(total - 100) > 0.01) {
        return `Activity ${i + 1}: support percentages add up to ${round2(total)}%, not 100%.`
      }
    }
  }
  return null
}

function num(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

