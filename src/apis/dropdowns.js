import { apiFetch } from '../api'

// GET /branch/dropdown?state=<state>
// → [{ uuid, branchName }]
export function listBranchesByState(state, { signal } = {}) {
  const q = new URLSearchParams({ state: state ?? '' }).toString()
  return apiFetch(`/branch/dropdown?${q}`, { signal })
}

// GET /sidbi-sde/dropdown?branchUuid=<uuid>
// → [{ uuid, name }]
export function listSdesByBranch(branchUuid, { signal } = {}) {
  const q = new URLSearchParams({ branchUuid: branchUuid ?? '' }).toString()
  return apiFetch(`/sidbi-sde/dropdown?${q}`, { signal })
}

// GET /vendors/dropdown
// → [{ uuid, name }] — third-party vendors that will send the offer letter
// to a newly approved BSE candidate.
export function listVendorsDropdown({ signal } = {}) {
  return apiFetch('/vendors/dropdown', { signal })
}
