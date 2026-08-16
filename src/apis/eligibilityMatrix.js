import { apiFetch } from '../api'

// Backend `eligibility-matrix-controller`. One record = one GT-Field-Team
// eligibility assessment for a candidate IA (22 boolean parameters + a
// computed total score).
//
// Workflow: GT fills state/IA name/PAN/email + 22 matrix answers →
// frontend POSTs to `/industry-association-registrations` first with the
// header identity fields → uses the returned `registrationUuid` to POST
// here. The score is computed on the frontend from spec weights.
const PATH = '/eligibility-matrix'

export function listEligibilityMatrix({ signal } = {}) {
  return apiFetch(PATH, { signal })
}

export function getEligibilityMatrix(uuid, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(uuid)}`, { signal })
}

// GET /eligibility-matrix/registration/{registrationUuid}
// Fetch the eligibility record for a specific IA. Same "single object vs
// list" ambiguity as the CAPEX endpoint — caller should coerce defensively.
export function getEligibilityMatrixByRegistration(registrationUuid, { signal } = {}) {
  return apiFetch(
    `${PATH}/registration/${encodeURIComponent(registrationUuid)}`,
    { signal },
  )
}

export function createEligibilityMatrix(values, { signal } = {}) {
  return apiFetch(PATH, { method: 'POST', body: toPayload(values), signal })
}

export function updateEligibilityMatrix(uuid, values, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(uuid)}`, {
    method: 'PUT',
    body: toPayload(values),
    signal,
  })
}

