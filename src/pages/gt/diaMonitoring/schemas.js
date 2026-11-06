// DIA Monitoring form schemas — mirror Annexure XVI (26-Oct-2026) and the
// backend DTOs added 2026-11-05 (`CreateDia*Request`). Field names stay
// snake_case to match the convention in `src/formSchemas.js`; a per-form
// mapper in `src/apis/diaMonitoring.js` translates to the camelCase backend
// contract on the way out and back.
//
// Suffix convention in the Excel:
//   -C = Core (data already exists in another part of the portal — not
//        re-captured here)
//   -P = Pending capture (represented by one of the schemas below)
// IA Onboarding, DIA Portal 3C / Discussion / Survey and BDSP Onboarding
// are "-C" and surfaced elsewhere, so they are intentionally NOT re-created.

const THEME_OPTIONS = [
  'Productivity Improvement',
  'Export Competitiveness',
  'Energy Efficiency',
  'Marketing',
  'Skilling',
  'Others',
]

const EVENT_TYPE_OPTIONS = ['Training', 'Awareness', 'Webinars', 'Workshop']
const EVENT_NATURE_OPTIONS = ['Virtual', 'Physical', 'Hybrid']
const COST_INTERVENTION_OPTIONS = ['DIA Cost Intervention', 'No Cost Intervention']
const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say']
const UNIQUE_REPEAT_OPTIONS = ['Unique (first-time)', 'Repeated']
const IA_MEMBER_OPTIONS = ['IA Member', 'Non Member']
const CREDIT_STATUS_OPTIONS = [
  'NEW', 'IN PROGRESS', 'SANCTION', 'DISBURSED', 'SUBMITTED', 'REJECTED/CLOSED',
]
const ENHANCEMENT_PLATFORM_OPTIONS = [
  'DIA Portal', 'eMAT', 'Referral Module', 'Others',
]
const ENHANCEMENT_STATUS_OPTIONS = [
  'In Progress', 'Completed', 'On Hold', 'Cancelled',
]
const PARTICIPANT_TYPE_OPTIONS = [
  'IA Member', 'Business Support Executive (BSE)',
]

// ── 1. DIA Enhancement log (sheet "DIA enhancement-P") ──────────────────────
export const diaEnhancementSchema = {
  key: 'dia-enhancement',
  sections: [
    { n: 1, title: 'Enhancement Details', fields: [
      { name: 'platform', label: 'Platform', type: 'select', span: 6, required: true,
        options: ENHANCEMENT_PLATFORM_OPTIONS },
      { name: 'enhancement_type', label: 'Type of Enhancement', type: 'text', span: 6, required: true,
        placeholder: 'e.g. New feature, UI improvement, Bug fix' },
      { name: 'details', label: 'Details of the Enhancement', type: 'textarea', span: 12, required: true,
        rows: 3, max: 2000 },
    ] },
    { n: 2, title: 'Timeline & Status', fields: [
      { name: 'date_of_initiation', label: 'Date of Initiation', type: 'date', span: 4, required: true,
        maxDate: 'today' },
      { name: 'date_of_completion', label: 'Date of Completion', type: 'date', span: 4,
        help: 'Leave blank if still in progress' },
      { name: 'status', label: 'Status', type: 'select', span: 4, required: true,
        options: ENHANCEMENT_STATUS_OPTIONS },
    ] },
    { n: 3, title: 'Points of Contact', fields: [
      { name: 'poc_sidbi', label: 'POC — SIDBI', type: 'text', span: 6, required: true },
      { name: 'poc_gt', label: 'POC — GT', type: 'text', span: 6, required: true },
    ] },
  ],
}

