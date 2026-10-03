// Allowed characters for user-typed text, app-wide (security audit
// 2026-10-01, "Improper Input Validation"). Everything not listed for a
// charset is rejected — the global InputGuard stops it being typed or
// pasted, and FormRenderer validation blocks submit if a saved value
// already contains it.
//
//   text      — default for every text box / textarea: letters (any
//               script), digits, whitespace and  . , - / _ # ₹
//   email     — letters, digits and  . @ _ - +
//   username  — login username: letters, digits and  . @ _ -
//   url       — URL fields (website / link): letters, digits and the
//               URL punctuation  . - _ ~ : / ? # = & % +
//   none      — no restriction (passwords; opt-in via data-charset="none")
//
// This is defence in depth only — the backend must reject the same
// characters, since anything client-side can be bypassed.

const DISALLOWED = {
  text: /[^\p{L}\p{M}\p{N}\s.,\-/_#₹]/u,
  email: /[^A-Za-z0-9.@_\-+]/,
  username: /[^A-Za-z0-9.@_-]/,
  url: /[^A-Za-z0-9.\-_~:/?#=&%+]/,
}

const ALLOWED_HINT = {
  text: 'letters, numbers and . , - / _ # ₹',
  email: 'letters, numbers and . @ _ - +',
  username: 'letters, numbers and . @ _ -',
  url: 'letters, numbers and URL characters',
}

const global = (re) => new RegExp(re.source, `${re.flags}g`)

export function badChars(value, charset = 'text') {
  const re = DISALLOWED[charset]
  if (!re || value == null) return []
  const hits = String(value).match(global(re)) || []
  return [...new Set(hits)]
}

export function stripBadChars(value, charset = 'text') {
  const re = DISALLOWED[charset]
  if (!re || value == null) return value
  return String(value).replace(global(re), '')
}

export function charsetError(value, charset = 'text') {
  const bad = badChars(value, charset)
  if (!bad.length) return ''
  return `Special characters not allowed: ${formatChars(bad)}`
}

export function allowedHint(charset = 'text') {
  return ALLOWED_HINT[charset] || ''
}

// Which charset an <input>/<textarea> uses. An explicit
// `data-charset` wins; otherwise inferred from type and name so forms
// that never opted in (react-hook-form, plain TextFields) still get a
// sensible rule.
const UNRESTRICTED_TYPES = new Set([
  'password', 'number', 'date', 'time', 'datetime-local', 'month', 'week',
  'hidden', 'file', 'checkbox', 'radio', 'range', 'color', 'submit', 'button',
])

export function charsetForElement(el) {
  if (!el || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return null
  if (el.readOnly || el.disabled) return null
  const explicit = el.dataset?.charset
  if (explicit) return explicit === 'none' ? null : explicit
  const type = (el.getAttribute('type') || 'text').toLowerCase()
  if (UNRESTRICTED_TYPES.has(type)) return null
  if (type === 'email') return 'email'
  if (type === 'url') return 'url'
  const name = (el.getAttribute('name') || '').toLowerCase()
  if (name === 'username') return 'username'
  if (name.includes('email')) return 'email'
  if (/(url|link|website)/.test(name)) return 'url'
  return 'text'
}

// Schema field → charset, for FormRenderer.
export function charsetForField(f) {
  if (f?.charset) return f.charset
  if (f?.type === 'email') return 'email'
  if (/(url|link|website)/i.test(f?.name || '')) return 'url'
  return 'text'
}

export function formatChars(chars) {
  return chars.map((c) => (c === ' ' ? 'space' : c === '\t' ? 'tab' : c === '\n' ? 'new line' : c)).join(' ')
}
