import { apiFetch } from '../api'

// Backend `dia-*-controller` endpoints (added 2026-11-05) backing the GT
// Field Team's Annexure XVI monitoring forms. One module per form:
//
//   /dia-enhancement                   — platform / eMAT enhancements log
//   /dia-capacity-building-program     — capacity-building events
//   /dia-exposure-visit                — exposure visits
//   /dia-exposure-visit-participant    — MSMEs on an exposure visit
//                                         (FK: exposureVisitId)
//   /dia-credit-application            — DIA-routed loan applications
//   /dia-msme-participant              — MSMEs on a capacity-building event
//                                         (FK: eventId → capacity-building-program.id)
//
// Each module exports `list`, `get`, `create`, `update`, `remove`, plus a
// `toRequest(formValues)` mapper that converts the snake_case form state
// the FormRenderer produces into the camelCase shape the backend DTO
// expects. `fromResponse(row)` converts the other direction so the same
// form can hydrate for edits.
//
// Date-time handling: FormRenderer emits `YYYY-MM-DD` strings which the
// backend accepts as-is. Empty strings are coerced to `null` so Jackson
// doesn't choke on malformed dates.

const yn = (v) => v === 'yes' ? true : v === 'no' ? false : null
const toYn = (b) => b === true ? 'yes' : b === false ? 'no' : ''
const trimOrNull = (v) => (v == null || v === '') ? null : String(v).trim()
const dateOrNull = (v) => (v == null || v === '') ? null : v
const numOrNull  = (v) => (v == null || v === '') ? null : Number(v)
const intOrNull  = (v) => (v == null || v === '') ? null : parseInt(v, 10)

// Unpack an autocomplete field into a backend-friendly `{id, name}` pair.
// FormRenderer stores the value as either a `{value, label}` option object
// (when picked from the dropdown) or a raw string (when typed freeSolo).
//   • option object → id = value, name = label
//   • raw string    → id = null, name = string
//   • empty         → id = null, name = null
const unpackAuto = (v) => {
  if (v && typeof v === 'object' && 'value' in v) {
    return { id: v.value != null ? intOrNull(v.value) : null, name: trimOrNull(v.label) }
  }
  if (typeof v === 'string' && v.trim()) return { id: null, name: v.trim() }
  return { id: null, name: null }
}

// Pack a backend response's `{id, name}` pair back into the form state
// shape so edit mode shows the right option in the autocomplete. If only
// the name is present (legacy row), fall back to a plain string.
const packAuto = (id, name) => {
  if (id != null && name) return { value: id, label: name }
  if (name) return name
  return ''
}

function crud(path) {
  return {
    list:   ({ signal } = {}) => apiFetch(path, { signal }),
    get:    (id, { signal } = {}) => apiFetch(`${path}/${id}`, { signal }),
    create: (body, { signal } = {}) => apiFetch(path, { method: 'POST', body, signal }),
    update: (id, body, { signal } = {}) => apiFetch(`${path}/${id}`, { method: 'PUT', body, signal }),
    remove: (id, { signal } = {}) => apiFetch(`${path}/${id}`, { method: 'DELETE', signal }),
  }
}

// Spring Page / `{items:[]}` / bare array — collapse to an array.
export function unwrapList(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.content)) return data.content
  if (Array.isArray(data?.items)) return data.items
  return []
}

// ── 1. /dia-enhancement ─────────────────────────────────────────────────────
// Backend update 2026-11-09 added `sidbiPocId`, `gtPocId`, and
// `enhancementSupportFilePath` — POCs now carry a FK to the users table
// alongside the display name, and the form can finally persist an
// attachment reference.
export const diaEnhancement = {
  ...crud('/dia-enhancement'),
  toRequest: (v = {}) => {
    const sidbi = unpackAuto(v.poc_sidbi)
    const gt    = unpackAuto(v.poc_gt)
    return {
      platform:                   trimOrNull(v.platform),
      enhancementType:            trimOrNull(v.enhancement_type),
      enhancementDetails:         trimOrNull(v.details),
      initiationDate:             dateOrNull(v.date_of_initiation),
      completionDate:             dateOrNull(v.date_of_completion),
      status:                     trimOrNull(v.status),
      pocSidbi:                   sidbi.name,
      pocGt:                      gt.name,
      sidbiPocId:                 sidbi.id,
      gtPocId:                    gt.id,
      enhancementSupportFilePath: trimOrNull(v.attachment_path),
    }
  },
  fromResponse: (r = {}) => ({
    platform:             r.platform || '',
    enhancement_type:     r.enhancementType || '',
    details:              r.enhancementDetails || '',
    date_of_initiation:   r.initiationDate || '',
    date_of_completion:   r.completionDate || '',
    status:               r.status || '',
    poc_sidbi:            packAuto(r.sidbiPocId, r.pocSidbi),
    poc_gt:               packAuto(r.gtPocId, r.pocGt),
    attachment_path:      r.enhancementSupportFilePath || '',
  }),
  summary: (r = {}) => [r.platform, r.enhancementType, r.status].filter(Boolean).join(' · '),
}

