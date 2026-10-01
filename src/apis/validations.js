import { apiFetch } from '../api'

// Lightweight validation endpoints — the backend exposes synchronous
// "is this value already taken?" checks the UI can call live while the
// user types, instead of discovering the clash only on submit via a
// 400 / unique-constraint error.
//
// GET /validation/pan?panNo=XXXXXXXXXX
// Envelope payload:
//   { panNo: "AABCS1234D", duplicate: true | false }
// Backend's `message` reads "PAN number already exists" / "PAN number is
// available" — we don't surface that string; the boolean `duplicate` is
// the contract.
//
// Path note: deployed prod backend mounts this at the SINGULAR
// `/validation/pan` (verified against the Swagger on
// api.emat-prod.metaversedu.in 2026-10-01). An earlier Swagger from a
// local backend showed the plural `/validations/pan` — ignore that; the
// prod path is the contract.
const PATH = '/validation'

export function validatePan(panNo, { signal } = {}) {
  const q = encodeURIComponent(String(panNo || '').toUpperCase().trim())
  return apiFetch(`${PATH}/pan?panNo=${q}`, { signal })
}
