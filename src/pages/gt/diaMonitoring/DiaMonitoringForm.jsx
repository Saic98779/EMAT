import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box, Button, Stack, Typography, Paper, Snackbar, Alert, Chip,
  Card, Table, TableHead, TableBody, TableRow, TableCell, IconButton,
  Tooltip, Divider, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, Grid,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import CloseIcon from '@mui/icons-material/Close'
import FormRenderer, { defaultsFor, fieldError } from '../../../components/FormRenderer'
import { formBySlug } from './schemas'
import {
  useDiaMonitoringList, useDiaMonitoringCreate, useDiaMonitoringUpdate,
  useDiaMonitoringDelete, useIndustryAssociationsDropdown,
  useRegionalOfficeOptions, useUsersByRole,
} from '../../../queries'
import { BY_SLUG } from '../../../apis/diaMonitoring'
import { uploadContentAttachments } from '../../../apis/diaContent'

// Generic form host — resolves the schema from `formBySlug(:form)` and
// talks to the backend via the useDiaMonitoring* hooks. Dropdown sources
// (IA list, RO list, user lists for POC, parent-record selectors for
// participants) are fetched here and injected into reserved `_*` keys on
// `values` so FormRenderer's `optionsFrom(values)` finds them.
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
  const [editingId, setEditingId] = useState(null)
  const [viewingRow, setViewingRow] = useState(null)
  const [toast, setToast] = useState({ severity: '', msg: '' })

  // Parent-record dropdowns for the participant forms (existing).
  const parentSlug = PARENT_LIST_FOR[slug]
  const parentList = useDiaMonitoringList(parentSlug || null)

  // New: shared dropdown sources. All hooks are always wired (React rules of
  // hooks) but each query is enabled only when the current form actually
  // uses it, so unrelated screens don't trigger pointless network traffic.
  const iaDropdown = useIndustryAssociationsDropdown({
    enabled: FORMS_NEED_IA.has(slug),
  })
  const roOptions = useRegionalOfficeOptions()
  const needsRoOptions = FORMS_NEED_RO.has(slug)
  const sidbiUsers = useUsersByRole(slug === 'dia-enhancement' ? 'SIDBI_SDE' : null)
  const gtUsers = useUsersByRole(slug === 'dia-enhancement' ? 'GT_FIELD_TEAM' : null)

  // Own-slug CRUD.
  const list = useDiaMonitoringList(slug)
  const createM = useDiaMonitoringCreate(slug)
  const updateM = useDiaMonitoringUpdate(slug)
  const deleteM = useDiaMonitoringDelete(slug)

  // Hydrate every reserved `_*` option bag the schema might read. Also
  // triggers when the user switches into Edit mode so autocomplete
  // preserves the picked option labels.
  useEffect(() => {
    setValues((prev) => {
      const next = { ...prev }
      if (parentSlug) {
        const mod = BY_SLUG[parentSlug]
        const rows = parentList.data || []
        next[PARENT_FIELD_NAME[slug]] = mod?.toOption
          ? rows.map((r) => mod.toOption(r._raw || r))
          : rows.map((r) => ({ value: r.id, label: `#${r.id}` }))
      }
      // IA / RO / user options use the real backend id as the autocomplete
      // value so `diaMonitoring.toRequest` can lift it into the FK fields
      // the backend added on 2026-11-09 (roId, industryAssociationId,
      // sidbiPocId, gtPocId). freeSolo entries ship with id=null and the
      // typed name — the backend accepts both.
      if (FORMS_NEED_IA.has(slug)) {
        const rows = iaDropdown.data || []
        next._ia_options = rows.map((r) => ({
          value: r.id,
          label: r.name || r.industryAssociationName || `IA #${r.id}`,
        }))
      }
      if (needsRoOptions) {
        next._ro_options = roOptions.data || []
      }
      if (slug === 'dia-enhancement') {
        next._sidbi_users = (sidbiUsers.data || []).map(userToOption)
        next._gt_users = (gtUsers.data || []).map(userToOption)
      }
      return next
    })
  }, [slug, parentSlug, parentList.data, iaDropdown.data, roOptions.data,
      sidbiUsers.data, gtUsers.data, needsRoOptions])

  const setValue = useCallback(
    (name, v) => setValues((prev) => ({ ...prev, [name]: v })),
    [],
  )

  const problems = useMemo(() => {
    const out = []
    for (const sec of schema.sections) {
      for (const f of sec.fields) {
        if (['subheading', 'computed'].includes(f.type)) continue
        if (f.showIf && !f.showIf(values)) continue
        const err = fieldError(f, values[f.name], values, { showRequired: true })
        if (err) out.push({ field: f.name, label: f.label, err })
      }
    }
    return out
  }, [schema, values])

  const resetToDefaults = useCallback(() => {
    // Keep the reserved `_*` option bags so dropdowns don't blank out.
    const preserved = Object.fromEntries(
      Object.entries(values).filter(([k]) => k.startsWith('_')),
    )
    setValues({ ...defaultsFor(schema), ...preserved })
    setShowAllErrors(false)
  }, [schema, values])

  const stripReserved = (v) => Object.fromEntries(
    Object.entries(v).filter(([k]) => !k.startsWith('_')),
  )

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
      const clean = stripReserved(values)
      // DIA Enhancement is the only slug with a `type: 'file'` field right
      // now. If a fresh `File` was picked we do the two-phase upload after
      // the record is persisted (same pattern as Dia3cInfoSeries):
      //   1. create/update the record (file field left as null)
      //   2. uploadContentAttachments(stage, id, [file]) → URL
      //   3. PUT the URL back into enhancementSupportFilePath
      const pickedFile = slug === 'dia-enhancement'
        ? firstFileObject(values.attachment_path)
        : null

      let savedId
      if (editingId != null) {
        await updateM.mutateAsync({ id: editingId, values: clean })
        savedId = editingId
      } else {
        const saved = await createM.mutateAsync(clean)
        // apiFetch unwraps the envelope → payload.id is the new record.
        savedId = saved?.id
      }

      if (pickedFile && savedId) {
        try {
          const urls = await uploadContentAttachments('dia-enhancement', savedId, [pickedFile])
          const url = urls?.[0]
          if (url) {
            // PUT the record again with the uploaded URL, preserving
            // everything else the user just saved.
            await updateM.mutateAsync({
              id: savedId,
              values: { ...clean, attachment_path: [url] },
            })
          }
        } catch (uploadErr) {
          setToast({
            severity: 'warning',
            msg: `Entry saved, but attachment upload failed: ${uploadErr?.message || 'unknown error'}.`,
          })
          setEditingId(null)
          resetToDefaults()
          return
        }
      }

      setToast({ severity: 'success', msg: editingId != null ? 'Entry updated.' : 'Entry saved.' })
      setEditingId(null)
      resetToDefaults()
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

  const startEdit = (row) => {
    const raw = row._raw || row
    const mod = BY_SLUG[slug]
    const formValues = mod?.fromResponse ? mod.fromResponse(raw) : raw
    // Merge in the reserved option keys so dropdowns stay populated.
    const preserved = Object.fromEntries(
      Object.entries(values).filter(([k]) => k.startsWith('_')),
    )
    setValues({ ...defaultsFor(schema), ...formValues, ...preserved })
    setEditingId(raw.id)
    setShowAllErrors(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setEditingId(null)
    resetToDefaults()
  }

  const busy = createM.isPending || updateM.isPending

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
          label={editingId != null ? `Editing · Annexure XVI · ${sourceSheet}` : `Annexure XVI · ${sourceSheet}`}
          sx={{
            bgcolor: editingId != null ? 'warning.light' : 'primary.light',
            color: editingId != null ? 'warning.dark' : 'primary.dark',
            mb: 1.5, fontWeight: 700,
          }}
        />
        <Typography variant="h4">{title}</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 620, mx: 'auto' }}>
          {subtitle}
        </Typography>
      </Box>

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
        // When editing an existing DIA Enhancement, scope the file
        // previews back to the /files endpoint using the same
        // `(id, stage, id)` triple the upload step used. Lets the
        // FileChip click-through work for files saved earlier.
        fileScope={slug === 'dia-enhancement' && editingId != null
          ? { registrationId: editingId, stage: 'dia-enhancement', stageId: editingId }
          : null}
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
          {editingId != null && (
            <Button color="inherit" onClick={cancelEdit} disabled={busy}>Cancel edit</Button>
          )}
          <Button color="inherit" onClick={resetToDefaults} disabled={busy}>Reset</Button>
          <Button
            variant="contained"
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={save}
            disabled={busy}
          >
            {busy ? 'Saving…' : editingId != null ? 'Update entry' : 'Save entry'}
          </Button>
        </Stack>
      </Paper>

      <SavedRows
        rows={rows}
        isLoading={list.isLoading}
        isError={list.isError}
        error={list.error}
        mod={mod}
        onView={setViewingRow}
        onEdit={startEdit}
        onRemove={remove}
        isDeleting={deleteM.isPending}
        editingId={editingId}
      />

      <ViewRowDialog
        row={viewingRow}
        onClose={() => setViewingRow(null)}
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