// ── 2. Capacity Building Program (sheet "Capacity Building-P") ──────────────
export const capacityBuildingProgramSchema = {
  key: 'capacity-building-program',
  sections: [
    { n: 1, title: 'Association & Event', fields: [
      { name: 'ro', label: 'Name of RO', type: 'text', span: 6, required: true },
      { name: 'ia_name', label: 'Full Name of Industry Association', type: 'text', span: 6, required: true },
      { name: 'target_audience', label: 'Training/Workshop for', type: 'select', span: 6, required: true,
        options: PARTICIPANT_TYPE_OPTIONS },
      { name: 'event_name', label: 'Name of the Event', type: 'text', span: 6, required: true },
    ] },
    { n: 2, title: 'Event Schedule & Format', fields: [
      { name: 'event_date', label: 'Date of Event', type: 'date', span: 4, required: true },
      { name: 'duration', label: 'Duration of Event', type: 'text', span: 4, required: true,
        placeholder: 'e.g. 2 days, 4 hours' },
      { name: 'event_nature', label: 'Nature of Event', type: 'select', span: 4, required: true,
        options: EVENT_NATURE_OPTIONS },
      { name: 'event_type', label: 'Type of Event', type: 'select', span: 6, required: true,
        options: EVENT_TYPE_OPTIONS },
      { name: 'event_theme', label: 'Theme of the Event', type: 'select', span: 6, required: true,
        options: THEME_OPTIONS },
      { name: 'event_description', label: 'Subject / Description of the Event', type: 'textarea', span: 12,
        required: true, rows: 3, max: 2000 },
    ] },
    { n: 3, title: 'DIA Linkage & Cost', fields: [
      { name: 'part_of_dia', label: 'Whether the event is Part of DIA', type: 'yesno', span: 6, required: true },
      { name: 'cost_intervention', label: 'DIA Cost / No Cost Intervention', type: 'select', span: 6, required: true,
        options: COST_INTERVENTION_OPTIONS },
      // Backend field is numeric (`associationContribution: number`), so capture
      // as a number up-front rather than forcing a stringy "₹25,000 from IA".
      { name: 'association_contribution', label: 'Association / Others Contribution (₹)', type: 'number', span: 6,
        prefix: '₹', help: 'Amount contributed by the Association in Rupees' },
      { name: 'cost_breakup', label: 'Breakup of Cost Intervention vs No Cost Intervention', type: 'textarea',
        span: 12, rows: 3, max: 2000 },
    ] },
    { n: 4, title: 'Delivery & Attendance', fields: [
      { name: 'trainer_name', label: 'Name of the Trainer / BDS Provider', type: 'text', span: 6, required: true },
      { name: 'attendee_count', label: 'No. of IA Members Attendees / Outreach', type: 'number', span: 6,
        required: true },
    ] },
    { n: 5, title: 'Reports & DIA Portal', fields: [
      { name: 'training_report_prepared', label: 'Training report prepared?', type: 'yesno', span: 6, required: true },
      { name: 'training_report_path', label: 'Training report link / path', type: 'text', span: 6,
        showIf: (v) => v.training_report_prepared === 'yes',
        placeholder: 'Paste a link or filename', max: 500 },
      { name: 'feedback_form_shared', label: 'Feedback form shared?', type: 'yesno', span: 6, required: true,
        help: 'Mandatory for all events' },
      { name: 'uploaded_on_dia_portal', label: 'Uploaded on DIA Portal?', type: 'yesno', span: 6, required: true },
    ] },
  ],
}

// ── 3. CB Participant Details (sheet "CB-Participant Details-C") ────────────
// Backend exposes this as `/dia-msme-participant` with an `eventId` FK back
// to a Capacity Building Program row. The first field is a select populated
// from `/dia-capacity-building-program` — the form host writes the list
// into `values._cb_events`, and `optionsFrom` reads it back.
export const cbParticipantSchema = {
  key: 'cb-participant',
  sections: [
    { n: 1, title: 'Capacity Building Event', fields: [
      { name: 'event_id', label: 'Select Capacity Building Event', type: 'select', span: 12, required: true,
        dependsOn: ['_cb_events'],
        optionsFrom: (v) => (Array.isArray(v._cb_events) ? v._cb_events : []),
        help: 'Pick the CB program this participant attended' },
    ] },
    { n: 2, title: 'Participant MSME', fields: [
      { name: 'msme_name', label: 'Name of the Participating MSME', type: 'text', span: 6, required: true },
      { name: 'first_time_participant', label: 'Unique (first-time) or Repeated?', type: 'select', span: 6,
        required: true, options: UNIQUE_REPEAT_OPTIONS },
    ] },
    { n: 3, title: 'Participant Profile', fields: [
      { name: 'designation', label: 'Designation', type: 'text', span: 6, required: true },
      { name: 'gender', label: 'Gender', type: 'select', span: 6, required: true, options: GENDER_OPTIONS },
      { name: 'father_husband_name', label: "Father / Husband's Name", type: 'text', span: 6, required: true },
      { name: 'date_of_birth', label: 'Date of Birth', type: 'date', span: 6, required: true, maxDate: 'today' },
      { name: 'email', label: 'Email ID', type: 'email', span: 6, required: true },
      { name: 'contact_no', label: 'Contact No.', type: 'tel', span: 6, required: true },
      { name: 'pan_no', label: 'PAN No.', type: 'text', span: 6, max: 10, placeholder: 'ABCDE1234F',
        help: 'Either PAN or Udyam Aadhar must be provided' },
      { name: 'udyam_aadhar_no', label: 'Udyam Aadhar No.', type: 'text', span: 6, max: 20,
        placeholder: 'UDYAM-XX-00-0000000' },
    ] },
  ],
}

