import { apiFetch } from '../api'

// Backend `regional-office-controller` — SIDBI Regional Offices master.
// Used as a searchable dropdown source on the DIA monitoring forms
// (Capacity Building, Exposure Visit, Credit Application) so GT doesn't
// have to retype the RO name on every record.
const PATH = '/regional-office'

export function listRegionalOffices({ signal } = {}) {
  return apiFetch(PATH, { signal })
}

// Collapse the usual backend response shapes to a flat array.
export function unwrapList(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.content)) return data.content
  if (Array.isArray(data?.items)) return data.items
  return []
}

// Shape an RO row as a FormRenderer autocomplete option. Backend update
// 2026-11-09 — DIA CB Program and Exposure Visit now accept both `roId`
// and `roName`, so the option keeps the id as the value and the display
// name as the label. `diaMonitoring.toRequest` lifts both fields when the
// user picks an option; freeSolo entries ship only the typed name.
export function toRoOption(r = {}) {
  const name = r.roName || r.name || r.city || `RO #${r.id}`
  const id = r.id ?? r.roId
  return { value: id, label: name }
}