// Which form depends on which parent-record list (for the FK selector).
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

// Which forms need which dropdown source hydrated into `values._*`.
const FORMS_NEED_IA = new Set(['capacity-building', 'exposure-visit'])
const FORMS_NEED_RO = new Set(['capacity-building', 'exposure-visit'])

// Format a user row as an autocomplete option. Backend now accepts both
// the FK id (`sidbiPocId` / `gtPocId`) and the display name
// (`pocSidbi` / `pocGt`), so we keep the id as the option value and the
// human name as the label.
function userToOption(u = {}) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
    || u.username || `User #${u.id}`
  return { value: u.id, label: name }
}

// Pull the first browser `File` object out of an Uploader value — used to
// decide whether a two-phase post-save upload is needed. Strings are
// already-persisted URLs and skip the upload step.
function firstFileObject(v) {
  const arr = Array.isArray(v) ? v : (v ? [v] : [])
  for (const item of arr) {
    if (item instanceof File) return item
  }
  return null
}

function SavedRows({ rows, isLoading, isError, error, mod, onView, onEdit, onRemove, isDeleting, editingId }) {
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
          Loaded from the backend record store. Use the view icon for full details, the pencil to edit.
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
            const isCurrent = editingId != null && String(editingId) === String(raw.id)
            return (
              <TableRow key={raw.id} hover selected={isCurrent}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Typography variant="body2">{formatWhen(raw.createdAt)}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 540,
                  }}>
                    {mod?.summary ? mod.summary(raw) : (raw.id || '—')}
                  </Typography>
                  {isCurrent && (
                    <Chip size="small" color="warning" label="Editing" sx={{ mt: 0.5 }} />
                  )}
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Tooltip title="View details">
                      <IconButton size="small" onClick={() => onView(r)}>
                        <VisibilityOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" color="primary" onClick={() => onEdit(r)}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => onRemove(raw.id)} disabled={isDeleting}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}

