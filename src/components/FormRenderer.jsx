import { memo, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react'
import {
  Box, Card, Grid, Stack, Typography, TextField, MenuItem, InputAdornment,
  ToggleButtonGroup, ToggleButton, Avatar, RadioGroup, FormControlLabel,
  Radio, FormGroup, Checkbox, Button, Chip, LinearProgress,
  Table, TableHead, TableBody, TableRow, TableCell, IconButton,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import MyLocationIcon from '@mui/icons-material/MyLocation'
import { alpha } from '@mui/material/styles'
import { decodeFilename } from '../fileFieldLabels'
import FunctionsIcon from '@mui/icons-material/Functions'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import VerifiedIcon from '@mui/icons-material/Verified'
import PublicIcon from '@mui/icons-material/Public'
import BusinessIcon from '@mui/icons-material/Business'
import GavelIcon from '@mui/icons-material/Gavel'
import PlaceIcon from '@mui/icons-material/Place'
import PersonIcon from '@mui/icons-material/Person'
import GroupsIcon from '@mui/icons-material/Groups'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import HubIcon from '@mui/icons-material/Hub'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import InsightsIcon from '@mui/icons-material/Insights'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import PaymentsIcon from '@mui/icons-material/Payments'
import ArticleIcon from '@mui/icons-material/Article'

// Pick a section icon from its title.
function sectionIcon(title = '') {
  const t = title.toLowerCase()
  if (t.includes('state')) return PublicIcon
  if (t.includes('association') || t.includes('name of industry')) return BusinessIcon
  if (t.includes('constitution')) return GavelIcon
  if (t.includes('address')) return PlaceIcon
  if (t.includes('apex') || t.includes('holder')) return PersonIcon
  if (t.includes('nodal')) return PersonIcon
  if (t.includes('sidbi') || t.includes('branch')) return AccountBalanceIcon
  if (t.includes('cluster') || t.includes('district')) return HubIcon
  if (t.includes('infra')) return Inventory2Icon
  if (t.includes('dia') || t.includes('specific')) return InsightsIcon
  if (t.includes('invoice')) return ReceiptLongIcon
  if (t.includes('agency') || t.includes('payment') || t.includes('disburse') || t.includes('grant') || t.includes('budget') || t.includes('salary')) return PaymentsIcon
  if (t.includes('due diligence')) return GroupsIcon
  return ArticleIcon
}

const PATTERNS = {
  phone: { re: /^[6-9]\d{9}$/, msg: '10-digit mobile starting 6–9' },
  email: { re: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, msg: 'Enter a valid email' },
  pincode: { re: /^[1-9]\d{5}$/, msg: '6-digit pincode' },
}

// `showRequired` — treat a required field as errored when empty. Off by
// default so users don't see "Required" red text before they've even
// touched the field. Turn on after the first submit attempt.
//
// Whitespace-only strings are treated as empty (a user typing " " should
// not satisfy a required field).
export function fieldError(f, value, values, { showRequired = false } = {}) {
  const raw = value ?? ''
  const trimmed = typeof raw === 'string' ? raw.trim() : raw
  const filled = Array.isArray(trimmed) ? trimmed.length > 0 : trimmed !== '' && trimmed !== null
  if (showRequired && f.required && !filled) return 'Required'
  if (f.validate) { const e = f.validate(trimmed, values); if (e) return e }
  if (trimmed === '' || trimmed == null) return ''
  const p = f.pattern || (f.type === 'email' && PATTERNS.email) || (f.type === 'tel' && PATTERNS.phone)
  if (p && !p.re.test(String(trimmed))) return p.msg
  return ''
}

// Inline whitespace guard applied on every keystroke of a text-ish input.
// Two behaviours by field type:
//   • Identifier-like (email, tel, pattern-locked text like PAN/PIN/UUID):
//     strip ALL whitespace — these shouldn't contain spaces at all.
//   • Free text / textarea: strip leading whitespace, collapse consecutive
//     internal whitespace to a single space. Trailing whitespace is left
//     alone while the caret is inside the field (so the user can hit space
//     between words) and cleaned up on blur (see handleBlur).
// Numbers / dates / selects skip this path entirely.
export function normaliseWhitespace(f, raw) {
  if (typeof raw !== 'string') return raw
  const type = f?.type || 'text'
  // Fields where whitespace is never legal.
  const noWs = type === 'email' || type === 'tel' || f?.pattern
  if (noWs) return raw.replace(/\s+/g, '')
  // Free text / textarea — no leading, and collapse runs of whitespace.
  return raw.replace(/^\s+/, '').replace(/\s{2,}/g, ' ')
}

const optsOf = (f, values) => (f.optionsFrom ? f.optionsFrom(values) : f.options) || []

// Accepts either a plain string or `{ value, label }`. Returns
// `{ value, label }`. Callers that need the raw string use `.value`.
const asOption = (o) => (o && typeof o === 'object' && 'value' in o)
  ? { value: o.value, label: o.label ?? String(o.value) }
  : { value: o, label: String(o) }

// Return `prev` if it has the same items as `next`, otherwise `next`. Keeps
// options arrays reference-stable across renders so memoized `<Field>` inputs
// don't re-render every keystroke when their options are derived from
// `optionsFrom(values)`.
function stableArray(prev, next) {
  if (prev === next) return prev
  if (!prev || prev.length !== next.length) return next
  for (let i = 0; i < prev.length; i++) if (prev[i] !== next[i]) return next
  return prev
}

// A labelled frame so choice controls sit as neat cards like the text fields.
// `error` — when truthy the border/label/message go red, matching how the
// TextField-based fields signal validation problems.
function Framed({ label, required, error, children }) {
  // Borderless label-above-control block. The old bordered "frame" made
  // every yes/no + radio look like a tall panel; this version drops the
  // border + heavy padding so the control sits flush with the surrounding
  // text fields (label on top, control immediately below, no wasted
  // vertical space). The error is inlined as a red caption.
  return (
    <Box sx={{ minHeight: 40 }}>
      <Typography
        sx={{
          fontSize: 12.5,
          fontWeight: 500,
          color: error ? 'error.main' : 'text.secondary',
          mb: 0.5,
          lineHeight: 1.3,
        }}
      >
        {label}{required && ' *'}
      </Typography>
      {children}
      {error && (
        <Typography sx={{ mt: 0.5, fontSize: 11.5, color: 'error.main' }}>
          {error}
        </Typography>
      )}
    </Box>
  )
}

function YesNo({ value, onChange }) {
  const handle = useCallback((_, v) => { if (v) onChange(v) }, [onChange])
  return (
    <ToggleButtonGroup exclusive size="small" value={value ?? null} onChange={handle}>
      <ToggleButton value="yes" color="success" sx={{ px: 2.5, py: 0.35 }}>Yes</ToggleButton>
      <ToggleButton value="no" color="error" sx={{ px: 2.5, py: 0.35 }}>No</ToggleButton>
    </ToggleButtonGroup>
  )
}

// Read-only presentation for choice / collection fields (yes-no, radio,
// checkboxes). Reviewer roles such as CLUSTER_EXPERT get the captured value as
// plain text inside the usual frame: legible, and with no control to click
// there is nothing to accidentally change.
function ReadOnlyValue({ text }) {
  return (
    <Typography variant="body2" sx={{ py: 0.4, fontWeight: 500, color: text ? 'text.primary' : 'text.disabled' }}>
      {text || '—'}
    </Typography>
  )
}

// Backend list APIs sometimes return numeric ids while the DTO stores
// the selected value as a string (`sde: "1"`, `sidbiBranch: "17"`).
// Strict equality would miss those, so we coerce both sides to string
// before matching. The label lookup returns null when nothing matched
// so callers can fall back to a raw display without accidentally
// echoing back an id when a proper label is available.
const labelOfOption = (options, v) => {
  const target = v == null ? '' : String(v)
  const hit = options.map((o) => asOption(o)).find((o) => String(o.value) === target)
  return hit?.label ?? (v ?? '')
}

// Stores actual `File` objects in form state so the parent page can upload
// them after the parent record has a UUID. Chips display `.name`.
// Accepts only DOC / DOCX / JPG / JPEG / PNG per client spec — reject anything
// else with an inline message so silent drops don't confuse the user.
const ALLOWED_UPLOAD_EXT_RE = /\.(docx?|jpe?g|png|pdf)$/i
const ALLOWED_UPLOAD_ACCEPT = '.doc,.docx,.pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
// Hard cap on file size — matches what the backend/storage layer accepts and
// keeps oversized uploads from ever leaving the browser.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const MAX_UPLOAD_LABEL = '5 MB'

function Uploader({ value, label, help, required, error, onChange, readOnly }) {
  // Two separate rejection buckets so we can show a distinct message for
  // "wrong type" vs "too big" — otherwise the user has to guess which rule
  // their file broke.
  const [rejectedType, setRejectedType] = useState([])
  const [rejectedSize, setRejectedSize] = useState([])
  const docs = value || []
  const pick = useCallback((e) => {
    const picked = Array.from(e.target.files || [])
    const allowed = []
    const badType = []
    const badSize = []
    for (const f of picked) {
      if (!ALLOWED_UPLOAD_EXT_RE.test(f.name)) { badType.push(f); continue }
      if (f.size > MAX_UPLOAD_BYTES) { badSize.push(f); continue }
      allowed.push(f)
    }
    if (allowed.length) onChange([...(value || []), ...allowed])
    setRejectedType(badType.map((f) => f.name))
    setRejectedSize(badSize.map((f) => f.name))
    e.target.value = ''
  }, [value, onChange])
  const removeAt = useCallback((idx) => onChange((value || []).filter((_, i) => i !== idx)), [value, onChange])
  return (
    <Framed label={label} required={required} error={error}>
      {!readOnly && (
        <>
          <Button component="label" size="small" variant="outlined" startIcon={<UploadFileIcon />} sx={{ mt: 0.25 }}>
            Upload
            <input type="file" hidden multiple accept={ALLOWED_UPLOAD_ACCEPT} onChange={pick} />
          </Button>
          <Typography variant="caption" color={error ? 'error.main' : 'text.secondary'} sx={{ display: 'block', mt: 0.5 }}>
            Only .doc, .docx, .pdf, .jpg, .jpeg, .png files — max {MAX_UPLOAD_LABEL} each
          </Typography>
          {help && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
              {help}
            </Typography>
          )}
        </>
      )}
      {readOnly && docs.length === 0 && <ReadOnlyValue text="" />}
      {docs.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: readOnly ? 0.25 : 1 }}>
          {docs.map((f, i) => {
            // Already-uploaded files come back as slug-prefixed strings —
            // strip the `<slot>__` prefix so the chip shows just the
            // original filename the user picked.
            const shown = typeof f === 'string' ? decodeFilename(f).name : f.name
            // Stable per-file key so deleting a chip in the middle doesn't
            // misalign React's identity with the wrong file.
            const k = typeof f === 'string' ? f : `${f.name}::${f.size}::${f.lastModified}`
            return (
              <Chip key={k} size="small" variant="outlined" icon={<DescriptionOutlinedIcon />}
                label={shown}
                onDelete={readOnly ? undefined : () => removeAt(i)} />
            )
          })}
        </Box>
      )}
      {rejectedType.length > 0 && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
          Skipped (unsupported type): {rejectedType.join(', ')}
        </Typography>
      )}
      {rejectedSize.length > 0 && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
          Skipped (over {MAX_UPLOAD_LABEL}): {rejectedSize.join(', ')}
        </Typography>
      )}
    </Framed>
  )
}

