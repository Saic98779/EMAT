import {
  Box, Card, Grid, Stack, Typography, TextField, MenuItem, InputAdornment,
  ToggleButtonGroup, ToggleButton, Avatar, Divider, RadioGroup, FormControlLabel,
  Radio, FormGroup, Checkbox, Button, Chip, FormLabel, LinearProgress,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
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

export function fieldError(f, value, values) {
  const v = value ?? ''
  if (f.validate) { const e = f.validate(v, values); if (e) return e }
  if (v === '') return ''
  const p = f.pattern || (f.type === 'email' && PATTERNS.email) || (f.type === 'tel' && PATTERNS.phone)
  if (p && !p.re.test(String(v))) return p.msg
  return ''
}

const optsOf = (f, values) => (f.optionsFrom ? f.optionsFrom(values) : f.options) || []

// A labelled frame so choice controls sit as neat cards like the text fields.
function Framed({ label, required, children }) {
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, px: 1.75, py: 1.25, height: '100%', bgcolor: 'background.paper' }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>{label}{required && ' *'}</Typography>
      {children}
    </Box>
  )
}

function YesNo({ value, onChange }) {
  return (
    <ToggleButtonGroup exclusive size="small" value={value ?? null} onChange={(_, v) => v && onChange(v)}>
      <ToggleButton value="yes" color="success" sx={{ px: 2.5, py: 0.35 }}>Yes</ToggleButton>
      <ToggleButton value="no" color="error" sx={{ px: 2.5, py: 0.35 }}>No</ToggleButton>
    </ToggleButtonGroup>
  )
}

function Uploader({ value, label, required, onChange }) {
  const docs = value || []
  const pick = (e) => {
    const names = Array.from(e.target.files || []).map((f) => f.name)
    if (names.length) onChange([...docs, ...names])
    e.target.value = ''
  }
  return (
    <Framed label={label} required={required}>
      <Button component="label" size="small" variant="outlined" startIcon={<UploadFileIcon />} sx={{ mt: 0.25 }}>
        Upload
        <input type="file" hidden multiple onChange={pick} />
      </Button>
      {docs.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
          {docs.map((n, i) => (
            <Chip key={i} size="small" variant="outlined" icon={<DescriptionOutlinedIcon />} label={n}
              onDelete={() => onChange(docs.filter((_, idx) => idx !== i))} />
          ))}
        </Box>
      )}
    </Framed>
  )
}

function Field({ f, value, values, computed, onChange, error }) {
  if (f.type === 'subheading') {
    return (
      <Grid size={12}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
          <Typography variant="overline" color="secondary.dark" sx={{ whiteSpace: 'nowrap' }}>{f.label}</Typography>
          <Divider sx={{ flexGrow: 1 }} />
        </Stack>
      </Grid>
    )
  }
  if (f.type === 'yesno') {
    return (
      <Grid size={{ xs: 12, sm: f.span || 6 }}>
        <Framed label={f.label} required={f.required}><YesNo value={value} onChange={onChange} /></Framed>
      </Grid>
    )
  }
  if (f.type === 'radio') {
    return (
      <Grid size={{ xs: 12, sm: f.span || 6 }}>
        <Framed label={f.label} required={f.required}>
          <RadioGroup row value={value ?? ''} onChange={(e) => onChange(e.target.value)} sx={{ my: -0.5 }}>
            {optsOf(f, values).map((o) => <FormControlLabel key={o} value={o} control={<Radio size="small" />} label={o} />)}
          </RadioGroup>
        </Framed>
      </Grid>
    )
  }
  if (f.type === 'checkboxes') {
    const arr = value || []
    const toggle = (o) => onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o])
    return (
      <Grid size={12}>
        <Framed label={f.label} required={f.required}>
          <FormGroup row sx={{ gap: 0.5 }}>
            {optsOf(f, values).map((o) => (
              <FormControlLabel key={o} sx={{ mr: 2 }} control={<Checkbox size="small" checked={arr.includes(o)} onChange={() => toggle(o)} />} label={o} />
            ))}
          </FormGroup>
        </Framed>
      </Grid>
    )
  }
  if (f.type === 'file') {
    return <Grid size={{ xs: 12, sm: f.span || 6 }}><Uploader value={value} label={f.label} required={f.required} onChange={onChange} /></Grid>
  }
  if (f.type === 'computed') {
    return (
      <Grid size={{ xs: 12, sm: f.span || 4 }}>
        <TextField size="small" label={f.label} value={computed} fullWidth
          InputProps={{ readOnly: true, startAdornment: (
            <InputAdornment position="start">
              {f.prefix ? <Typography color="secondary.dark" fontWeight={700}>{f.prefix}</Typography> : <FunctionsIcon fontSize="small" color="secondary" />}
            </InputAdornment>) }}
          helperText="Auto-calculated"
          sx={{ '& .MuiInputBase-input': { fontWeight: 700, color: 'secondary.dark' }, '& .MuiInputBase-root': { bgcolor: 'secondary.light' } }} />
      </Grid>
    )
  }

  const isSelect = f.type === 'select'
  const opts = isSelect ? optsOf(f, values) : []
  const selVal = isSelect ? (opts.includes(value) ? value : '') : (value ?? '')
  const multiline = f.type === 'textarea'
  const verified = f.otp && values[`${f.name}_verified`]
  const counter = f.max ? `${String(value ?? '').length} / ${f.max}` : null

  return (
    <Grid size={{ xs: 12, sm: f.span || 6 }}>
      <TextField
        size="small"
        label={f.label + (f.required ? ' *' : '')}
        placeholder={f.placeholder}
        helperText={error || counter || f.help}
        error={!!error}
        type={['number', 'email', 'tel'].includes(f.type) && !isSelect ? f.type : 'text'}
        multiline={multiline}
        minRows={multiline ? (f.rows || 2) : undefined}
        select={isSelect}
        value={selVal}
        onChange={(e) => onChange(e.target.value)}
        inputProps={{ maxLength: f.max }}
        InputProps={{
          readOnly: f.readOnly,
          startAdornment: f.prefix ? <InputAdornment position="start">{f.prefix}</InputAdornment> : undefined,
          endAdornment: f.otp ? (
            <InputAdornment position="end">
              {verified
                ? <Chip size="small" color="success" icon={<VerifiedIcon />} label="Verified" />
                : <Button size="small" disabled={!!error || !value} onClick={() => onChange.verify?.()}>Verify OTP</Button>}
            </InputAdornment>
          ) : undefined,
        }}
        sx={f.readOnly ? { '& .MuiInputBase-root': { bgcolor: 'action.hover' } } : undefined}
        fullWidth
      >
        {isSelect && opts.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
      </TextField>
    </Grid>
  )
}