export function deleteEligibilityMatrix(uuid, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(uuid)}`, { method: 'DELETE', signal })
}

// ── Spec constants ────────────────────────────────────────────────────────
// Parameter list with weights, dimension groups, guide (tooltip), and
// reason (secondary tooltip). Kept here so the form and the payload share
// the same source of truth. Weights sum to 100.
export const DIMENSIONS = [
  {
    title: 'Membership Base and Cluster representation',
    params: [
      { key: 'activeMembers200',              label: "Number of Active Member (IA's) (Ideal size: 200)",                 weight: 6,
        reason: 'Establishes the association’s reach, but membership size alone should not determine selection.' },
      { key: 'activeMsmes',                   label: "Number of Active MSME's within membership",                        weight: 6,
        reason: 'Directly supports the PPT’s preference for associations representing a large number of small and medium enterprises.' },
      { key: 'membershipFeesBelow30',         label: 'Is membership fees below 30%',                                     weight: 6,
        reason: 'Important indicator of income diversification. The PPT notes that stronger associations generally receive less than 30% of operating income from membership fees.' },
      { key: 'businessWithinCluster',         label: 'Details of business within the identified cluster',                weight: 6,
        guide: 'Provide details in remarks. Wherever necessary.',
        reason: 'Helps determine whether the IA represents a prominent, relevant and potentially sustainable MSME cluster. Governance Criteria (focussed on PPT).' },
    ],
  },
  {
    title: 'Representation of Handicraft and Artisinal Sectors',
    params: [
      { key: 'handicraftArtisanal10Percent',      label: "10% of the IA's belong to the handicraft / artisanal sector",  weight: 0,
        reason: 'This is not specifically identified as a priority in the PPT, so it should have only a limited weight unless handicrafts are an explicit programme priority.' },
      { key: 'socioEconomicDevelopmentalImpact',  label: 'Is socio-economic and developmental impact envisaged by these handicraft and artisanal units', weight: 0,
        reason: 'Development impact is relevant, but it is not a primary selection factor in the PPT.' },
    ],
  },
  {
    title: 'Preference for Small and Sector specific Associations',
    params: [
      { key: 'smallSectorFocussedSustainableGrowth', label: 'Are the associations small and sector focussed with potential for sustainable growth and long-term impact', weight: 6,
        reason: 'Reflects the PPT’s preference for cluster and sector associations with competitive or growth potential.' },
      { key: 'requiresInstitutionalSupport',         label: 'Do these organisations require institutional support (we prioritise organisations requiring support)', weight: 4,
        reason: 'The PPT supports weaker associations for sustainability orientation, but only where leadership and governance are sufficiently strong.' },
    ],
  },
  {
    title: 'Infrastructure',
    params: [
      { key: 'adequateInfrastructure',            label: 'Do you have adequate physical and organisational infrastructure', weight: 4,
        reason: 'Relevant to delivery capability, although infrastructure ownership should not be treated as sufficient by itself.' },
      { key: 'conductsFairsInIndia',              label: 'Do you conduct exhibitions, trade fairs and machinery fairs in India', weight: 4,
        reason: 'Specifically identified as a potential revenue-generating activity in the PPT.' },
      { key: 'partnersGovtEdpSkillDevelopment',   label: 'Do you partner with Govt institutions for EDP training and skill development programs', weight: 5,
        reason: 'A significant revenue stream and an indicator of government partnership and programme-delivery experience.' },
      { key: 'paidStaffAvailable',                label: "Are paid staff available with IA's and verifiable via information on public domain", weight: 7,
        reason: 'Strong indicator of institutional capacity, continuity and the ability to execute programmes.' },
      { key: 'conductsInternationalTradeFairs',   label: 'Do you conduct international trade fairs', weight: 2,
        reason: 'Relevant but applicable to fewer sectors and may depend heavily on external schemes or grants.' },
      { key: 'earnsRentalsFromInfrastructure',    label: 'Do you earn rentals from the infrastructure you own', weight: 4,
        reason: 'Directly corresponds to the PPT’s asset-based revenue options.' },
      { key: 'iaOfficeBearersMeetingConfirmed',   label: 'Confirmation of meeting the IA office bearers in the Appraisal', weight: 8,
        reason: 'Verifies leadership strength, governance, commitment and decision-making capacity — among the most important PPT factors.' },
    ],
  },
  {
    title: 'Credit Lead Mobilisation',
    params: [
      { key: 'applicationVolume250Cr',        label: 'Volume of applications that can be generated for financial requirements of MSME members (Ideal ₹250 Cr)', weight: 4,
        reason: 'Relevant for programme outcomes, but the ₹250 crore benchmark is not stated in the PPT and should be treated as indicative rather than mandatory.' },
      { key: 'providesCreditFacilities',      label: "Do you provide credit facilities to member MSME's", weight: 5,
        reason: 'Credit facilitation is specifically identified as a revenue-generating member service.' },
    ],
  },
  {
    title: 'Government Support',
    params: [
      { key: 'utilisesGovtSchemesPpp',            label: "Do you or partner MSME's utilise State/Central Govt schemes in building via PPP mode", weight: 8,
        reason: 'One of the six principal IA identification factors in the PPT. Should carry a high weight.' },
      { key: 'supportsGstCapitalGoodsDuty',       label: 'Do you support rationalisation of GST, Capital goods and related import duty', weight: 3,
        reason: 'Relevant as policy advocacy, but less important than governance, delivery capacity and revenue sustainability.' },
      { key: 'supportsGovtFinancialConvergence',  label: 'Do you support convergence with govt and financial institutions (e.g. DPR help and loan syndication)', weight: 6,
        reason: 'Specifically identified as a revenue stream and evidence of institutional relationships and service-delivery capacity.' },
    ],
  },
  {
    title: 'Advertisement / Brand Protection',
    params: [
      { key: 'memberDirectoryAdvertised',     label: 'Do you have a directory of members advertised via magazines and bulletins', weight: 3,
        reason: 'Recognised in the PPT as a revenue source, but normally modest relative to other revenue streams.' },
      { key: 'supportsGiAct',                 label: 'Do you help individuals register under the GI Act and file litigation against spurious manufacturers, floor-price fixation etc.', weight: 3,
        reason: 'Relevant for sector-specific associations, but not universally applicable to all IAs.' },
    ],
  },
]

// Flat list of all 22 param keys — used by the payload adapter and by any
// caller that needs the ordered list without the dimension grouping.
export const PARAM_KEYS = DIMENSIONS.flatMap((d) => d.params.map((p) => p.key))

// Max possible score = sum of weights. Kept as a constant so the frontend
// doesn't recompute it on every render.
export const MAX_SCORE = DIMENSIONS.reduce(
  (sum, d) => sum + d.params.reduce((s, p) => s + p.weight, 0),
  0,
)

// Tier bands per the spec.
export const TIERS = [
  { min: 75, label: 'Developed',              color: 'success' },
  { min: 50, label: 'Moderately Developed',   color: 'info' },
  { min: 25, label: 'Developing Association', color: 'warning' },
  { min: 0,  label: 'Weak',                   color: 'error' },
]

// Given the boolean answers, return the tier label + colour + numeric score.
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
// Frontend values → backend `EligibilityMatrixRequest`. `registrationUuid`
// must be present (caller creates the IA first and passes the returned
// uuid). `totalScore` is recomputed here from the answers so the client
// never ships an inconsistent score.
export function toPayload(v = {}) {
  const payload = {
    registrationUuid: str(v.registrationUuid),
  }
  for (const k of PARAM_KEYS) {
    payload[k] = v[k] === true ? true : v[k] === false ? false : null
  }
  payload.totalScore = computeScore(v)
  return payload
}

const str = (v) => (v == null || v === '' ? null : String(v).trim() || null)
