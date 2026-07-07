import { useState } from 'react'
import {
  Box, Card, CardContent, Grid, Stack, Typography, TextField, MenuItem,
  ToggleButtonGroup, ToggleButton, Avatar, Divider,
} from '@mui/material'

function YesNo({ value, onChange }) {
  return (
    <ToggleButtonGroup exclusive size="small" value={value ?? null} onChange={(_, v) => v && onChange(v)}>
      <ToggleButton value="yes" color="success" sx={{ px: 2.5 }}>Yes</ToggleButton>
      <ToggleButton value="no" color="error" sx={{ px: 2.5 }}>No</ToggleButton>
    </ToggleButtonGroup>
  )
}

function Field({ f, value, onChange }) {
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
        <Stack spacing={0.75}>
          <Typography variant="body2" fontWeight={500}>{f.label}</Typography>
          <YesNo value={value} onChange={onChange} />
        </Stack>
      </Grid>
    )
  }
  const multiline = f.type === 'textarea'
  return (
    <Grid size={{ xs: 12, sm: f.span || 6 }}>
      <TextField
        label={f.label}
        placeholder={f.placeholder}
        helperText={f.help}
        type={['number', 'email', 'tel'].includes(f.type) ? f.type : 'text'}
        multiline={multiline}
        minRows={multiline ? 2 : undefined}
        select={f.type === 'select'}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        fullWidth
      >
        {f.type === 'select' && f.options?.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
      </TextField>
    </Grid>
  )
}

export default function FormRenderer({ schema, accent = 'primary' }) {
  const [values, setValues] = useState({})
  const set = (name) => (v) => setValues((p) => ({ ...p, [name]: v }))

  return (
    <Stack spacing={2.5}>
      {schema.sections.map((sec) => (
        <Card key={sec.n}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Stack direction="row" alignItems="center" spacing={1.5} mb={2.5}>
              <Avatar sx={{ bgcolor: `${accent}.light`, color: `${accent}.dark`, width: 34, height: 34, fontSize: '0.9rem', fontWeight: 700 }}>
                {sec.n}
              </Avatar>
              <Typography variant="h6">{sec.title}</Typography>
            </Stack>
            <Grid container spacing={2.5}>
              {sec.fields.map((f) => (
                <Field key={f.name} f={f} value={values[f.name]} onChange={set(f.name)} />
              ))}
            </Grid>
          </CardContent>
        </Card>
      ))}
    </Stack>
  )
}
