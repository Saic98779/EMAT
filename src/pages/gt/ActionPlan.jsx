import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Stack, Typography, Button, Snackbar, Alert,
  Paper, CircularProgress, TextField, MenuItem, InputAdornment, Divider, Chip,
  IconButton, Tooltip,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { PageHeader } from '../../components/shared'
import { useAuth } from '../../auth'
import {
  useIAs, useActionPlans, useCreateActionPlan, useUpdateActionPlan,
} from '../../queries'
import {
  toFormValues, blankActivity, MIN_ACTIVITIES, MAX_ACTIVITIES,
} from '../../apis/actionPlans'

// Action Plan (Annexure) — Year-1 activity plan for one Industry Association.
//
// Per the format:
//   Row 1  State  — fetched from the logged-in user, not editable.
//   Row 2  IA     — picked from the associations mapped to that state.
//   Row 3  note   — around six activities for Year 1, at least four of them
//                   current or future income-generating activities.
//   Rows 4+ Activity blocks, twelve fields each.
//
// One plan per registration: if the picked IA already has one we hydrate it
// and PUT, otherwise POST a new one.

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function ActionPlan() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const state = user?.state || ''

  const iasQ = useIAs()
  const plansQ = useActionPlans()
  const create = useCreateActionPlan()
  const update = useUpdateActionPlan()

  const [registrationId, setRegistrationId] = useState('')
  const [activities, setActivities] = useState(
    () => Array.from({ length: MIN_ACTIVITIES }, blankActivity),
  )
  const [toast, setToast] = useState(null)

  // Row 2 — only associations in the logged-in user's state. If the user has
  // no state on their profile we show everything rather than an empty list.
  const iaOptions = useMemo(() => {
    const rows = iasQ.data || []
    const mine = state
      ? rows.filter((r) => String(r.state || '').toLowerCase() === state.toLowerCase())
      : rows
    return mine
      .map((r) => ({ value: r.id, label: r.name || String(r.id) }))
      .filter((o) => o.value != null)
      .sort((a, b) => String(a.label).localeCompare(String(b.label)))
  }, [iasQ.data, state])

  // Existing plan for the picked IA, if any — drives create-vs-update.
  const existing = useMemo(() => (plansQ.data || [])
    .find((p) => String(p.registrationId) === String(registrationId)) || null,
  [plansQ.data, registrationId])

  // Hydrate once per IA switch so typing isn't clobbered by background refetches.
  const hydratedForRef = useRef(null)
  useEffect(() => {
    if (!registrationId) return
    if (plansQ.isLoading) return
    if (hydratedForRef.current === String(registrationId)) return
    const loaded = existing ? toFormValues(existing).activities : []
    setActivities(loaded.length
      ? padTo(loaded, MIN_ACTIVITIES)
      : Array.from({ length: MIN_ACTIVITIES }, blankActivity))
    hydratedForRef.current = String(registrationId)
  }, [registrationId, plansQ.isLoading, existing])

  const setActivity = useCallback((i, name, value) => {
    setActivities((prev) => {
      if (prev[i]?.[name] === value) return prev
      const next = prev.slice()
      next[i] = { ...next[i], [name]: value }
      return next
    })
  }, [])

  const addActivity = () => setActivities((p) => (p.length >= MAX_ACTIVITIES ? p : [...p, blankActivity()]))
  const removeActivity = (i) => setActivities((p) => (p.length <= MIN_ACTIVITIES ? p : p.filter((_, x) => x !== i)))

  const problem = validate({ state, registrationId, activities })
  const busy = create.isPending || update.isPending

  const save = async () => {
    if (problem) { setToast({ kind: 'warning', msg: problem }); return }
    const values = { state, registrationId, activities }
    try {
      if (existing?.id) {
        await update.mutateAsync({ id: existing.id, values })
        setToast({ kind: 'success', msg: 'Action plan updated.' })
      } else {
        await create.mutateAsync(values)
        setToast({ kind: 'success', msg: 'Action plan saved.' })
      }
    } catch (e) {
      setToast({ kind: 'error', msg: e?.message || 'Failed to save the action plan.' })
    }
  }

  return (
    <Box sx={{ maxWidth: 1160, mx: 'auto', pb: 10 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>Back</Button>

      <PageHeader
        title="Action Plan"
        subtitle="Year-1 activity plan for the Industry Association."
      />

      <Stack spacing={2.5}>
        <SectionCard n={1} title="Industry Association">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReadField
                label="State"
                value={state}
                helperText={state ? 'From your login' : 'No state on your profile'}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <TextField
                select fullWidth size="small" required
                label="Name of Industry Association (IA)"
                value={registrationId}
                onChange={(e) => setRegistrationId(e.target.value)}
                disabled={iasQ.isLoading}
                helperText={iasQ.isLoading
                  ? 'Loading associations…'
                  : state
                    ? `Associations mapped to ${state}`
                    : 'All associations'}
              >
                {iaOptions.length === 0 && !iasQ.isLoading && (
                  <MenuItem value="" disabled>
                    {state ? `No associations mapped to ${state}` : 'No associations available'}
                  </MenuItem>
                )}
                {iaOptions.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            {registrationId && (
              <Grid size={12}>
                <Alert severity={existing ? 'info' : 'success'} variant="outlined">
                  {existing
                    ? 'This association already has an action plan — editing it will replace the saved activities.'
                    : 'No action plan yet for this association — this will create one.'}
                </Alert>
              </Grid>
            )}
          </Grid>
        </SectionCard>

        <SectionCard
          n={2}
          title="Year-1 Activities"
          action={
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip size="small" label={`${activities.length} of ${MAX_ACTIVITIES}`} />
              <Button size="small" startIcon={<AddIcon />} onClick={addActivity}
                disabled={activities.length >= MAX_ACTIVITIES}>
                Add activity
              </Button>
            </Stack>
          }
        >
          <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
            Around six activities for Year 1, with at least four being current or
            future income-generating activities.
          </Alert>

          <Stack spacing={2.5}>
            {activities.map((a, i) => (
              <ActivityBlock
                key={i}
                index={i}
                value={a}
                onChange={setActivity}
                onRemove={removeActivity}
                removable={activities.length > MIN_ACTIVITIES}
              />
            ))}
          </Stack>
        </SectionCard>
      </Stack>

      <Paper elevation={3} sx={{
        position: 'sticky', bottom: 16, mt: 3, p: 1.5, borderRadius: 3,
        display: 'flex', alignItems: 'center', gap: 1.5,
      }}>
        <Typography variant="body2" color={problem ? 'warning.main' : 'text.secondary'} sx={{ flexGrow: 1 }}>
          {problem || (existing ? 'Ready to update the saved plan.' : 'Ready to save.')}
        </Typography>
        <Button color="inherit" onClick={() => navigate(-1)}>Cancel</Button>
        <Button
          variant="contained"
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          disabled={!!problem || busy}
          onClick={save}
        >
          {busy ? 'Saving…' : existing ? 'Update Action Plan' : 'Save Action Plan'}
        </Button>
      </Paper>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {toast && (
          <Alert severity={toast.kind} variant="filled" onClose={() => setToast(null)}>{toast.msg}</Alert>
        )}
      </Snackbar>
    </Box>
  )
}

// ── Activity block ─────────────────────────────────────────────────────────

const ActivityBlock = memo(function ActivityBlock({ index, value, onChange, onRemove, removable }) {
  const set = (name) => (e) => onChange(index, name, e.target.value)
  const pctTotal = ['percentSupportBySidbi', 'percentSupportByOthers', 'percentContributionByIa']
    .reduce((sum, k) => sum + (num(value[k]) ?? 0), 0)
  const anyPct = ['percentSupportBySidbi', 'percentSupportByOthers', 'percentContributionByIa']
    .some((k) => num(value[k]) != null)
  const pctOff = anyPct && Math.abs(pctTotal - 100) > 0.01

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Typography variant="subtitle2" fontWeight={700}>Activity {index + 1}</Typography>
        <Box sx={{ flexGrow: 1 }} />
        {removable && (
          <Tooltip title="Remove this activity">
            <IconButton size="small" color="error" onClick={() => onRemove(index)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <TextField fullWidth size="small" required label="Name of the Activity"
            value={value.nameOfActivity} onChange={set('nameOfActivity')} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField select fullWidth size="small" label="Month to be held"
            value={value.monthToBeHeld} onChange={set('monthToBeHeld')}>
            <MenuItem value=""><em>—</em></MenuItem>
            {MONTHS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField fullWidth size="small" label="Technical Service Provider"
            value={value.technicalServiceProvider} onChange={set('technicalServiceProvider')} />
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <TextField fullWidth size="small" type="number" label="Total Cost"
            value={value.totalCost} onChange={set('totalCost')}
            InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <PercentField label="% support by SIDBI" value={value.percentSupportBySidbi}
            onChange={set('percentSupportBySidbi')} error={pctOff} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <PercentField label="% support by Others" value={value.percentSupportByOthers}
            onChange={set('percentSupportByOthers')} error={pctOff} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <PercentField label="% contribution by IA" value={value.percentContributionByIa}
            onChange={set('percentContributionByIa')} error={pctOff}
            helperText={anyPct ? `Total ${round2(pctTotal)}%` : ' '} />
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <TextField fullWidth size="small" type="number" label="Expected participants — members"
            value={value.expectedParticipantMembers} onChange={set('expectedParticipantMembers')} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField fullWidth size="small" type="number" label="Expected participants — non-members"
            value={value.expectedParticipantNonMembers} onChange={set('expectedParticipantNonMembers')} />
        </Grid>

        <Grid size={12}><Divider /></Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <TextField fullWidth size="small" multiline minRows={2} label="Expected Output"
            value={value.expectedOutput} onChange={set('expectedOutput')} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField fullWidth size="small" multiline minRows={2} label="Expected Outcome"
            value={value.expectedOutcome} onChange={set('expectedOutcome')} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField fullWidth size="small" multiline minRows={2}
            label="Expected income-generating activity now / in future"
            value={value.expectedIncomeGeneratingActivity}
            onChange={set('expectedIncomeGeneratingActivity')} />
        </Grid>
      </Grid>
    </Paper>
  )
})

// ── Building blocks ────────────────────────────────────────────────────────

const SectionCard = memo(function SectionCard({ n, title, action, children }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 2 }}>
          <Box sx={{
            width: 28, height: 28, borderRadius: '50%',
            bgcolor: 'primary.light', color: 'primary.dark',
            display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.85rem',
          }}>{n}</Box>
          <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
          <Box sx={{ flexGrow: 1 }} />
          {action}
        </Stack>
        {children}
      </CardContent>
    </Card>
  )
})

const PercentField = memo(function PercentField({ label, value, onChange, error, helperText }) {
  return (
    <TextField
      fullWidth size="small" type="number" label={label}
      value={value} onChange={onChange} error={error} helperText={helperText}
      InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
    />
  )
})

const ReadField = memo(function ReadField({ label, value, helperText }) {
  const empty = value == null || value === ''
  return (
    <TextField
      fullWidth size="small" label={label}
      value={empty ? '' : String(value)} placeholder="—"
      InputProps={{ readOnly: true }} InputLabelProps={{ shrink: true }}
      helperText={helperText}
      sx={{ '& .MuiInputBase-root': { bgcolor: 'action.hover' } }}
    />
  )
})

// ── Helpers ────────────────────────────────────────────────────────────────

function validate({ state, registrationId, activities }) {
  if (!state) return 'Your profile has no state — the action plan needs one.'
  if (!registrationId) return 'Pick the Industry Association.'
  const named = activities.filter((a) => String(a.nameOfActivity || '').trim())
  if (named.length < MIN_ACTIVITIES) {
    return `Name at least ${MIN_ACTIVITIES} activities (${named.length} so far).`
  }
  for (let i = 0; i < activities.length; i += 1) {
    const a = activities[i]
    if (!String(a.nameOfActivity || '').trim()) continue
    const pcts = ['percentSupportBySidbi', 'percentSupportByOthers', 'percentContributionByIa']
    const given = pcts.map((k) => num(a[k])).filter((x) => x != null)
    if (given.length) {
      const total = pcts.reduce((s, k) => s + (num(a[k]) ?? 0), 0)
      if (Math.abs(total - 100) > 0.01) {
        return `Activity ${i + 1}: support percentages add up to ${round2(total)}%, not 100%.`
      }
    }
  }
  return null
}

function padTo(rows, n) {
  const out = rows.slice()
  while (out.length < n) out.push(blankActivity())
  return out
}

function num(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const round2 = (n) => Math.round(n * 100) / 100
