import { memo, useEffect, useMemo, useRef } from 'react'
import { Box, MenuItem, TextField } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { STATES } from '../../../../geo'
import { stackedLabelSx } from '../../../../components/workspace/formStyles'
import { LABELS, normaliseInput, validateField } from './validation'
import { useValidatePan } from '../../../../queries'

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

  // UAT 2026-10-01 — live PAN uniqueness check against
  // `GET /validations/pan?panNo=…`. Fires as soon as the typed value
  // matches the 10-char PAN regex (the hook's internal `enabled` gate
  // handles that). We feed the result back to the parent via `onBlur`
  // on `pan_no` using a reserved pseudo-error so the parent's
  // `errors.pan_no` + submit-side `firstProblem` guard both block the
  // eligibility create — otherwise GT would create the IA row and get
  // the backend's raw unique-constraint 400 from the eligibility POST.
  //
  // The IA onboarding L1 form also wires this via the schema-driven
  // `panLookup: true` flag; here we repeat the plumbing because
  // IdentityFields is a hand-rolled form, not FormRenderer.
  const panQ = useValidatePan(values.pan_no)
  const panDuplicate = panQ.data?.data?.duplicate
  const panCheckLoading = panQ.isFetching
  const panLookupFailed = !!panQ.error
  useEffect(() => {
    // Only emit a duplicate error — the format error is already produced
    // by `validateField('pan_no', …)` on blur. We OR it against any
    // existing touched error so a format fault isn't masked.
    if (panDuplicate === true && values.pan_no) {
      onBlur('pan_no', 'This PAN is already registered to another IA.')
    } else if (panDuplicate === false && touched.pan_no && !errors.pan_no?.includes('registered')) {
      // Clear a stale "already registered" error once the backend says
      // the new PAN is clean — but leave format-level errors alone.
      if (errors.pan_no === 'This PAN is already registered to another IA.') {
        onBlur('pan_no', '')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panDuplicate])

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

  // PAN live-status strip — rendered BELOW the input (not in the
  // helperText slot, so the static format hint and the live status
  // don't fight over the same line). Only visible for the three
  // non-idle states; a user who hasn't typed a full PAN sees nothing
  // extra.
  const panStrip = (() => {
    const err = touched.pan_no && errors.pan_no
    // Format / required errors own the error state already; skip the
    // strip to avoid double-rendering the same message.
    if (err && panDuplicate !== true) return null
    if (panCheckLoading) return { label: 'Checking PAN…', tone: 'info' }
    if (panDuplicate === true) return { label: 'This PAN is already registered to another IA.', tone: 'error' }
    if (panDuplicate === false) return { label: 'PAN is available.', tone: 'success' }
    if (panLookupFailed) return { label: "Couldn't verify PAN right now — you can continue; the server will double-check on save.", tone: 'warning' }
    return null
  })()

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
      <Box>
        <TextField
          {...commonProps('pan_no', 'Company, Trust, AOP or Government PAN')}
          label={LABELS.pan_no}
          inputProps={{
            maxLength: 10,
            style: { fontFamily: 'ui-monospace, "Roboto Mono", monospace', letterSpacing: '0.03em' },
          }}
        />
        {panStrip && (
          <Box
            sx={(t) => {
              const palette = t.palette[panStrip.tone] || t.palette.info
              return {
                mt: 0.25,
                display: 'flex', alignItems: 'center', gap: 0.75,
                px: 1.25, py: 0.5, borderRadius: 1,
                bgcolor: alpha(palette.main, 0.1),
                color: palette.dark,
                fontSize: 12.5, fontWeight: 600,
              }
            }}
          >
            <Box component="span" sx={(t) => ({ fontSize: 10, color: (t.palette[panStrip.tone] || t.palette.info).main })}>●</Box>
            <Box component="span">{panStrip.label}</Box>
          </Box>
        )}
      </Box>
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
