import { memo, useMemo, useRef } from 'react'
import { Box, MenuItem, TextField } from '@mui/material'
import { STATES } from '../../../../geo'
import { stackedLabelSx } from '../../../../components/workspace/formStyles'
import { LABELS, normaliseInput, validateField } from './validation'

const FIELD_NAMES = ['ia_name', 'state', 'pan_no', 'email']

// IdentityFields
// ────────────────────────────────────────────────────────────────────────
// The four seed fields at the top of the Eligibility Matrix tab:
// IA Name · State · PAN · Primary contact email.
//
// Layout uses an auto-fit CSS grid (min 240px per column) so the row
// wraps naturally — IA name / State / PAN sit in row 1 on a normal
// screen, the email drops to row 2 alone.
//
// Fully controlled: parent owns `values` + `errors` maps and provides
// `onChange(name, nextValue)` and `onBlur(name, error)` handlers. Live
// typing runs through `normaliseInput` to strip disallowed whitespace
// inline; blur triggers full field validation via `validateField`.
function IdentityFields({ values, errors, touched, onChange, onBlur, disabled = false }) {
  // Ref-mirror `values` so per-field blur handlers can read the latest value
  // without re-materialising on every keystroke — otherwise each TextField
  // gets fresh onChange/onBlur props each render and reconciles its input.
  const valuesRef = useRef(values)
  valuesRef.current = values

  const handlers = useMemo(
    () => FIELD_NAMES.reduce((acc, name) => {
      acc[name] = {
        onChange: (e) => onChange(name, normaliseInput(name, e.target.value)),
        onBlur: () => onBlur(name, validateField(name, valuesRef.current[name])),
      }
      return acc
    }, {}),
    [onChange, onBlur],
  )

  const commonProps = (name) => ({
    value: values[name] || '',
    onChange: handlers[name].onChange,
    onBlur: handlers[name].onBlur,
    error: !!(touched[name] && errors[name]),
    helperText: touched[name] && errors[name] ? errors[name] : undefined,
    disabled,
    size: 'small',
    fullWidth: true,
  })

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fit, minmax(240px, 1fr))' },
        columnGap: 3,
        rowGap: 2.25,
        ...stackedLabelSx,
      }}
    >
      <TextField
        {...commonProps('ia_name')}
        label={LABELS.ia_name}
        inputProps={{ maxLength: 120 }}
      />
      <TextField
        {...commonProps('state')}
        label={LABELS.state}
        select
      >
        {STATES.map((s) => (
          <MenuItem key={s} value={s}>{s}</MenuItem>
        ))}
      </TextField>
      <TextField
        {...commonProps('pan_no')}
        label={LABELS.pan_no}
        inputProps={{
          maxLength: 10,
          style: { fontFamily: 'ui-monospace, "Roboto Mono", monospace', letterSpacing: '0.03em' },
        }}
      />
      <TextField
        {...commonProps('email')}
        label={LABELS.email}
        type="email"
        inputProps={{ maxLength: 254 }}
      />
    </Box>
  )
}

export default memo(IdentityFields)