const isFilled = (v) => (Array.isArray(v) ? v.length > 0 : v != null && v !== '')

const isVisible = (f, values) => !f.showIf || f.showIf(values)

const sectionDone = (sec, values) => {
  const inputs = sec.fields.filter((f) => !['subheading', 'computed'].includes(f.type) && isVisible(f, values))
  if (inputs.length === 0) return false
  const anyFilled = inputs.some((f) => isFilled(values[f.name]))
  const allValid = inputs.every((f) => (!f.required || isFilled(values[f.name])) && !fieldError(f, values[f.name], values))
  return anyFilled && allValid
}

export default function FormRenderer({ schema, accent = 'primary', values, setValue }) {
  const compute = (f) => {
    if (f.formula) { const r = f.formula(values); return r == null ? '' : r }
    if (f.sum.every((n) => values[n] == null || values[n] === '')) return ''
    return f.sum.reduce((a, n) => a + (parseFloat(values[n]) || 0), 0)
  }

  const total = schema.sections.length
  const doneCount = schema.sections.filter((s) => sectionDone(s, values)).length
  const pct = Math.round((doneCount / total) * 100)

  return (
    <Stack spacing={2}>
      <Card sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle2" color="text.secondary">Completion</Typography>
          <Typography variant="subtitle2" color={`${accent}.main`}>{doneCount} / {total} sections</Typography>
        </Stack>
        <LinearProgress variant="determinate" value={pct} color={accent} sx={{ height: 8, borderRadius: 5, bgcolor: 'action.hover' }} />
      </Card>

      {schema.sections.map((sec) => {
        const done = sectionDone(sec, values)
        const Icon = sectionIcon(sec.title)
        return (
          <Card key={sec.n} sx={{ overflow: 'hidden', transition: 'box-shadow .2s', '&:hover': { boxShadow: '0 8px 24px rgba(15,23,42,0.07)' } }}>
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
            <Box sx={{ p: { xs: 2, md: 2.5 } }}>
              {sec.desc && <Typography variant="body2" color="text.secondary" mb={2}>{sec.desc}</Typography>}
              <Grid container spacing={2}>
                {sec.fields.map((f) => {
                  if (!isVisible(f, values)) return null
                  const change = (v) => setValue(f.name, v)
                  if (f.otp) change.verify = () => setValue(`${f.name}_verified`, true)
                  return (
                    <Field key={f.name} f={f} value={values[f.name]} values={values}
                      computed={f.type === 'computed' ? compute(f) : undefined}
                      error={fieldError(f, values[f.name], values)}
                      onChange={change} />
                  )
                })}
              </Grid>
            </Box>
          </Card>
        )
      })}
    </Stack>
  )
}

export function defaultsFor(schema) {
  const out = {}
  schema.sections.forEach((s) => s.fields.forEach((f) => { if (f.default != null) out[f.name] = f.default }))
  return out
}