// ── 4. Exposure Visit (sheet "Exposure Visit-P") ────────────────────────────
export const exposureVisitSchema = {
  key: 'exposure-visit',
  sections: [
    { n: 1, title: 'Association & Visit', fields: [
      { name: 'ro', label: 'Name of RO', type: 'text', span: 6, required: true },
      { name: 'ia_name', label: 'Name of Industry Association', type: 'text', span: 6, required: true },
      { name: 'visit_date', label: 'Date of Exposure Visit', type: 'date', span: 6, required: true },
      { name: 'duration', label: 'Duration of Exposure Visit', type: 'text', span: 6, required: true,
        placeholder: 'e.g. 3 days' },
    ] },
    { n: 2, title: 'Theme & Description', fields: [
      { name: 'theme', label: 'Theme', type: 'select', span: 6, required: true, options: THEME_OPTIONS },
      { name: 'subject', label: 'Subject / Description of the Event', type: 'textarea', span: 12,
        required: true, rows: 3, max: 2000 },
    ] },
    { n: 3, title: 'DIA Linkage & Cost', fields: [
      { name: 'part_of_dia', label: 'Whether the event is Part of DIA', type: 'yesno', span: 6, required: true },
      { name: 'cost_intervention', label: 'DIA Cost / No Cost Intervention', type: 'select', span: 6, required: true,
        options: COST_INTERVENTION_OPTIONS },
      { name: 'association_contribution', label: 'Association / Others Contribution (₹)', type: 'number', span: 6,
        prefix: '₹' },
      { name: 'cost_breakup', label: 'Breakup of Cost Intervention vs No Cost Intervention', type: 'textarea',
        span: 12, rows: 3, max: 2000 },
    ] },
    { n: 4, title: 'Delivery & Attendance', fields: [
      { name: 'trainer_name', label: 'Name of the Trainer / BDS Provider', type: 'text', span: 6, required: true },
      { name: 'attendee_count', label: 'No. of IA Members Attendees / Outreach', type: 'number', span: 6,
        required: true },
    ] },
    { n: 5, title: 'Reports & Feedback', fields: [
      { name: 'visit_report_prepared', label: 'Exposure visit report prepared?', type: 'yesno', span: 6, required: true },
      { name: 'visit_report_path', label: 'Visit report link / path', type: 'text', span: 6,
        showIf: (v) => v.visit_report_prepared === 'yes', max: 500 },
      { name: 'feedback_collected', label: 'Feedback collected?', type: 'yesno', span: 6, required: true },
      { name: 'feedback_path', label: 'Feedback link / path', type: 'text', span: 6,
        showIf: (v) => v.feedback_collected === 'yes', max: 500 },
    ] },
  ],
}

// ── 5. Exposure Visit Participant (sheet "Exposure Visit-Participant-P") ────
// Backend requires `exposureVisitId` FK — first field is a select populated
// from `/dia-exposure-visit`, surfaced via `values._exposure_visits`.
export const exposureVisitParticipantSchema = {
  key: 'exposure-visit-participant',
  sections: [
    { n: 1, title: 'Exposure Visit', fields: [
      { name: 'exposure_visit_id', label: 'Select Exposure Visit', type: 'select', span: 12, required: true,
        dependsOn: ['_exposure_visits'],
        optionsFrom: (v) => (Array.isArray(v._exposure_visits) ? v._exposure_visits : []),
        help: 'Pick the exposure visit this participant attended' },
    ] },
    { n: 2, title: 'Participant Profile', fields: [
      { name: 'msme_name', label: 'Name of the Participating MSME', type: 'text', span: 6, required: true },
      { name: 'designation', label: 'Designation', type: 'text', span: 6, required: true },
      { name: 'gender', label: 'Gender', type: 'select', span: 6, required: true, options: GENDER_OPTIONS },
      { name: 'father_husband_name', label: "Father / Husband's Name", type: 'text', span: 6, required: true },
      { name: 'date_of_birth', label: 'Date of Birth', type: 'date', span: 6, required: true, maxDate: 'today' },
      { name: 'email', label: 'Email ID', type: 'email', span: 6, required: true },
      { name: 'contact_no', label: 'Contact No.', type: 'tel', span: 6, required: true },
      { name: 'pan_no', label: 'PAN No.', type: 'text', span: 6, max: 10, placeholder: 'ABCDE1234F',
        help: 'Either PAN or Udyam Aadhar must be provided' },
      { name: 'udyam_aadhar_no', label: 'Udyam Aadhar No.', type: 'text', span: 6, max: 20,
        placeholder: 'UDYAM-XX-00-0000000' },
    ] },
  ],
}