// ── 2. /dia-capacity-building-program ───────────────────────────────────────
// Backend update 2026-11-09 added `roId` + `industryAssociationId` so the
// row can link back to the master tables when the user picks from the
// dropdown (freeSolo entries ship with only the name and a null FK).
export const diaCapacityBuildingProgram = {
  ...crud('/dia-capacity-building-program'),
  toRequest: (v = {}) => {
    const ro = unpackAuto(v.ro)
    const ia = unpackAuto(v.ia_name)
    return {
      roId:                      ro.id,
      industryAssociationId:     ia.id,
      roName:                    ro.name,
      industryAssociationName:   ia.name,
      participantType:           trimOrNull(v.target_audience),
      eventName:                 trimOrNull(v.event_name),
      eventDate:                 dateOrNull(v.event_date),
      eventDuration:             trimOrNull(v.duration),
      eventNature:               trimOrNull(v.event_nature),
      eventType:                 trimOrNull(v.event_type),
      eventTheme:                trimOrNull(v.event_theme),
      eventDescription:          trimOrNull(v.event_description),
      partOfDia:                 yn(v.part_of_dia),
      costInterventionType:      trimOrNull(v.cost_intervention),
      associationContribution:   numOrNull(v.association_contribution),
      costBreakup:               trimOrNull(v.cost_breakup),
      trainerName:               trimOrNull(v.trainer_name),
      attendeesCount:            intOrNull(v.attendee_count),
      trainingReportPrepared:    yn(v.training_report_prepared),
      trainingReportPath:        trimOrNull(v.training_report_path),
      feedbackFormShared:        yn(v.feedback_form_shared),
      uploadedOnDiaPortal:       yn(v.uploaded_on_dia_portal),
    }
  },
  fromResponse: (r = {}) => ({
    ro:                       packAuto(r.roId, r.roName),
    ia_name:                  packAuto(r.industryAssociationId, r.industryAssociationName),
    target_audience:          r.participantType || '',
    event_name:               r.eventName || '',
    event_date:               r.eventDate || '',
    duration:                 r.eventDuration || '',
    event_nature:             r.eventNature || '',
    event_type:               r.eventType || '',
    event_theme:              r.eventTheme || '',
    event_description:        r.eventDescription || '',
    part_of_dia:              toYn(r.partOfDia),
    cost_intervention:        r.costInterventionType || '',
    association_contribution: r.associationContribution ?? '',
    cost_breakup:             r.costBreakup || '',
    trainer_name:             r.trainerName || '',
    attendee_count:           r.attendeesCount ?? '',
    training_report_prepared: toYn(r.trainingReportPrepared),
    training_report_path:     r.trainingReportPath || '',
    feedback_form_shared:     toYn(r.feedbackFormShared),
    uploaded_on_dia_portal:   toYn(r.uploadedOnDiaPortal),
  }),
  summary: (r = {}) => [r.eventName, r.industryAssociationName, r.eventDate].filter(Boolean).join(' · '),
  // Shape a CB program as a select option for the MSME participant form.
  toOption: (r = {}) => ({
    value: r.id,
    label: `${r.eventName || 'Event'} — ${r.industryAssociationName || ''} (${r.eventDate || '—'})`,
  }),
}

