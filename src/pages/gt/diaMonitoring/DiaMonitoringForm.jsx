import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box, Button, Stack, Typography, Paper, Snackbar, Alert, Chip,
  Card, Table, TableHead, TableBody, TableRow, TableCell, IconButton,
  Tooltip, Divider, CircularProgress,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import FormRenderer, { defaultsFor, fieldError } from '../../../components/FormRenderer'
import { formBySlug } from './schemas'
import {
  useDiaMonitoringList, useDiaMonitoringCreate, useDiaMonitoringDelete,
} from '../../../queries'
import { BY_SLUG } from '../../../apis/diaMonitoring'

// Generic form host — resolves the schema from `formBySlug(:form)` and
// talks to the backend via `useDiaMonitoringList` + `useDiaMonitoringCreate`.
// Two forms (`cb-participant`, `exposure-visit-participant`) depend on a
// parent-record dropdown; we hydrate those into `values._cb_events` /
// `values._exposure_visits` so the schema's `optionsFrom` finds them.
export default function DiaMonitoringForm() {
  const { form: slug } = useParams()
  const navigate = useNavigate()
  const def = formBySlug(slug)

  if (!def) {
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto', pb: 6 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/gt/dia-monitoring')} sx={{ mb: 2 }}>
          DIA Monitoring
        </Button>
        <Alert severity="warning">That DIA monitoring form doesn’t exist.</Alert>
      </Box>
    )
  }

  return <FormHost def={def} navigate={navigate} />
}