// ── 6. Credit Application (sheet "Credit Application-P") ────────────────────
export const creditApplicationSchema = {
  key: 'credit-application',
  sections: [
    { n: 1, title: 'Applicant Details', fields: [
      { name: 'ro', label: 'Name of RO', type: 'text', span: 6, required: true },
      { name: 'applicant_name', label: 'Applicant / Customer Name', type: 'text', span: 6, required: true },
      { name: 'applicant_pan', label: 'PAN of Applicant / Customer', type: 'text', span: 6, required: true,
        max: 10, placeholder: 'ABCDE1234F' },
      { name: 'loan_amount_applied', label: 'Loan Amount Applied (₹ Lakh)', type: 'number', span: 6,
        required: true, prefix: '₹', help: 'In Rupees (Lakhs)' },
      { name: 'mobile_no', label: 'Mobile No. of Applicant', type: 'tel', span: 6, required: true },
      { name: 'email', label: 'Email ID of Applicant', type: 'email', span: 6, required: true },
      { name: 'office_address', label: 'Office Address of Applicant', type: 'textarea', span: 12,
        required: true, rows: 2, max: 500 },
      { name: 'pincode', label: 'Pincode of Applicant', type: 'text', span: 4, required: true, max: 6, min: 6 },
    ] },
    { n: 2, title: 'Industry Association', fields: [
      { name: 'ia_name', label: 'Industry Association Name (of which Applicant is member)', type: 'text',
        span: 8, required: true },
      { name: 'ia_login_id', label: 'Login ID of Industry Association', type: 'text', span: 4, required: true },
      { name: 'ia_membership', label: 'IA Member / Non Member', type: 'select', span: 6, required: true,
        options: IA_MEMBER_OPTIONS },
      { name: 'acknowledgement_no', label: 'Acknowledgement No. of Submitted Application', type: 'text',
        span: 6, required: true },
    ] },
    { n: 3, title: 'Application Status', fields: [
      { name: 'status', label: 'Status', type: 'select', span: 6, required: true,
        options: CREDIT_STATUS_OPTIONS },
      { name: 'loan_sanctioned', label: 'Loan Sanctioned?', type: 'yesno', span: 6, required: true },
    ] },
    { n: 4, title: 'Sanction & Disbursement', fields: [
      { name: 'sanction_date', label: 'Date of Sanction', type: 'date', span: 4,
        showIf: (v) => v.loan_sanctioned === 'yes', maxDate: 'today' },
      { name: 'amount_sanctioned', label: 'Amount Sanctioned (₹ Lakh)', type: 'number', span: 4,
        showIf: (v) => v.loan_sanctioned === 'yes', prefix: '₹' },
      { name: 'amount_disbursed', label: 'Amount Disbursed (₹ Lakh)', type: 'number', span: 4,
        showIf: (v) => v.loan_sanctioned === 'yes', prefix: '₹' },
    ] },
  ],
}

// Hub registry — single source of truth for the page list + nav mapping.
// Order here drives tab + card order on the hub page.
export const DIA_MONITORING_FORMS = [
  {
    slug: 'dia-enhancement',
    title: 'DIA Enhancement',
    subtitle: 'Track platform enhancements across DIA portal, eMAT, Referral Module.',
    schema: diaEnhancementSchema,
    sourceSheet: 'DIA enhancement',
  },
  {
    slug: 'capacity-building',
    title: 'Capacity Building Program',
    subtitle: 'Log training, workshops, awareness and webinars run under DIA.',
    schema: capacityBuildingProgramSchema,
    sourceSheet: 'Capacity Building',
  },
  {
    slug: 'cb-participant',
    title: 'CB Participant Details',
    subtitle: 'MSMEs who participated in Capacity Building events.',
    schema: cbParticipantSchema,
    sourceSheet: 'CB-Participant Details',
  },
  {
    slug: 'exposure-visit',
    title: 'Exposure Visit',
    subtitle: 'Record exposure visits conducted under DIA.',
    schema: exposureVisitSchema,
    sourceSheet: 'Exposure Visit',
  },
  {
    slug: 'exposure-visit-participant',
    title: 'Exposure Visit Participant',
    subtitle: 'MSMEs who participated in exposure visits.',
    schema: exposureVisitParticipantSchema,
    sourceSheet: 'Exposure Visit-Participant',
  },
  {
    slug: 'credit-application',
    title: 'Credit Application',
    subtitle: 'Loan applications routed through DIA.',
    schema: creditApplicationSchema,
    sourceSheet: 'Credit Application',
  },
]

export function formBySlug(slug) {
  return DIA_MONITORING_FORMS.find((f) => f.slug === slug) || null
}