// ── 3. /dia-exposure-visit ──────────────────────────────────────────────────
// Backend update 2026-11-09 — same roId / industryAssociationId FK pair
// introduced on CB Program is now mirrored here.
export const diaExposureVisit = {
  ...crud('/dia-exposure-visit'),
  toRequest: (v = {}) => {
    const ro = unpackAuto(v.ro)
    const ia = unpackAuto(v.ia_name)
    return {
      roId:                     ro.id,
      industryAssociationId:    ia.id,
      roName:                   ro.name,
      industryAssociationName:  ia.name,
      visitDate:                dateOrNull(v.visit_date),
      visitDuration:            trimOrNull(v.duration),
      theme:                    trimOrNull(v.theme),
      description:              trimOrNull(v.subject),
      partOfDia:                yn(v.part_of_dia),
      costInterventionType:     trimOrNull(v.cost_intervention),
      associationContribution:  numOrNull(v.association_contribution),
      costBreakup:              trimOrNull(v.cost_breakup),
      trainerName:              trimOrNull(v.trainer_name),
      attendeesCount:           intOrNull(v.attendee_count),
      visitReportPrepared:      yn(v.visit_report_prepared),
      visitReportPath:          trimOrNull(v.visit_report_path),
      feedbackCollected:        yn(v.feedback_collected),
      feedbackPath:             trimOrNull(v.feedback_path),
    }
  },
  fromResponse: (r = {}) => ({
    ro:                       packAuto(r.roId, r.roName),
    ia_name:                  packAuto(r.industryAssociationId, r.industryAssociationName),
    visit_date:               r.visitDate || '',
    duration:                 r.visitDuration || '',
    theme:                    r.theme || '',
    subject:                  r.description || '',
    part_of_dia:              toYn(r.partOfDia),
    cost_intervention:        r.costInterventionType || '',
    association_contribution: r.associationContribution ?? '',
    cost_breakup:             r.costBreakup || '',
    trainer_name:             r.trainerName || '',
    attendee_count:           r.attendeesCount ?? '',
    visit_report_prepared:    toYn(r.visitReportPrepared),
    visit_report_path:        r.visitReportPath || '',
    feedback_collected:       toYn(r.feedbackCollected),
    feedback_path:            r.feedbackPath || '',
  }),
  summary: (r = {}) => [r.industryAssociationName, r.theme, r.visitDate].filter(Boolean).join(' · '),
  toOption: (r = {}) => ({
    value: r.id,
    label: `${r.industryAssociationName || 'Visit'} — ${r.theme || ''} (${r.visitDate || '—'})`,
  }),
}

// ── 4. /dia-exposure-visit-participant ──────────────────────────────────────
export const diaExposureVisitParticipant = {
  ...crud('/dia-exposure-visit-participant'),
  // Also surfaces the per-visit lookup the backend ships.
  listByVisit: (exposureVisitId, { signal } = {}) =>
    apiFetch(`/dia-exposure-visit-participant/exposure-visit/${exposureVisitId}`, { signal }),
  toRequest: (v = {}) => ({
    exposureVisitId:    intOrNull(v.exposure_visit_id),
    msmeName:           trimOrNull(v.msme_name),
    designation:        trimOrNull(v.designation),
    gender:             trimOrNull(v.gender),
    fatherHusbandName:  trimOrNull(v.father_husband_name),
    dateOfBirth:        dateOrNull(v.date_of_birth),
    email:              trimOrNull(v.email),
    contactNo:          trimOrNull(v.contact_no),
    panNo:              trimOrNull(v.pan_no),
    udyamAadharNo:      trimOrNull(v.udyam_aadhar_no),
  }),
  fromResponse: (r = {}) => ({
    exposure_visit_id:    r.exposureVisitId ?? '',
    msme_name:            r.msmeName || '',
    designation:          r.designation || '',
    gender:               r.gender || '',
    father_husband_name:  r.fatherHusbandName || '',
    date_of_birth:        r.dateOfBirth || '',
    email:                r.email || '',
    contact_no:           r.contactNo || '',
    pan_no:               r.panNo || '',
    udyam_aadhar_no:      r.udyamAadharNo || '',
  }),
  summary: (r = {}) => [r.msmeName, r.designation, r.industryAssociationName].filter(Boolean).join(' · '),
}

