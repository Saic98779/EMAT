import { apiFetch } from '../api'

// Backend `sustainability-matrix-controller`. One record = one GT/SDE
// sustainability assessment for an IA that already has an appraisal
// record. 22 boolean parameters + a frontend-computed total score.
//
// Placement in the flow: In-Principle Approved → Sustainability Matrix
// (no approval req) → Detailed Appraisal. The FK is `appraisalUuid`
// (the IA's appraisal record uuid, obtained via
// `getAppraisalByRegistration(registrationUuid).uuid`).
const PATH = '/sustainability-matrix'

export function getSustainabilityMatrix(uuid, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(uuid)}`, { signal })
}

// GET /sustainability-matrix/appraisal/{appraisalUuid}
// Fetch the sustainability record for a specific appraisal — used to
// know whether the matrix has already been submitted for this IA.
export function getSustainabilityMatrixByAppraisal(appraisalUuid, { signal } = {}) {
  return apiFetch(
    `${PATH}/appraisal/${encodeURIComponent(appraisalUuid)}`,
    { signal },
  )
}

export function createSustainabilityMatrix(values, { signal } = {}) {
  return apiFetch(PATH, { method: 'POST', body: toPayload(values), signal })
}

export function updateSustainabilityMatrix(uuid, values, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(uuid)}`, {
    method: 'PUT',
    body: toPayload(values),
    signal,
  })
}

export function deleteSustainabilityMatrix(uuid, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(uuid)}`, { method: 'DELETE', signal })
}

// ── Spec constants ────────────────────────────────────────────────────────
// 22 parameters across 7 dimensions; weights sum to 100.
export const DIMENSIONS = [
  {
    title: 'Governance',
    params: [
      { key: 'activeGoverningBody',        label: 'Active governing body',      weight: 5 },
      { key: 'election',                   label: 'Election',                   weight: 2 },
      { key: 'committees',                 label: 'Committees',                 weight: 2 },
      { key: 'documentedPolicies',         label: 'Documented policies',        weight: 2 },
      { key: 'attendance',                 label: 'Attendance',                 weight: 2 },
      { key: 'agm',                        label: 'AGM',                        weight: 2 },
    ],
  },
  {
    title: 'Membership Strength',
    params: [
      { key: 'activePayingMembers',      label: 'Number of Active Paying Members', weight: 10 },
      { key: 'retentionRate',            label: 'Retention Rate',                  weight: 10 },
    ],
  },
  {
    title: 'Financial Sustainability',
    params: [
      { key: 'ownSourceRevenueReserves', label: 'Own-Source revenue and reserves', weight: 10 },
      { key: 'annualRevenueThreshold',   label: 'Annual revenue Threshold',        weight: 10 },
    ],
  },
  {
    title: 'Service delivery',
    params: [
      { key: 'programServiceOffered',       label: 'Program/Service offered',         weight: 15 },
    ],
  },
  {
    title: 'Digital Maturity',
    params: [
      { key: 'website',                     label: 'Website',                 weight: 4 },
      { key: 'crm',                         label: 'CRM',                     weight: 2 },
      { key: 'digitalMemberDatabase',       label: 'Digital Member Database', weight: 2 },
      { key: 'socialMedia',                 label: 'Social Media',            weight: 2 },
    ],
  },
  {
    title: 'Stakeholder Engagement',
    params: [
      { key: 'government', label: 'Government', weight: 2 },
      { key: 'banks',      label: 'Banks',      weight: 2 },
      { key: 'sidbi',      label: 'SIDBI',      weight: 2 },
      { key: 'academia',   label: 'Academia',   weight: 2 },
      { key: 'corporates', label: 'Corporates', weight: 2 },
    ],
  },
  {
    title: 'Institutional Capacity',
    params: [
      { key: 'dedicatedStaff',              label: 'Dedicated Staff',        weight: 5 },
      { key: 'operationalProcesses',        label: 'Operational Processes',  weight: 5 },
    ],
  },
]

// Flat list of all 22 param keys — used by the payload adapter and the UI.
export const PARAM_KEYS = DIMENSIONS.flatMap((d) => d.params.map((p) => p.key))

export const MAX_SCORE = DIMENSIONS.reduce(
  (sum, d) => sum + d.params.reduce((s, p) => s + p.weight, 0),
  0,
)

// Sustainability tier bands per the client spec.
// 80-100 Highly Sustainable · 60-79 Developing Association ·
// 40-59 Vulnerable Association · <40 Weak.
export const TIERS = [
  { min: 80, label: 'Highly Sustainable',     color: 'success' },
  { min: 60, label: 'Developing Association', color: 'info' },
  { min: 40, label: 'Vulnerable Association', color: 'warning' },
  { min: 0,  label: 'Weak',                   color: 'error' },
]

export function categorise(answers = {}) {
  const score = computeScore(answers)
  const tier = TIERS.find((t) => score >= t.min) || TIERS[TIERS.length - 1]
  return { score, tier }
}

export function computeScore(answers = {}) {
  let total = 0
  for (const d of DIMENSIONS) {
    for (const p of d.params) {
      if (answers[p.key] === true) total += p.weight
    }
  }
  return total
}

// ── Payload adapter ────────────────────────────────────────────────────────
// Frontend values → backend `SustainabilityMatrixRequest`. `appraisalUuid`
// is required (the IA's appraisal record uuid, not the registration uuid).
// `totalScore` is recomputed here so the client never ships an
// inconsistent score.
export function toPayload(v = {}) {
  const payload = {
    appraisalUuid: str(v.appraisalUuid),
  }
  for (const k of PARAM_KEYS) {
    payload[k] = v[k] === true ? true : v[k] === false ? false : null
  }
  payload.totalScore = computeScore(v)
  return payload
}

const str = (v) => (v == null || v === '' ? null : String(v).trim() || null)
