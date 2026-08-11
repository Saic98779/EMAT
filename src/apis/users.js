import { apiFetch } from '../api'

// Backend `user-controller`.
const PATH = '/users'

// Backend role enum — mirrors the values documented on GET /users/search.
// Kept as a plain object rather than a TS enum so it's usable directly as
// dropdown values without indirection.
export const ROLES = Object.freeze({
  MANPOWER_AGENCY: 'MANPOWER_AGENCY',
  BSE: 'BSE',
  GT_FIELD_TEAM: 'GT_FIELD_TEAM',
  GT_PMU: 'GT_PMU',
  SIDBI_SDE: 'SIDBI_SDE',
  SIDBI_RO: 'SIDBI_RO',
  SIDBI_HO_MAKER: 'SIDBI_HO_MAKER',
  SIDBI_HO_CHECKER: 'SIDBI_HO_CHECKER',
  CLUSTER_EXPERT: 'CLUSTER_EXPERT',
})

// GET /users — full directory.
export function listUsers({ signal } = {}) {
  return apiFetch(PATH, { signal })
}

// POST /users — create a new user. Body shape matches the backend
// CreateUserRequest (username, password, firstName, lastName, email,
// district, state, role, active).
export function createUser(body, { signal } = {}) {
  return apiFetch(PATH, { method: 'POST', body, signal })
}

// GET /users/by-role?role=<role>
// Filters users by their backend role code. Returns `[{ id, username,
// firstName, lastName, email, district, state, role, active }]`.
// Used by the BSE candidate form to populate the "Offer Letter Vendor"
// dropdown (with role=MANPOWER_AGENCY).
export function listUsersByRole(role, { signal } = {}) {
  const q = new URLSearchParams({ role: role ?? '' }).toString()
  return apiFetch(`${PATH}/by-role?${q}`, { signal })
}

// GET /users/search?district=…&state=…&role=…
// All three params are optional; omit falsy ones so we don't send `role=`.
export function searchUsers({ district, state, role } = {}, { signal } = {}) {
  const q = new URLSearchParams()
  if (district) q.set('district', district)
  if (state) q.set('state', state)
  if (role) q.set('role', role)
  const qs = q.toString()
  return apiFetch(`${PATH}/search${qs ? `?${qs}` : ''}`, { signal })
}

// Small helper: backends return either a raw array, a Spring Page
// (`{ content: [] }`), or `{ items: [] }`. Normalise to an array.
export function unwrapList(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.content)) return data.content
  if (Array.isArray(data?.items)) return data.items
  return []
}

// Human-friendly display for a User DTO. Used by dropdowns that need to show
// the officer's name and posting.
export function formatUser(u = {}) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.username || 'User'
  const posting = [u.district, u.state].filter(Boolean).join(', ')
  return posting ? `${name} — ${posting}` : name
}
