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

  // Reserve a single-line helper slot so a field's row height doesn't
  // grow when its error appears (which used to shift the entire grid
  // and mis-align siblings). The help text is a whitespace character
  // so the DOM node still occupies space when there's no error / hint.
  const commonProps = (name, hint) => {
    const err = touched[name] && errors[name]
    return {
      value: values[name] || '',
      onChange: handlers[name].onChange,
      onBlur: handlers[name].onBlur,
      error: !!err,
      helperText: err || hint || ' ',
      disabled,
      size: 'small',
      fullWidth: true,
    }
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fit, minmax(240px, 1fr))' },
        columnGap: 3,
        rowGap: 2,
        alignItems: 'flex-start',
        // Uniform helper text row — same size + colour whether the
        // field is showing an error, a hint, or nothing at all. Keeps
        // the identity row visually locked to one grid rhythm.
        '& .MuiFormHelperText-root': {
          minHeight: '1.15em',
          fontSize: 11.5,
          lineHeight: 1.35,
          marginTop: '4px',
          whiteSpace: 'normal',
        },
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
        {...commonProps('pan_no', 'Company, Trust, AOP or Government PAN')}
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
