import { apiFetch } from '../api'

// GET /branch/dropdown?state=<state>
// → [{ id, branchName }]
export function listBranchesByState(state, { signal } = {}) {
  const q = new URLSearchParams({ state: state ?? '' }).toString()
  return apiFetch(`/branch/dropdown?${q}`, { signal })
}

// GET /sidbi-sde/dropdown?branchId=<id>
// → [{ id, name }]
// Backend renamed the query param from `branchUuid` → `branchId` (Long)
// in the Aug '26 id-migration.
export function listSdesByBranch(branchId, { signal } = {}) {
  const q = new URLSearchParams({ branchId: branchId ?? '' }).toString()
  return apiFetch(`/sidbi-sde/dropdown?${q}`, { signal })
}

