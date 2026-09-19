import { apiFetch } from '../api'

// Backend `action-plan-controller`. One action plan per IA registration,
// carrying a nested list of Year-1 activities (Annexure: "Action Plan").
//
// Shape: { state, registrationId, activities: [ …12 fields each… ] }. The
// activity list is sent whole on every write — there's no per-activity
// endpoint, so edits round-trip the entire array.
const PATH = '/action-plans'

// The sheet asks for "around six activities for Year 1, at least 4 current
// or future IGAs" — enforced in the form, kept here so both the page and any
// future caller agree.
export const MIN_ACTIVITIES = 4
export const MAX_ACTIVITIES = 6

// GET /action-plans → every action plan.
export function listActionPlans({ signal } = {}) {
  return apiFetch(PATH, { signal })
}

// GET /action-plans/{id}
export function getActionPlan(id, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}`, { signal })
}

// POST /action-plans
export function createActionPlan(values, { signal } = {}) {
  return apiFetch(PATH, { method: 'POST', body: toPayload(values), signal })
}

// PUT /action-plans/{id} — full-record replacement, activities included.
export function updateActionPlan(id, values, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: toPayload(values),
    signal,
  })
}

// DELETE /action-plans/{id}
export function deleteActionPlan(id, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(id)}`, { method: 'DELETE', signal })
}

// ── Payload adapter ────────────────────────────────────────────────────────
// Frontend values → Create/UpdateActionPlanRequest (identical shapes).
// `activityNo` is 1-based and assigned from array position, so reordering or
// removing a row renumbers the rest rather than leaving gaps.
export function toPayload(v = {}) {
  return {
    state: str(v.state),
    registrationId: int(v.registrationId),
    activities: (v.activities || []).map((a, i) => ({
      activityNo: i + 1,
      nameOfActivity: str(a.nameOfActivity),
      monthToBeHeld: str(a.monthToBeHeld),
      technicalServiceProvider: str(a.technicalServiceProvider),
      totalCost: num(a.totalCost),
      percentSupportBySidbi: num(a.percentSupportBySidbi),
      percentSupportByOthers: num(a.percentSupportByOthers),
      percentContributionByIa: num(a.percentContributionByIa),
      expectedParticipantMembers: int(a.expectedParticipantMembers),
      expectedParticipantNonMembers: int(a.expectedParticipantNonMembers),
      expectedOutput: str(a.expectedOutput),
      expectedOutcome: str(a.expectedOutcome),
      expectedIncomeGeneratingActivity: str(a.expectedIncomeGeneratingActivity),
    })),
  }
}

// Backend DTO → form values.
export function toFormValues(dto = {}) {
  return {
    id: dto.id,
    state: dto.state ?? '',
    registrationId: dto.registrationId ?? '',
    industryAssociationName: dto.industryAssociationName ?? '',
    activities: (dto.activities || [])
      .slice()
      .sort((a, b) => (a.activityNo ?? 0) - (b.activityNo ?? 0))
      .map(activityToFormValues),
  }
}

export function activityToFormValues(a = {}) {
  return {
    nameOfActivity: a.nameOfActivity ?? '',
    monthToBeHeld: a.monthToBeHeld ?? '',
    technicalServiceProvider: a.technicalServiceProvider ?? '',
    totalCost: a.totalCost ?? '',
    percentSupportBySidbi: a.percentSupportBySidbi ?? '',
    percentSupportByOthers: a.percentSupportByOthers ?? '',
    percentContributionByIa: a.percentContributionByIa ?? '',
    expectedParticipantMembers: a.expectedParticipantMembers ?? '',
    expectedParticipantNonMembers: a.expectedParticipantNonMembers ?? '',
    expectedOutput: a.expectedOutput ?? '',
    expectedOutcome: a.expectedOutcome ?? '',
    expectedIncomeGeneratingActivity: a.expectedIncomeGeneratingActivity ?? '',
  }
}

export function blankActivity() {
  return activityToFormValues({})
}

// ── Coercion helpers ──────────────────────────────────────────────────────
const str = (v) => (v == null || v === '' ? null : String(v).trim() || null)
const num = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const int = (v) => {
  const n = num(v)
  return n == null ? null : Math.trunc(n)
}
