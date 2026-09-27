import { apiFetch } from '../api'

// Backend `pincode-controller` — India pincode master.
//
//   GET /pincodes/states                      → string[]  state names
//   GET /pincodes/districts?state=            → string[]  districts of a state
//   GET /pincodes?state=&district=            → string[]  pincodes (both filters optional)
//
// There is no pincode → district endpoint, so the district is resolved by
// scanning the state's districts (see findDistrictsForPincode).

const PATH = '/pincodes'

export function listPincodeStates({ signal } = {}) {
  return apiFetch(`${PATH}/states`, { signal }).then(asList)
}

export function listPincodeDistricts(state, { signal } = {}) {
  const q = new URLSearchParams({ state: state ?? '' }).toString()
  return apiFetch(`${PATH}/districts?${q}`, { signal }).then(asList)
}

export function listPincodes({ state, district, signal } = {}) {
  const q = new URLSearchParams()
  if (state) q.set('state', state)
  if (district) q.set('district', district)
  return apiFetch(`${PATH}?${q}`, { signal }).then((r) => asList(r).map(pinOf).filter(Boolean))
}

// The IA's state (from the eligibility matrix) and the pincode master may
// spell a state differently ("Jammu & Kashmir" vs "JAMMU AND KASHMIR").
export function normaliseState(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z]/g, '')
}

export function matchState(states, target) {
  const want = normaliseState(target)
  if (!want) return null
  return (states || []).find((s) => normaliseState(s) === want) || null
}

// Districts of `state` whose pincode list contains `pincode`. Scans in
// small batches and stops at the first batch with a hit; each district's
// list goes through `fetchList` so the caller can cache it.
export async function findDistrictsForPincode(districts, pincode, fetchList, batchSize = 8) {
  const hits = []
  for (let i = 0; i < districts.length; i += batchSize) {
    const batch = districts.slice(i, i + batchSize)
    const lists = await Promise.all(batch.map((d) => fetchList(d)))
    lists.forEach((pins, j) => { if (pins.includes(pincode)) hits.push(batch[j]) })
    if (hits.length) break
  }
  return hits
}

function asList(v) {
  if (Array.isArray(v)) return v
  if (Array.isArray(v?.content)) return v.content
  return []
}

function pinOf(v) {
  const m = String(v ?? '').match(/\d{6}/)
  return m ? m[0] : null
}