// Repeater: an editable grid for a variable-length list of sub-records.
// `columns` describes the row shape ({ name, label, type }); `value` is the
// array of row objects. Cells edit in place; a per-row delete button removes
// entries and the "Add" button appends a blank row.
// Per-cell validation for repeater rows: applies the same email / phone /
// pincode / custom pattern rules as the top-level Field, so each column
// picks up inline red text without any per-schema wiring.
function cellError(col, v) {
  const raw = v ?? ''
  const trimmed = typeof raw === 'string' ? raw.trim() : raw
  if (trimmed === '' || trimmed == null) return ''
  if (col.validate) { const e = col.validate(trimmed); if (e) return e }
  const p = col.pattern
    || (col.type === 'email' && PATTERNS.email)
    || (col.type === 'tel' && PATTERNS.phone)
  if (p && !p.re.test(String(trimmed))) return p.msg
  return ''
}

// Synthetic key generator for Repeater rows. Rows have no natural id, and
// index-as-key misaligns React state (focus, cursor, per-row validation
// timing) when a middle row is deleted. `_rid` is added lazily inside the
// Repeater — it is not part of the row's data shape and doesn't affect
// the outer values object because the assign is done on the same row
// reference that's already in `rows`.
let __ridSeq = 0
function ensureRid(row) {
  if (row && typeof row === 'object' && row._rid == null) {
    Object.defineProperty(row, '_rid', {
      value: `rid_${++__ridSeq}`,
      enumerable: false, configurable: true, writable: true,
    })
  }
  return row?._rid
}

