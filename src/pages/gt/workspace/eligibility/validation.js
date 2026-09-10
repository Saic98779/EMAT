// Validation rules for the Eligibility Matrix identity header. Kept as
// a pure module so both the field-level onBlur checks and the submit
// gate can share the same logic without duplicating regexes.
//
// Field names deliberately match the snake_case keys that the shared
// IA payload adapter (`apis/industryAssociations.js#toPayload`) reads —
// so the form state can be handed to the create/update helper without
// a rename step.

// Strict formats matching CBDT (PAN) + RFC 5322-lite (email). All inputs
// are trimmed first; whitespace anywhere in a value is invalid.
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const HAS_WHITESPACE_RE = /\s/

// The 4th character of an Indian PAN encodes the entity type. For an
// Industry Association we only accept the "collective / juridical"
// buckets (Company, Trust, Association of Persons, Government) — the
// individual + partnership + BOI + HUF + local-authority PANs are
// rejected per client rule (WhatsApp note 2026-09-04). Keyed as
// { code: labelForRejectMessage }.
const PAN_HOLDER_TYPES = {
  P: 'Individual',
  F: 'Firm / Partnership',
  B: 'Body of Individuals',
  H: 'Hindu Undivided Family',
  L: 'Local Authority',
}
const PAN_ALLOWED_HOLDERS = new Set(['C', 'T', 'A', 'G']) // Company, Trust, AOP, Government

export const FIELDS = ['ia_name', 'state', 'pan_no', 'email']

export const LABELS = {
  ia_name: 'IA name',
  state: 'State',
  pan_no: 'PAN',
  email: 'Primary contact email',
}

// Field-level validator — returns an error string, or empty string for OK.
// Ordering matters: required check first, then format.
export function validateField(name, raw) {
  const value = raw == null ? '' : String(raw).trim()

  switch (name) {
    case 'ia_name':
      if (!value) return 'Required'
      if (value.length < 3) return 'At least 3 characters'
      if (value.length > 120) return 'Under 120 characters'
      return ''

    case 'state':
      if (!value) return 'Pick a state'
      return ''

    case 'pan_no': {
      if (!value) return 'Required'
      if (HAS_WHITESPACE_RE.test(value)) return 'No spaces allowed'
      if (value.length !== 10) return '10-character PAN required'
      if (!PAN_RE.test(value)) return 'Format: AAAAA9999A'
      // Position 4 → entity type. Short one-line messages — the "why"
      // sits in the field's help text so the error itself stays tidy.
      const holder = value.charAt(3)
      if (PAN_HOLDER_TYPES[holder]) {
        return `${PAN_HOLDER_TYPES[holder]} PAN not allowed`
      }
      if (!PAN_ALLOWED_HOLDERS.has(holder)) {
        return 'PAN must belong to a Company, Trust, AOP or Government'
      }
      return ''
    }

    case 'email':
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
    case 'pan_no':
      return s.replace(HAS_WHITESPACE_RE, '').toUpperCase()
    case 'email':
      return s.replace(HAS_WHITESPACE_RE, '')
    case 'ia_name':
    case 'state':
    default:
      // Strip leading whitespace on type; trailing kept until blur so the
      // user can still type a space between words mid-word.
      return s.replace(/^\s+/, '')
  }
}
