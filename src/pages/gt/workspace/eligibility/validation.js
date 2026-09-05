// Validation rules for the Eligibility Matrix identity header. Kept as
// a pure module so both the field-level onBlur checks and the submit
// gate can share the same logic without duplicating regexes.

// Strict formats matching CBDT (PAN) + RFC 5322-lite (email). All inputs
// are trimmed first; whitespace anywhere in a value is invalid.
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const HAS_WHITESPACE_RE = /\s/

export const FIELDS = ['industryAssociationName', 'state', 'pan', 'emailId']

export const LABELS = {
  industryAssociationName: 'IA name',
  state: 'State',
  pan: 'PAN',
  emailId: 'Primary contact email',
}

// Field-level validator — returns an error string, or empty string for OK.
// Ordering matters: required check first, then format.
export function validateField(name, raw) {
  const value = raw == null ? '' : String(raw).trim()

  switch (name) {
    case 'industryAssociationName':
      if (!value) return 'Required'
      if (value.length < 3) return 'At least 3 characters'
      if (value.length > 120) return 'Under 120 characters'
      return ''

    case 'state':
      if (!value) return 'Pick a state'
      return ''

    case 'pan': {
      if (!value) return 'Required'
      if (HAS_WHITESPACE_RE.test(value)) return 'No spaces allowed'
      if (value.length !== 10) return '10 characters required'
      if (!PAN_RE.test(value)) return 'Format: AAAAA9999A'
      return ''
    }

    case 'emailId':
      if (!value) return 'Required'
      if (HAS_WHITESPACE_RE.test(value)) return 'No spaces allowed'
      if (!EMAIL_RE.test(value)) return 'Not a valid email'
      return ''

    default:
      return ''
  }
}

// Whole-form validator — { fieldName: error } map. Empty object === valid.
export function validateAll(values = {}) {
  const errors = {}
  for (const name of FIELDS) {
    const err = validateField(name, values[name])
    if (err) errors[name] = err
  }
  return errors
}

// Input transformer used on typing so users can't accidentally introduce
// invalid characters (mostly spaces). PAN gets uppercased in flight.
export function normaliseInput(name, raw) {
  const s = raw == null ? '' : String(raw)
  switch (name) {
    case 'pan':
      return s.replace(HAS_WHITESPACE_RE, '').toUpperCase()
    case 'emailId':
      return s.replace(HAS_WHITESPACE_RE, '')
    case 'industryAssociationName':
    case 'state':
    default:
      // Strip leading whitespace on type; trailing kept until blur so the
      // user can still type a space between words mid-word.
      return s.replace(/^\s+/, '')
  }
}