function Repeater({ value, label, required, onChange, columns, addLabel, readOnly }) {
  const rows = Array.isArray(value) ? value : []
  const cols = Array.isArray(columns) ? columns : []
  const update = (idx, name, v) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, [name]: v } : r))
    // Preserve _rid on the replaced row so React keeps its identity.
    if (rows[idx]?._rid) {
      Object.defineProperty(next[idx], '_rid', {
        value: rows[idx]._rid, enumerable: false, configurable: true, writable: true,
      })
    }
    onChange(next)
  }
  const add = () => {
    const blank = Object.fromEntries(cols.map((c) => [c.name, '']))
    ensureRid(blank)
    onChange([...rows, blank])
  }
  const remove = (idx) => onChange(rows.filter((_, i) => i !== idx))
  return (
    <Framed label={label} required={required}>
      {rows.length > 0 ? (
        <Table size="small" sx={{ mt: 0.5, '& td, & th': { px: 1, py: 0.75 } }}>
          <TableHead>
            <TableRow>
              {cols.map((c) => (
                <TableCell key={c.name} sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  {c.label}
                </TableCell>
              ))}
              {!readOnly && <TableCell align="right" width={48} />}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={ensureRid(r) || i} hover>
                {cols.map((c) => {
                  const cellVal = r?.[c.name] ?? ''
                  const err = cellError(c, cellVal)
                  return (
                    <TableCell key={c.name} sx={{ verticalAlign: 'top' }}>
                      <TextField
                        size="small"
                        fullWidth
                        value={cellVal}
                        onChange={(e) => update(i, c.name, e.target.value)}
                        placeholder={c.placeholder}
                        type={['number', 'email', 'tel', 'date'].includes(c.type) ? c.type : 'text'}
                        error={!!err}
                        helperText={err || undefined}
                        InputProps={{ readOnly }}
                        sx={readOnly ? { '& .MuiInputBase-root': { bgcolor: 'action.hover' } } : undefined}
                      />
                    </TableCell>
                  )
                })}
                {!readOnly && (
                  <TableCell align="right" sx={{ verticalAlign: 'top' }}>
                    <IconButton size="small" color="error" onClick={() => remove(i)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {readOnly ? 'No entries.' : 'No entries yet — click below to add.'}
        </Typography>
      )}
      {!readOnly && (
        <Button size="small" variant="outlined" startIcon={<AddIcon />} sx={{ mt: 1.25 }} onClick={add}>
          {addLabel || 'Add'}
        </Button>
      )}
    </Framed>
  )
}

// Helper button that pulls the browser's current GPS reading and writes it
// into two sibling number fields (typically `latitude` / `longitude`). The
// text inputs remain the primary path — GT can key in coordinates looked
// up on a map when they're not physically at the site. `f.targets` names
// the sibling fields, e.g. `{ lat: 'latitude', lng: 'longitude' }`.
function CoordinatesCapture({ f, changeFor }) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)
  const targets = f.targets || { lat: 'latitude', lng: 'longitude' }

  const capture = () => {
    if (!navigator.geolocation) {
      setStatus({ kind: 'error', msg: 'Geolocation not supported in this browser.' })
      return
    }
    setBusy(true)
    setStatus(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6))
        const lng = Number(pos.coords.longitude.toFixed(6))
        const accuracy = Math.round(pos.coords.accuracy)
        changeFor(targets.lat)(lat)
        changeFor(targets.lng)(lng)
        setStatus({ kind: 'ok', msg: `Captured — accuracy ±${accuracy} m` })
        setBusy(false)
      },
      (err) => {
        const msg = err.code === 1
          ? 'Permission denied. Allow location access to auto-fill.'
          : err.code === 3
            ? 'Timed out getting location. Try again outdoors.'
            : (err.message || 'Could not read location.')
        setStatus({ kind: 'error', msg })
        setBusy(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  return (
    <Grid size={{ xs: 12, sm: f.span || 12 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
        <Button
          variant="outlined"
          size="small"
          onClick={capture}
          disabled={busy}
          startIcon={<MyLocationIcon fontSize="small" />}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          {busy ? 'Getting location…' : (f.label || 'Get current coordinates')}
        </Button>
        {status && (
          <Typography variant="caption" color={status.kind === 'ok' ? 'success.main' : 'error.main'}>
            {status.msg}
          </Typography>
        )}
        {!status && f.help && (
          <Typography variant="caption" color="text.secondary">{f.help}</Typography>
        )}
      </Stack>
    </Grid>
  )
}

// Individual field. Wrapped in memo — receives primitives + stable callbacks
// so a keystroke on field A won't cause field B to re-render.
const Field = memo(function Field({ f, value, error, computed, options, verified, onChange, onVerify, changeFor }) {
  if (f.type === 'coordinates_capture') {
    return <CoordinatesCapture f={f} changeFor={changeFor} />
  }
  if (f.type === 'subheading') {
    // Modernised section subhead — no yellow overline. Sits like a
    // divider-with-title above the following field cluster. Tight rhythm
    // so it groups without eating vertical space.
    return (
      <Grid size={12}>
        <Box sx={{ mt: 0.5, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 700,
              color: 'text.secondary',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {f.label}
          </Typography>
        </Box>
      </Grid>
    )
  }
  if (f.type === 'yesno') {
    return (
      <Grid size={{ xs: 12, sm: f.span || 6 }}>
        <Framed label={f.label} required={f.required} error={error}>
          {f.readOnly
            ? <ReadOnlyValue text={value === 'yes' ? 'Yes' : value === 'no' ? 'No' : ''} />
            : <YesNo value={value} onChange={onChange} />}
        </Framed>
      </Grid>
    )
  }
  if (f.type === 'radio') {
    return (
      <Grid size={{ xs: 12, sm: f.span || 6 }}>
        <Framed label={f.label} required={f.required} error={error}>
          {f.readOnly ? <ReadOnlyValue text={labelOfOption(options, value)} /> : (
            <RadioGroup row value={value ?? ''} onChange={(e) => onChange(e.target.value)} sx={{ my: -0.5 }}>
              {options.map((raw) => { const o = asOption(raw)
                return <FormControlLabel key={o.value} value={o.value} control={<Radio size="small" />} label={o.label} />
              })}
            </RadioGroup>
          )}
        </Framed>
      </Grid>
    )
  }
  if (f.type === 'checkboxes') {
    const arr = value || []
    // An option literally named "All" acts as a select-all shortcut:
    // - Toggling "All" on selects every option; off clears the list.
    // - Checking every non-"All" option auto-checks "All".
    // - Unchecking any non-"All" option removes "All" from the selection.
    const allValues = options.map((raw) => asOption(raw).value)
    const nonAll = allValues.filter((v) => v !== 'All')
    const toggle = (v) => {
      if (v === 'All') {
        onChange(arr.includes('All') ? [] : allValues)
        return
      }
      const has = arr.includes(v)
      let next = has
        ? arr.filter((x) => x !== v && x !== 'All')
        : [...arr.filter((x) => x !== 'All'), v]
      if (allValues.includes('All') && nonAll.every((x) => next.includes(x))) {
        next = [...next, 'All']
      }
      onChange(next)
    }
    // Read-only view — render as a compact label + comma-separated
    // values so it lines up with the other read-only fields instead
    // of sitting in a bordered Framed panel.
    if (f.readOnly) {
      const labels = Array.isArray(arr)
        ? arr.map((v) => labelOfOption(options, v)).filter(Boolean)
        : []
      const display = labels.length ? labels.join(', ') : '—'
      return (
        <Grid size={12}>
          <Box sx={{ py: 0.25 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.disabled', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
              {f.label}
            </Typography>
            <Typography sx={{ mt: 0.25, fontSize: 14, fontWeight: 500, color: display === '—' ? 'text.disabled' : 'text.primary', wordBreak: 'break-word' }}>
              {display}
            </Typography>
          </Box>
        </Grid>
      )
    }
    return (
      <Grid size={12}>
        <Framed label={f.label} required={f.required} error={error}>
          <FormGroup row sx={{ gap: 0.5 }}>
            {options.map((raw) => { const o = asOption(raw)
              return <FormControlLabel key={o.value} sx={{ mr: 2 }} control={<Checkbox size="small" checked={arr.includes(o.value)} onChange={() => toggle(o.value)} />} label={o.label} />
            })}
          </FormGroup>
        </Framed>
      </Grid>
    )
  }
  if (f.type === 'file') {
    return <Grid size={{ xs: 12, sm: f.span || 6 }}><Uploader value={value} label={f.label} help={f.help} required={f.required} error={error} onChange={onChange} readOnly={f.readOnly} /></Grid>
  }
  if (f.type === 'repeater') {
    return (
      <Grid size={12}>
        <Repeater
          value={value}
          label={f.label}
          required={f.required}
          onChange={onChange}
          columns={f.columns || []}
          addLabel={f.addLabel}
          readOnly={f.readOnly}
        />
      </Grid>
    )
  }
  if (f.type === 'computed') {
    // `plain: true` opts out of the auto-calculated affordance entirely
    // — use it for mirrored / passthrough values that shouldn't stand out.
    const plain = f.plain === true
    return (
      <Grid size={{ xs: 12, sm: f.span || 4 }}>
        <TextField size="small" label={f.label} value={computed} fullWidth
          InputProps={{ readOnly: true, startAdornment: plain
            ? undefined
            : (
              <InputAdornment position="start">
                {f.prefix
                  ? <Typography sx={{ color: 'text.secondary', fontWeight: 600 }}>{f.prefix}</Typography>
                  : <FunctionsIcon fontSize="small" sx={{ color: 'text.disabled' }} />}
              </InputAdornment>
            ) }}
          helperText={plain ? f.help : 'Auto-calculated'}
          sx={plain
            ? undefined
            : {
                '& .MuiInputBase-input': { fontWeight: 600, color: 'text.primary' },
                '& .MuiInputBase-root': { bgcolor: 'action.hover' },
              }} />
      </Grid>
    )
  }

  const isSelect = f.type === 'select'
  const selVal = isSelect
    ? (options.some((o) => asOption(o).value === value) ? value : '')
    : (value ?? '')
  // A read-only <Select> still opens its menu on click, so render the chosen
  // option's label through a plain text input instead.
  const lockedSelect = isSelect && f.readOnly
  const multiline = f.type === 'textarea'
  const counter = f.max ? `${String(value ?? '').length} / ${f.max}` : null
  // Native calendar bounds for date inputs. Accepts an ISO string
  // ("YYYY-MM-DD") or the literal "today".
  // NOTE: format in local time — toISOString() would emit UTC, so at IST
  // (UTC+5:30) local midnight on the 29th becomes 18:30 UTC on the 28th
  // and the picker would cap a day early.
  const dateBound = (b) => {
    if (!b) return undefined
    if (b === 'today') {
      const d = new Date()
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    return b
  }
  const dateMax = f.type === 'date' ? dateBound(f.maxDate) : undefined
  const dateMin = f.type === 'date' ? dateBound(f.minDate) : undefined
  const isNumber = f.type === 'number' && !isSelect
  // Reject negative values at the value-write level, so paste / autofill /
  // browser spin arrows can't sneak `-1` in. Empty string is allowed
  // (user is mid-edit); anything else is coerced to its absolute value
  // (matches the "no negatives" rule the theme's onKeyDown enforces on
  // typing). Non-number fields fall through the whitespace normaliser.
  const handleChange = isNumber
    ? (e) => {
        const raw = e.target.value
        if (raw === '' || raw === '-') { onChange(''); return }
        const n = Number(raw)
        if (!Number.isFinite(n)) { onChange(''); return }
        onChange(n < 0 ? String(Math.abs(n)) : raw)
      }
    : (e) => onChange(normaliseWhitespace(f, e.target.value))
  // Trim residual trailing whitespace on blur so a saved value never
  // has a lingering space at the end (leading and internal doubles are
  // already blocked while typing by `normaliseWhitespace`).
  const handleBlur = isNumber ? undefined : () => {
    const cur = value ?? ''
    const trimmed = typeof cur === 'string' ? cur.replace(/\s+$/, '') : cur
    if (trimmed !== cur) onChange(trimmed)
  }

  // Read-only single-line fields (text, number, date, plus a read-only
  // select which is rendered as text anyway) render as a compact
  // label-above / value-below block. Removes the bordered-textbox weight
  // for values the user can't edit, and packs many per row at span 4.
  if (f.readOnly && !multiline && !f.otp) {
    // For a read-only select we can't rely on `selVal` (which blanks
    // itself when the current value isn't in the options list — that
    // guard only exists to keep the editable dropdown from
    // uncontrolled-warning). Fall through to the raw `value` so
    // async-loaded options (branches, SDE list) don't cause the
    // display to render as an em-dash when they haven't hydrated yet.
    let display = '—'
    if (lockedSelect) {
      const resolved = labelOfOption(options, value)
      if (resolved && resolved !== '' && resolved !== value) {
        display = resolved                    // option label resolved
      } else if (value !== '' && value != null) {
        display = String(value)               // fall back to raw value
      }
    } else if (f.type === 'date') {
      display = formatDisplayDate(selVal)
    } else if (selVal !== '' && selVal != null) {
      display = String(selVal)
    }
    return (
      <Grid size={{ xs: 12, sm: Math.min(f.span || 4, 4) }}>
        <Box sx={{ py: 0.25 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.disabled', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
            {f.label}
          </Typography>
          <Typography sx={{ mt: 0.25, fontSize: 14, fontWeight: 500, color: display === '—' ? 'text.disabled' : 'text.primary', wordBreak: 'break-word' }}>
            {f.prefix && display !== '—' ? `${f.prefix} ${display}` : display}
          </Typography>
        </Box>
      </Grid>
    )
  }

  return (
    <Grid size={{ xs: 12, sm: f.span || 6 }}>
      <TextField
        size="small"
        label={f.label + (f.required ? ' *' : '')}
        placeholder={f.placeholder}
        helperText={error || counter || f.help}
        error={!!error}
        type={['number', 'email', 'tel', 'date'].includes(f.type) && !isSelect ? f.type : 'text'}
        InputLabelProps={f.type === 'date' || lockedSelect ? { shrink: true } : undefined}
        multiline={multiline}
        minRows={multiline ? (f.rows || 2) : undefined}
        select={isSelect && !lockedSelect}
        value={lockedSelect ? labelOfOption(options, selVal) : selVal}
        onChange={handleChange}
        onBlur={handleBlur}
        // Number inputs increment on mouse wheel by default (browser
        // behavior). That's a footgun on long forms — a user scrolling
        // the page over a focused amount field silently changes the
        // value. Blur on wheel so the wheel event never mutates a
        // number field.
        onWheel={isNumber ? (e) => e.target.blur() : undefined}
        inputProps={{
          maxLength: f.max,
          max: dateMax,
          // For number fields, always cap the minimum at 0 (so browser
          // constraint-validation / stepper also refuse negatives).
          min: isNumber ? 0 : dateMin,
          ...(isNumber ? { inputMode: 'numeric' } : null),
        }}
        InputProps={{
          readOnly: f.readOnly,
          startAdornment: f.prefix ? <InputAdornment position="start">{f.prefix}</InputAdornment> : undefined,
          endAdornment: f.otp && !f.readOnly ? (
            <InputAdornment position="end">
              {verified
                ? <Chip size="small" color="success" icon={<VerifiedIcon />} label="Verified" />
                : <Button size="small" disabled={!!error || !value} onClick={onVerify}>Verify OTP</Button>}
            </InputAdornment>
          ) : undefined,
        }}
        sx={f.readOnly
          ? {
              // Plain outline, no tinted background — the tinted "prefilled"
              // look reads as disabled input clutter. Keep the field open-air.
              '& .MuiInputBase-root': { bgcolor: 'transparent' },
              '& .MuiInputBase-input': { color: 'text.primary', WebkitTextFillColor: 'inherit' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
            }
          : undefined}
        fullWidth
      >
        {isSelect && !lockedSelect && options.map((raw) => { const o = asOption(raw)
          return <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
        })}
      </TextField>
    </Grid>
  )
})

// Pretty-print an ISO date for the read-only display renderer above.
// Falls back to the raw string if it can't be parsed as a date.
function formatDisplayDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.valueOf())) return String(iso)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

const isFilled = (v) => {
  if (Array.isArray(v)) return v.length > 0
  if (v == null) return false
  if (typeof v === 'string') return v.trim() !== ''
  return v !== ''
}

const isVisible = (f, values) => !f.showIf || f.showIf(values)

function sectionDone(sec, values) {
  const inputs = sec.fields.filter((f) => !['subheading', 'computed', 'coordinates_capture'].includes(f.type) && isVisible(f, values))
  if (inputs.length === 0) return false
  const anyFilled = inputs.some((f) => isFilled(values[f.name]))
  const allValid = inputs.every((f) => (!f.required || isFilled(values[f.name])) && !fieldError(f, values[f.name], values))
  return anyFilled && allValid
}

// Keys that a section reads from `values`. A section only needs to re-render
// when one of these keys changes. Cached per `sec` object identity so the set
// is computed once per schema build.
const relevantKeysCache = new WeakMap()
function relevantKeysFor(sec) {
  const cached = relevantKeysCache.get(sec)
  if (cached) return cached
  const set = new Set()
  for (const f of sec.fields) {
    set.add(f.name)
    if (f.otp) set.add(`${f.name}_verified`)
    if (Array.isArray(f.sum)) f.sum.forEach((n) => set.add(n))
    // `formula` / `showIf` / `optionsFrom` / `validate` bodies are opaque
    // functions — the schema must declare any external fields they read via
    // `dependsOn`, otherwise the section skips re-render when the source
    // value changes (breaks auto-populate).
    if (Array.isArray(f.dependsOn)) f.dependsOn.forEach((n) => set.add(n))
  }
  // Common cross-section refs used by optionsFrom / showIf in this codebase
  // (e.g. district & cluster options depend on `state`). Cheap to always
  // include — a stable-reference `values.state` still passes the equality check.
  set.add('state')
  const keys = [...set]
  relevantKeysCache.set(sec, keys)
  return keys
}

// Progress bar. Isolated so it can update on the deferred pass without
// forcing a re-render of every section card.
const ProgressCard = memo(function ProgressCard({ doneCount, total, pct, accent }) {
  return (
    <Card sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="subtitle2" color="text.secondary">Completion</Typography>
        <Typography variant="subtitle2" color={`${accent}.main`}>{doneCount} / {total} sections</Typography>
      </Stack>
      <LinearProgress variant="determinate" value={pct} color={accent} sx={{ height: 8, borderRadius: 5, bgcolor: 'action.hover' }} />
    </Card>
  )
})

// One section = one memoized unit. Only re-renders when a value it actually
// reads has changed, so typing in section A leaves sections B..H untouched.
//
// `chrome`
//   'full'     — big gradient header with icon + step counter + done chip,
//                fields wrapped in a Card. Legacy default; used by pages that
//                render every section stacked.
//   'minimal'  — no card, no header, no chip. Parent owns those. Useful for
//                the new workspace tabs which supply their own section
//                title + subtitle + step context above the fields.
const SectionCard = memo(function SectionCard({
  sec, values, done, accent, total, changeFor, verifyFor, optionsCacheRef, showAllErrors,
  chrome = 'full',
}) {
  const Icon = sectionIcon(sec.title)

  const compute = (f) => {
    if (f.formula) { const r = f.formula(values); return r == null ? '' : r }
    if (f.sum.every((n) => values[n] == null || values[n] === '')) return ''
    return f.sum.reduce((a, n) => a + (parseFloat(values[n]) || 0), 0)
  }

  const isMinimal = chrome === 'minimal'
  const Wrapper = isMinimal ? Box : Card
  const wrapperSx = isMinimal ? {} : { overflow: 'hidden' }

  return (
    <Wrapper sx={wrapperSx}>
      {!isMinimal && (
        <Stack direction="row" alignItems="center" spacing={1.5}
          sx={{ px: 2.5, py: 1.5, background: (t) => `linear-gradient(90deg, ${alpha(t.palette[accent].main, 0.1)}, ${alpha(t.palette[accent].main, 0.02)})`, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Avatar sx={{ bgcolor: `${accent}.main`, color: '#fff', width: 34, height: 34 }}><Icon sx={{ fontSize: 19 }} /></Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>Step {sec.n} of {total}</Typography>
            <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>{sec.title}</Typography>
          </Box>
          {done
            ? <Chip size="small" color="success" icon={<CheckCircleIcon />} label="Done" sx={{ fontWeight: 700 }} />
            : <Chip size="small" variant="outlined" label="Pending" sx={{ color: 'text.secondary' }} />}
        </Stack>
      )}
      <Box sx={{ p: isMinimal ? 0 : { xs: 2, md: 2.5 } }}>
        {sec.desc && !isMinimal && <Typography variant="body2" color="text.secondary" mb={2}>{sec.desc}</Typography>}
        {/*
          alignItems="flex-start" keeps siblings top-aligned even when one
          field (uploader, error message, etc.) grows tall — otherwise MUI's
          default `stretch` blows up short TextFields to match the tallest
          item in the row and the grid looks jagged.
          The helperText reservation (`.MuiFormHelperText-root { minHeight }`)
          keeps every text field the same height whether it has help/error
          text or not, so bottoms line up across rows.
        */}
        <Grid
          container
          spacing={{ xs: 1.5, md: 1.75 }}
          alignItems="flex-start"
          sx={{ '& .MuiFormHelperText-root': { minHeight: '1em', mt: 0.25 } }}
        >
          {sec.fields.map((f) => {
            if (!isVisible(f, values)) return null
            const val = values[f.name]
            let options
            if (['select', 'radio', 'checkboxes'].includes(f.type)) {
              const next = optsOf(f, values)
              const cached = stableArray(optionsCacheRef.current[f.name], next)
              optionsCacheRef.current[f.name] = cached
              options = cached
            }
            return (
              <Field
                key={f.name}
                f={f}
                value={val}
                error={fieldError(f, val, values, { showRequired: showAllErrors })}
                computed={f.type === 'computed' ? compute(f) : undefined}
                options={options}
                verified={f.otp ? !!values[`${f.name}_verified`] : undefined}
                onChange={changeFor(f.name)}
                onVerify={f.otp ? verifyFor(f.name) : undefined}
                changeFor={changeFor}
              />
            )
          })}
        </Grid>
      </Box>
    </Wrapper>
  )
}, function sectionPropsEqual(prev, next) {
  if (prev.sec !== next.sec) return false
  if (prev.done !== next.done) return false
  if (prev.accent !== next.accent) return false
  if (prev.total !== next.total) return false
  if (prev.chrome !== next.chrome) return false
  if (prev.changeFor !== next.changeFor) return false
  if (prev.verifyFor !== next.verifyFor) return false
  if (prev.optionsCacheRef !== next.optionsCacheRef) return false
  if (prev.showAllErrors !== next.showAllErrors) return false
  const keys = relevantKeysFor(next.sec)
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    if (prev.values[k] !== next.values[k]) return false
  }
  return true
})

// `chrome`
//   'full'    — legacy layout: progress card at top + each section wrapped
//               in a gradient-header Card. Used by standalone form pages.
//   'minimal' — no progress card, no section headers, no per-section Card.
//               Used by the new workspace tabs which supply their own
//               section header + stepper + submit UX around the fields.
export default function FormRenderer({
  schema, accent = 'primary', values, setValue,
  showAllErrors = false, chrome = 'full',
}) {
  // Cache one callback per field name so identities survive re-renders. Ref is
  // used (not useMemo) because we want the closure to always read the latest
  // setValue without invalidating each entry.
  const setValueRef = useRef(setValue)
  setValueRef.current = setValue
  const changeCache = useRef({})
  const verifyCache = useRef({})
  const changeFor = useCallback((name) => {
    if (!changeCache.current[name]) changeCache.current[name] = (v) => setValueRef.current(name, v)
    return changeCache.current[name]
  }, [])
  const verifyFor = useCallback((name) => {
    if (!verifyCache.current[name]) verifyCache.current[name] = () => setValueRef.current(`${name}_verified`, true)
    return verifyCache.current[name]
  }, [])

  // Per-field options cache: keeps the same array reference when the *contents*
  // haven't changed, so `Field.memo` can skip re-renders even when the field's
  // options are derived from other form values.
  const optionsCacheRef = useRef({})

  // Section completion + progress are derived work that don't need to keep up
  // with every keystroke. useDeferredValue lets React draw the input first and
  // recompute in a follow-up commit, so typing stays on the fast path.
  const deferredValues = useDeferredValue(values)
  const total = schema.sections.length
  const dones = useMemo(
    () => schema.sections.map((s) => sectionDone(s, deferredValues)),
    [schema, deferredValues],
  )
  const doneCount = useMemo(() => dones.reduce((n, d) => n + (d ? 1 : 0), 0), [dones])
  const pct = Math.round((doneCount / total) * 100)

  const isMinimal = chrome === 'minimal'

  return (
    <Stack spacing={2}>
      {!isMinimal && <ProgressCard doneCount={doneCount} total={total} pct={pct} accent={accent} />}
      {schema.sections.map((sec, i) => (
        <SectionCard
          key={sec.n}
          sec={sec}
          values={values}
          done={dones[i]}
          accent={accent}
          total={total}
          chrome={chrome}
          changeFor={changeFor}
          verifyFor={verifyFor}
          optionsCacheRef={optionsCacheRef}
          showAllErrors={showAllErrors}
        />
      ))}
    </Stack>
  )
}

export function defaultsFor(schema) {
  const out = {}
  schema.sections.forEach((s) => s.fields.forEach((f) => { if (f.default != null) out[f.name] = f.default }))
  return out
}
