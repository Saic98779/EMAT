import {
  Box, Card, Grid, Stack, Typography, TextField, MenuItem, InputAdornment,
  ToggleButtonGroup, ToggleButton, Avatar, Divider,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import FunctionsIcon from '@mui/icons-material/Functions'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

function YesNo({ value, onChange }) {
  return (
    <ToggleButtonGroup exclusive size="small" value={value ?? null} onChange={(_, v) => v && onChange(v)}>
      <ToggleButton value="yes" color="success" sx={{ px: 2, py: 0.4 }}>Yes</ToggleButton>
      <ToggleButton value="no" color="error" sx={{ px: 2, py: 0.4 }}>No</ToggleButton>
    </ToggleButtonGroup>
  )
}

function Field({ f, value, computed, onChange }) {
  if (f.type === 'subheading') {
    return (
      <Grid size={12}>
        <Typography variant="overline" color="secondary.dark" sx={{ display: 'block', mt: 0.5 }}>{f.label}</Typography>
        <Divider sx={{ mt: 0.5 }} />
      </Grid>
    )
  }
  if (f.type === 'yesno') {
    return (
      <Grid size={{ xs: 12, sm: f.span || 6 }}>
        <Stack spacing={0.5}>
          <Typography variant="body2" fontWeight={500}>{f.label}</Typography>
          <YesNo value={value} onChange={onChange} />
        </Stack>
      </Grid>
    )
  }
  if (f.type === 'computed') {
    return (
      <Grid size={{ xs: 12, sm: f.span || 4 }}>
        <TextField
          size="small" label={f.label} value={computed} fullWidth
          InputProps={{ readOnly: true, startAdornment: (
            <InputAdornment position="start">
              {f.prefix ? <Typography color="secondary.dark" fontWeight={700}>{f.prefix}</Typography> : <FunctionsIcon fontSize="small" color="secondary" />}
            </InputAdornment>
          ) }}
          helperText="Auto-calculated"
          sx={{ '& .MuiInputBase-input': { fontWeight: 700, color: 'secondary.dark' }, '& .MuiInputBase-root': { bgcolor: 'secondary.light' } }}
        />
      </Grid>
    )
  }
  const multiline = f.type === 'textarea'
  return (
    <Grid size={{ xs: 12, sm: f.span || 6 }}>
      <TextField
        size="small"
        label={f.label}
        placeholder={f.placeholder}
        helperText={f.help}
        type={['number', 'email', 'tel'].includes(f.type) ? f.type : 'text'}
        multiline={multiline}
        minRows={multiline ? 2 : undefined}
        select={f.type === 'select'}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        InputProps={{
          readOnly: f.readOnly,
          startAdornment: f.prefix ? <InputAdornment position="start">{f.prefix}</InputAdornment> : undefined,
        }}
        sx={f.readOnly ? { '& .MuiInputBase-root': { bgcolor: 'action.hover' } } : undefined}
        fullWidth
      >
        {f.type === 'select' && f.options?.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
      </TextField>
    </Grid>
  )
}

// Seed initial values from any field `default`s in a schema.
export function defaultsFor(schema) {
  const out = {}
  schema.sections.forEach((s) => s.fields.forEach((f) => { if (f.default != null) out[f.name] = f.default }))
  return out
}

// Is every non-decorative field in the section filled?
const sectionDone = (sec, values) => {
  const inputs = sec.fields.filter((f) => !['subheading', 'computed'].includes(f.type))
  return inputs.length > 0 && inputs.every((f) => values[f.name] != null && values[f.name] !== '')
}

export default function FormRenderer({ schema, accent = 'primary', values, setValue }) {
  const compute = (f) => {
    if (f.formula) { const r = f.formula(values); return r == null ? '' : r }
    if (f.sum.every((n) => values[n] == null || values[n] === '')) return ''
    return f.sum.reduce((a, n) => a + (parseFloat(values[n]) || 0), 0)
  }

  return (
    <Stack spacing={2}>
      {schema.sections.map((sec) => {
        const done = sectionDone(sec, values)
        return (
          <Card key={sec.n} sx={{ overflow: 'hidden' }}>
            <Stack direction="row" alignItems="center" spacing={1.5}
              sx={{ px: 2.5, py: 1.25, bgcolor: (t) => alpha(t.palette[accent].main, 0.08), borderBottom: '1px solid', borderColor: 'divider' }}>
              <Avatar sx={{ bgcolor: `${accent}.main`, color: '#fff', width: 28, height: 28, fontSize: '0.8rem', fontWeight: 700 }}>
                {sec.n}
              </Avatar>
              <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>{sec.title}</Typography>
              {done && <CheckCircleIcon fontSize="small" color="success" />}
            </Stack>
            <Box sx={{ p: { xs: 2, md: 2.5 } }}>
              {sec.desc && <Typography variant="body2" color="text.secondary" mb={2}>{sec.desc}</Typography>}
              <Grid container spacing={2}>
                {sec.fields.map((f) => (
                  <Field key={f.name} f={f} value={values[f.name]}
                    computed={f.type === 'computed' ? compute(f) : undefined}
                    onChange={(v) => setValue(f.name, v)} />
                ))}
              </Grid>
            </Box>
          </Card>
        )
      })}
    </Stack>
  )
}