function FormHost({ def, navigate }) {
  const { schema, title, subtitle, sourceSheet, slug } = def
  const [values, setValues] = useState(() => defaultsFor(schema))
  const [showAllErrors, setShowAllErrors] = useState(false)
  const [toast, setToast] = useState({ severity: '', msg: '' })

  // Own-slug list (records saved so far) + any parent-list needed to populate
  // a selector on this form. Participants need a parent (CB event / exposure
  // visit); the other four forms have no parent and only read their own list.
  const parentSlug = PARENT_LIST_FOR[slug]
  const list = useDiaMonitoringList(slug)
  const parentList = useDiaMonitoringList(parentSlug || null)
  const createM = useDiaMonitoringCreate(slug)
  const deleteM = useDiaMonitoringDelete(slug)

  // Parent-list → `values._cb_events` / `values._exposure_visits` so the
  // schema's `optionsFrom` has data to render. Rebuilds whenever the list
  // changes so a new parent-record created in another tab shows up here.
  useEffect(() => {
    if (!parentSlug) return
    const mod = BY_SLUG[parentSlug]
    const rows = parentList.data || []
    const opts = mod?.toOption
      ? rows.map((r) => mod.toOption(r._raw || r))
      : rows.map((r) => ({ value: r.id, label: `#${r.id}` }))
    const key = PARENT_FIELD_NAME[slug]
    setValues((prev) => ({ ...prev, [key]: opts }))
  }, [parentSlug, parentList.data, slug])

  const setValue = useCallback(
    (name, v) => setValues((prev) => ({ ...prev, [name]: v })),
    [],
  )

  const problems = useMemo(() => {
    const list = []
    for (const sec of schema.sections) {
      for (const f of sec.fields) {
        if (['subheading', 'computed'].includes(f.type)) continue
        if (f.showIf && !f.showIf(values)) continue
        const err = fieldError(f, values[f.name], values, { showRequired: true })
        if (err) list.push({ field: f.name, label: f.label, err })
      }
    }
    return list
  }, [schema, values])

  const save = async () => {
    if (problems.length) {
      setShowAllErrors(true)
      setToast({
        severity: 'warning',
        msg: `Please fix ${problems.length} field${problems.length === 1 ? '' : 's'} highlighted above.`,
      })
      return
    }
    try {
      // Strip the reserved `_*` keys (option bags) before shipping — the
      // backend DTO doesn't know about them.
      const clean = Object.fromEntries(
        Object.entries(values).filter(([k]) => !k.startsWith('_')),
      )
      await createM.mutateAsync(clean)
      // Preserve parent-list option keys across the reset so the dropdown
      // stays populated for the next entry.
      const preserved = parentSlug
        ? { [PARENT_FIELD_NAME[slug]]: values[PARENT_FIELD_NAME[slug]] }
        : {}
      setValues({ ...defaultsFor(schema), ...preserved })
      setShowAllErrors(false)
      setToast({ severity: 'success', msg: 'Entry saved.' })
    } catch (err) {
      setToast({
        severity: 'error',
        msg: err?.message || 'Could not save — please try again.',
      })
    }
  }

  const remove = async (id) => {
    try {
      await deleteM.mutateAsync(id)
      setToast({ severity: 'info', msg: 'Entry removed.' })
    } catch (err) {
      setToast({ severity: 'error', msg: err?.message || 'Could not delete.' })
    }
  }

  const reset = () => {
    const preserved = parentSlug
      ? { [PARENT_FIELD_NAME[slug]]: values[PARENT_FIELD_NAME[slug]] }
      : {}
    setValues({ ...defaultsFor(schema), ...preserved })
    setShowAllErrors(false)
  }

  const rows = list.data || []
  const mod = BY_SLUG[slug]

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', pb: 10 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/gt/dia-monitoring')}>
          DIA Monitoring
        </Button>
        {rows.length > 0 && (
          <Chip
            icon={<HistoryOutlinedIcon sx={{ fontSize: 16 }} />}
            size="small"
            label={`${rows.length} record${rows.length === 1 ? '' : 's'} on file`}
            variant="outlined"
          />
        )}
      </Stack>

      <Box textAlign="center" mb={3}>
        <Chip
          label={`Annexure XVI · ${sourceSheet}`}
          sx={{ bgcolor: 'primary.light', color: 'primary.dark', mb: 1.5, fontWeight: 700 }}
        />
        <Typography variant="h4">{title}</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 620, mx: 'auto' }}>
          {subtitle}
        </Typography>
      </Box>

      {/* Parent-list error — still render the form so the user can see the
          shape, but call out that the dropdown is empty for a backend reason. */}
      {parentSlug && parentList.isError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Could not load the {PARENT_LABEL[slug]} list from the backend. The
          selector will be empty until the parent endpoint is reachable.
        </Alert>
      )}

      <FormRenderer
        schema={schema}
        accent="primary"
        values={values}
        setValue={setValue}
        showAllErrors={showAllErrors}
      />

      <Paper
        elevation={3}
        sx={{
          position: 'sticky', bottom: 16, mt: 3, p: 1.5, borderRadius: 3,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5,
        }}
      >
        <Typography variant="body2" color={problems.length ? 'warning.dark' : 'success.dark'}>
          {problems.length === 0
            ? 'All required fields are filled.'
            : `${problems.length} field${problems.length === 1 ? '' : 's'} still need${problems.length === 1 ? 's' : ''} attention.`}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button color="inherit" onClick={reset} disabled={createM.isPending}>Reset</Button>
          <Button
            variant="contained"
            startIcon={createM.isPending ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={save}
            disabled={createM.isPending}
          >
            {createM.isPending ? 'Saving…' : 'Save entry'}
          </Button>
        </Stack>
      </Paper>

      <SavedRows
        rows={rows}
        isLoading={list.isLoading}
        isError={list.isError}
        error={list.error}
        mod={mod}
        onRemove={remove}
        isDeleting={deleteM.isPending}
      />

      <Snackbar
        open={!!toast.msg}
        autoHideDuration={5000}
        onClose={() => setToast({ severity: '', msg: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast.severity || 'info'} variant="filled" onClose={() => setToast({ severity: '', msg: '' })}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}

// Which form depends on which parent list (for the selector).
const PARENT_LIST_FOR = {
  'cb-participant':             'capacity-building',
  'exposure-visit-participant': 'exposure-visit',
}
const PARENT_FIELD_NAME = {
  'cb-participant':             '_cb_events',
  'exposure-visit-participant': '_exposure_visits',
}
const PARENT_LABEL = {
  'cb-participant':             'Capacity Building Event',
  'exposure-visit-participant': 'Exposure Visit',
}

function SavedRows({ rows, isLoading, isError, error, mod, onRemove, isDeleting }) {
  if (isLoading) {
    return (
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    )
  }
  if (isError) {
    return (
      <Alert severity="warning" sx={{ mt: 4 }}>
        Couldn’t load saved records: {error?.message || 'Backend unreachable.'}
        &nbsp;New entries will still try to save when you click Save entry.
      </Alert>
    )
  }
  if (!rows.length) return null
  return (
    <Card sx={{ mt: 4, borderRadius: 2.5 }}>
      <Box sx={{ p: 2.5, pb: 1.5 }}>
        <Typography fontWeight={700} fontSize="1rem">Recently saved · {rows.length}</Typography>
        <Typography variant="caption" color="text.secondary">
          Loaded from the backend record store.
        </Typography>
      </Box>
      <Divider />
      <Table size="small" sx={{ '& tbody tr:last-of-type td': { border: 0 } }}>
        <TableHead>
          <TableRow>
            <TableCell>When</TableCell>
            <TableCell>Summary</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.slice(0, 20).map((r) => {
            const raw = r._raw || r
            return (
              <TableRow key={raw.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Typography variant="body2">{formatWhen(raw.createdAt)}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 540,
                  }}>
                    {mod?.summary ? mod.summary(raw) : (raw.id || '—')}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => onRemove(raw.id)} disabled={isDeleting}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}

function formatWhen(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
