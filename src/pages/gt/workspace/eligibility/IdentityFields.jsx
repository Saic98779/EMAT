import { memo, useCallback } from 'react'
import { MenuItem, Stack, TextField, Typography } from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { alpha, useTheme } from '@mui/material/styles'
import { STATES } from '../../../../geo'
import { LABELS, normaliseInput, validateField } from './validation'

// IdentityFields
// ────────────────────────────────────────────────────────────────────────
// The four seed fields at the top of the Eligibility Matrix tab:
// IA Name · State · PAN · Primary contact email. These same values
// pre-fill the L1 Registration form later — the caption below reminds
// the user of that so they don't wonder why we're asking twice.
//
// Fully controlled: parent owns `values` + `errors` maps, and provides
// `onChange(name, nextValue)` and `onBlur(name)` handlers. Live typing
// runs through `normaliseInput` to strip disallowed whitespace inline;
// blur triggers full field validation via `validateField`.
function IdentityFields({ values, errors, touched, onChange, onBlur, disabled = false }) {
  const theme = useTheme()

  const handleChange = useCallback(
    (name) => (e) => {
      const next = normaliseInput(name, e.target.value)
      onChange(name, next)
    },
    [onChange],
  )

  const handleBlur = useCallback(
    (name) => () => {
      onBlur(name, validateField(name, values[name]))
    },
    [onBlur, values],
  )

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        useFlexGap
        sx={{ '& > *': { flex: 1 } }}
      >
        <TextField
          label={LABELS.industryAssociationName}
          value={values.industryAssociationName || ''}
          onChange={handleChange('industryAssociationName')}
          onBlur={handleBlur('industryAssociationName')}
          error={!!(touched.industryAssociationName && errors.industryAssociationName)}
          helperText={(touched.industryAssociationName && errors.industryAssociationName) || ' '}
          disabled={disabled}
          size="small"
          fullWidth
          inputProps={{ maxLength: 120 }}
        />
        <TextField
          label={LABELS.state}
          value={values.state || ''}
          onChange={handleChange('state')}
          onBlur={handleBlur('state')}
          error={!!(touched.state && errors.state)}
          helperText={(touched.state && errors.state) || ' '}
          disabled={disabled}
          select
          size="small"
          fullWidth
        >
          {STATES.map((s) => (
            <MenuItem key={s} value={s}>{s}</MenuItem>
          ))}
        </TextField>
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        useFlexGap
        sx={{ '& > *': { flex: 1 } }}
      >
        <TextField
          label={LABELS.pan}
          value={values.pan || ''}
          onChange={handleChange('pan')}
          onBlur={handleBlur('pan')}
          error={!!(touched.pan && errors.pan)}
          helperText={(touched.pan && errors.pan) || 'Format: AAAAA9999A'}
          disabled={disabled}
          size="small"
          fullWidth
          inputProps={{
            maxLength: 10,
            style: { fontFamily: 'ui-monospace, "Roboto Mono", monospace', letterSpacing: '0.03em' },
          }}
        />
        <TextField
          label={LABELS.emailId}
          value={values.emailId || ''}
          onChange={handleChange('emailId')}
          onBlur={handleBlur('emailId')}
          error={!!(touched.emailId && errors.emailId)}
          helperText={(touched.emailId && errors.emailId) || ' '}
          disabled={disabled}
          size="small"
          fullWidth
          type="email"
          inputProps={{ maxLength: 254 }}
        />
      </Stack>

      <Stack direction="row" alignItems="center" spacing={0.75}
        sx={{ color: alpha(theme.palette.text.primary, 0.55), fontSize: 12.5 }}
      >
        <InfoOutlinedIcon sx={{ fontSize: 15 }} />
        <Typography variant="caption" sx={{ fontSize: 12.5 }}>
          These fields will pre-fill your Registration form later.
        </Typography>
      </Stack>
    </Stack>
  )
}

export default memo(IdentityFields)