// Read-only view of every field in a saved row, grouped by schema section.
// Pretty-prints booleans, ISO dates, numbers and arrays; renders unknown
// values via JSON.stringify so bugs are visible rather than silent.
function ViewRowDialog({ row, onClose }) {
  const raw = row?._raw || row
  if (!raw) return null
  return (
    <Dialog open={!!raw} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Record #{raw.id}</span>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          {flattenEntries(raw).map(([k, v]) => (
            <Grid key={k} size={{ xs: 12, sm: 6 }}>
              <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>
                {humanKey(k)}
              </Typography>
              <Typography variant="body2" sx={{
                mt: 0.25, color: v == null || v === '' ? 'text.disabled' : 'text.primary',
                wordBreak: 'break-word', whiteSpace: 'pre-wrap',
              }}>
                {formatValue(v)}
              </Typography>
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

function flattenEntries(obj) {
  // Hide walker-wrapper keys + the audit metadata at the bottom of every
  // DTO. Keeps the view focused on the user-entered fields.
  const HIDE = new Set(['_raw', 'isActive'])
  const META = new Set(['createdAt', 'updatedAt', 'createdBy', 'updatedBy'])
  const main = []
  const meta = []
  for (const [k, v] of Object.entries(obj)) {
    if (HIDE.has(k)) continue
    if (META.has(k)) meta.push([k, v])
    else main.push([k, v])
  }
  return [...main, ...meta]
}

function humanKey(k) {
  return k
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim()
}

function formatValue(v) {
  if (v == null || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—'
  if (typeof v === 'object') return JSON.stringify(v)
  const s = String(v)
  // ISO date-time → local-friendly format.
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s)
    if (!isNaN(d.getTime())) return d.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  return s
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