// ── 5. /dia-credit-application ──────────────────────────────────────────────
export const diaCreditApplication = {
  ...crud('/dia-credit-application'),
  toRequest: (v = {}) => ({
    roName:                      trimOrNull(v.ro),
    applicantName:               trimOrNull(v.applicant_name),
    applicantPan:                trimOrNull(v.applicant_pan)?.toUpperCase?.() ?? null,
    loanAmountApplied:           numOrNull(v.loan_amount_applied),
    mobileNo:                    trimOrNull(v.mobile_no),
    email:                       trimOrNull(v.email),
    officeAddress:               trimOrNull(v.office_address),
    pinCode:                     trimOrNull(v.pincode),
    industryAssociationName:     trimOrNull(v.ia_name),
    industryAssociationLoginId:  trimOrNull(v.ia_login_id),
    acknowledgementNo:           trimOrNull(v.acknowledgement_no),
    memberType:                  trimOrNull(v.ia_membership),
    status:                      trimOrNull(v.status),
    loanSanctioned:              yn(v.loan_sanctioned),
    sanctionDate:                dateOrNull(v.sanction_date),
    amountSanctioned:            numOrNull(v.amount_sanctioned),
    amountDisbursed:             numOrNull(v.amount_disbursed),
  }),
  fromResponse: (r = {}) => ({
    ro:                   r.roName || '',
    applicant_name:       r.applicantName || '',
    applicant_pan:        r.applicantPan || '',
    loan_amount_applied:  r.loanAmountApplied ?? '',
    mobile_no:            r.mobileNo || '',
    email:                r.email || '',
    office_address:       r.officeAddress || '',
    pincode:              r.pinCode || '',
    ia_name:              r.industryAssociationName || '',
    ia_login_id:          r.industryAssociationLoginId || '',
    acknowledgement_no:   r.acknowledgementNo || '',
    ia_membership:        r.memberType || '',
    status:               r.status || '',
    loan_sanctioned:      toYn(r.loanSanctioned),
    sanction_date:        r.sanctionDate || '',
    amount_sanctioned:    r.amountSanctioned ?? '',
    amount_disbursed:     r.amountDisbursed ?? '',
  }),
  summary: (r = {}) => [r.applicantName, r.industryAssociationName, r.status].filter(Boolean).join(' · '),
}

// ── 6. /dia-msme-participant (CB participants) ──────────────────────────────
export const diaMsmeParticipant = {
  ...crud('/dia-msme-participant'),
  listByEvent: (eventId, { signal } = {}) =>
    apiFetch(`/dia-msme-participant/event/${eventId}`, { signal }),
  toRequest: (v = {}) => ({
    eventId:              intOrNull(v.event_id),
    msmeName:             trimOrNull(v.msme_name),
    firstTimeParticipant: v.first_time_participant === 'Unique (first-time)',
    designation:          trimOrNull(v.designation),
    gender:               trimOrNull(v.gender),
    fatherHusbandName:    trimOrNull(v.father_husband_name),
    dateOfBirth:          dateOrNull(v.date_of_birth),
    email:                trimOrNull(v.email),
    contactNo:            trimOrNull(v.contact_no),
    panNo:                trimOrNull(v.pan_no),
    udyamAadharNo:        trimOrNull(v.udyam_aadhar_no),
  }),
  fromResponse: (r = {}) => ({
    event_id:                r.eventId ?? '',
    msme_name:               r.msmeName || '',
    first_time_participant:  r.firstTimeParticipant === true ? 'Unique (first-time)'
                                : r.firstTimeParticipant === false ? 'Repeated' : '',
    designation:             r.designation || '',
    gender:                  r.gender || '',
    father_husband_name:     r.fatherHusbandName || '',
    date_of_birth:           r.dateOfBirth || '',
    email:                   r.email || '',
    contact_no:              r.contactNo || '',
    pan_no:                  r.panNo || '',
    udyam_aadhar_no:         r.udyamAadharNo || '',
  }),
  summary: (r = {}) => [r.msmeName, r.designation, r.industryAssociationName].filter(Boolean).join(' · '),
}

// Lookup from form slug → API module, so the generic form host can stay dumb.
export const BY_SLUG = {
  'dia-enhancement':            diaEnhancement,
  'capacity-building':          diaCapacityBuildingProgram,
  'cb-participant':             diaMsmeParticipant,
  'exposure-visit':             diaExposureVisit,
  'exposure-visit-participant': diaExposureVisitParticipant,
  'credit-application':         diaCreditApplication,
}
