// Data-driven schemas for the onboarding & disbursement forms.
// field: { name, label, type, options?/optionsFrom?, span?, required?, pattern?, otp?, help? }
// types: text | number | email | tel | textarea | yesno | select | radio | checkboxes | file | computed | subheading
import { STATES, districtsOf } from './geo'
import { clustersOf } from './clusters'

const PINCODE = { re: /^[1-9]\d{5}$/, msg: '6-digit pincode' }
// Accepts optional http/https, an optional `www.` (or any subdomain) prefix,
// a domain with at least one dot, optional port, and an optional path /
// query / fragment. Intentionally forgiving — allows hyphens, underscores
// and uppercase in host labels so intranet-style URLs aren't rejected.
const URL_PATTERN = {
  re: /^\s*(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(:\d+)?([/?#][^\s]*)?\s*$/i,
  msg: 'Enter a valid URL (e.g. www.example.com or https://example.com)',
}

// Validator for CIBIL/SMART report dates on the appraisal — spec says they
// must be dated after the parent In-Principle registration was created.
// The parent IA's createdAt is threaded into form values under
// `_ia_created_at` by AppraisalForm on seed.
const afterIaCreation = (v, values) => {
  if (!v) return ''
  const iaIso = values?._ia_created_at
  if (!iaIso) return ''
  const d = new Date(v)
  const iaD = new Date(iaIso)
  if (isNaN(d.getTime()) || isNaN(iaD.getTime())) return ''
  // Normalize IA timestamp to start-of-day so a same-day report is not
  // rejected on hour-of-day differences.
  const iaDay = new Date(iaD.getFullYear(), iaD.getMonth(), iaD.getDate())
  if (d < iaDay) return 'Must be on or after In-Principle creation date'
  return ''
}

const apexNodal = (prefix) => [
  { name: `${prefix}_name`, label: 'Name', type: 'text', span: 3 },
  { name: `${prefix}_designation`, label: 'Designation', type: 'text', span: 3 },
  { name: `${prefix}_contact`, label: 'Contact Number', type: 'tel', span: 3 },
  { name: `${prefix}_email`, label: 'Email ID', type: 'email', span: 3 },
]

// Appraisal-only identity — sections 1–6 pulled autofetched from the parent
// IA registration. Sections 1–4 are strictly read-only (spec says
// "Autofetched from In-Principle approval format"). Sections 5–6 are seeded
// but modifiable ("Subject to Approval by Reporting Officer").
const identity = [
  { n: 1, title: 'State', fields: [
    { name: 'state', label: 'State', type: 'text', span: 4, readOnly: true, help: 'Auto-fetched from In-Principle registration' },
  ] },
  { n: 2, title: 'Industry Association (IA)', fields: [
    { name: 'ia_name', label: 'Name of Industry Association', type: 'text', span: 8, readOnly: true },
  ] },
  { n: 3, title: 'Constitution of IA', fields: [
    { name: 'year_incorp', label: 'Year of Incorporation', type: 'number', span: 3, readOnly: true },
    { name: 'ia_profit_type', label: 'Type of IA', type: 'text', span: 4, readOnly: true },
    { name: 'proof_constitution', label: 'Proof of Constitution', type: 'text', span: 5, readOnly: true },
  ] },
  { n: 4, title: 'Address of IA', fields: [
    { name: 'district', label: 'District', type: 'text', span: 4, readOnly: true },
    { name: 'pincode', label: 'Pincode', type: 'text', span: 3, readOnly: true },
  ] },
  { n: 5, title: 'Apex Office Holder Details of IA', desc: 'Autofetched and modifiable (subject to Approval by Reporting Officer)', fields: apexNodal('apex') },
  { n: 6, title: 'Nodal Person Details of IA', desc: 'Autofetched and modifiable (subject to Approval by Reporting Officer)', fields: apexNodal('nodal') },
]

// ── In-Principle Approval (GT capture, first level) — full validated format ──
// Factory: three cascading dropdowns are backend-driven now.
//   `branchOptions`  — { value: branchUuid, label: branchName }[] for a state
//                      (GET /branch/dropdown?state=)
//   `sdeOptions`     — { value: sdeUuid,   label: name       }[] for a branch
//                      (GET /sidbi-sde/dropdown?branchUuid=)
//   `branchHelp` / `sdeHelp` — optional helper text shown under the field
//                      (e.g. "Pick a state first", "No branches for this state").
// The `sidbi_branch` field stores the branch UUID (previously the branch name).
// The `select_sde` field stores the SDE UUID (previously "First Last — …").
// Backend `sidbiBranch` and `sde` string fields receive those UUIDs.
export const makeInPrincipleSchema = ({
  branchOptions = [], sdeOptions = [],
  branchHelp, sdeHelp,
} = {}) => ({
  key: 'in-principle',
  sections: [
    { n: 1, title: 'State & Industry Association', fields: [
      { name: 'state', label: 'State', type: 'select', options: STATES, span: 4, required: true },
      { name: 'ia_name', label: 'Name of Industry Association', type: 'text', span: 8, required: true },
    ] },
    { n: 2, title: 'Constitution of IA', fields: [
      { name: 'constitution_type', label: 'Constitution', type: 'select', span: 6, required: true,
        options: ['Societies Registration Act 1860', 'Section 8 Company', 'Trust', 'Other'] },
      { name: 'constitution_other', label: 'If Other — specify', type: 'text', span: 6, required: true,
        showIf: (v) => v.constitution_type === 'Other' },
      { name: 'ia_profit_type', label: 'Type of IA', type: 'select', span: 6, required: true, options: ['For Profit', 'Not for Profit'] },
      { name: 'incorporation_date', label: 'Date of Incorporation', type: 'date', span: 6, required: true,
        maxDate: 'today',
        validate: (v) => {
          if (!v) return ''
          // Parse "YYYY-MM-DD" as a LOCAL date. `new Date("YYYY-MM-DD")`
          // parses as UTC midnight, which in IST (UTC+5:30) becomes the
          // next-day local morning — comparing that against a local-midnight
          // "today" incorrectly flags today as a future date.
          const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v))
          if (!m) return 'Enter a valid date'
          const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
          if (isNaN(d.getTime())) return 'Enter a valid date'
          const today = new Date(); today.setHours(0, 0, 0, 0)
          if (d.getTime() > today.getTime()) return 'Cannot be a future date'
          return ''
        } },
      { name: '_constitution_files', label: 'Constitution documents', type: 'subheading', span: 12 },
      { name: 'incorp_certificate', label: 'Incorporation Certificate', type: 'file', span: 6, required: true },
      { name: 'constitution_proof', label: 'Proof of Constitution', type: 'file', span: 6, required: true },
    ] },
    { n: 3, title: 'Address of IA', fields: [
      { name: 'district', label: 'District', type: 'select', optionsFrom: (v) => districtsOf(v.state), span: 6, required: true, help: 'Within the selected State' },
      { name: 'pincode', label: 'Pincode', type: 'text', span: 6, required: true, pattern: PINCODE },
    ] },
    { n: 4, title: 'Apex Office Holder Details of IA', fields: [
      { name: '_apex_contact', label: 'Contact', type: 'subheading', span: 12 },
      { name: 'apex_name', label: 'Name', type: 'text', span: 6, required: true },
      { name: 'apex_designation', label: 'Designation', type: 'text', span: 6, required: true },
      { name: 'apex_contact', label: 'Contact Number', type: 'tel', span: 6, required: true },
      { name: 'apex_email', label: 'Email ID', type: 'email', span: 6, required: true, otp: true },
      { name: '_apex_kyc', label: 'KYC & ID proof', type: 'subheading', span: 12 },
      { name: 'apex_kyc_doc', label: 'KYC Document (Address Proof)', type: 'select', span: 6, required: true,
        options: ['Voter ID card', 'Driving licence', 'Passport', 'Telephone bill', 'Electricity bill', 'Water consumption bill', 'Gas receipt / connection card'] },
      { name: 'apex_kyc_number', label: 'KYC Document Number', type: 'text', span: 6, required: true,
        placeholder: 'Enter document / bill number',
        showIf: (v) => !!v.apex_kyc_doc },
      { name: 'apex_id_proof', label: 'ID Proof', type: 'select', span: 6, required: true, options: ['PAN', 'Aadhaar', 'Passport', 'Driving Licence'] },
      { name: 'apex_id_number', label: 'ID Proof Number', type: 'text', span: 6, required: true,
        placeholder: 'Enter unique ID number',
        showIf: (v) => !!v.apex_id_proof,
        validate: (v, values) => {
          if (v === '' || v == null) return ''
          const t = values?.apex_id_proof
          if (t === 'PAN' && !/^[A-Z]{5}\d{4}[A-Z]$/.test(String(v).toUpperCase())) return 'PAN format: AAAAA9999A'
          if (t === 'Aadhaar' && !/^\d{12}$/.test(String(v))) return '12-digit Aadhaar'
          return ''
        } },
      { name: 'apex_kyc_file', label: 'Upload KYC document (address proof)', type: 'file', span: 6, required: true },
      { name: 'apex_id_file', label: 'Upload ID proof document', type: 'file', span: 6, required: true },
    ] },
    { n: 5, title: 'Details of Nodal Contact of IA', fields: [
      { name: 'nodal_name', label: 'Name', type: 'text', span: 6, required: true },
      { name: 'nodal_designation', label: 'Designation', type: 'text', span: 6, required: true },
      { name: 'nodal_contact', label: 'Contact Number', type: 'tel', span: 6, required: true },
      { name: 'nodal_email', label: 'Email ID', type: 'email', span: 6, required: true, otp: true },
    ] },
    { n: 6, title: 'Cluster / District Details', fields: [
      { name: 'sidbi_branch', label: 'Nearest SIDBI Branch Office', type: 'select', options: branchOptions, span: 12, required: true,
        help: branchHelp },
      { name: 'cluster_mapped', label: 'Mapped with any identified cluster?', type: 'yesno', span: 6, required: true },
      { name: 'district_mapped', label: 'Mapped with an important district?', type: 'yesno', span: 6, required: true,
        help: 'Auto-fill pending backend important-districts list' },
      { name: 'cluster_which', label: 'If yes, which cluster', type: 'select', span: 12, required: true,
        showIf: (v) => v.cluster_mapped === 'yes',
        optionsFrom: (v) => { const c = clustersOf(v.state).map((x) => x.name); return c.length ? c : ['No identified cluster listed for this State'] } },
      { name: 'msme_count', label: 'Number of MSMEs (without traders) in district', type: 'number', span: 12, required: true,
        validate: (v) => (v === '' ? '' : (!/^\d+$/.test(String(v)) ? 'Whole number only' : '')) },
    ] },
    { n: 7, title: 'Existing Infra Details', fields: [
      { name: '_members', label: 'Membership', type: 'subheading', span: 12 },
      { name: 'members_gt200', label: 'Active members more than 200?', type: 'radio', options: ['Yes', 'No'], span: 6, required: true },
      { name: 'active_members', label: 'No. of active members in IA', type: 'number', span: 6, required: true,
        validate: (v, values) => {
          if (v === '') return ''
          if (!/^\d+$/.test(String(v))) return 'Whole number only'
          if (values?.members_gt200 === 'Yes' && Number(v) < 200) return 'Must be ≥ 200'
          if (values?.members_gt200 === 'No' && Number(v) >= 200) return 'Must be < 200'
          return ''
        } },
      { name: 'msme_count_mirror', label: 'Number of MSMEs (without traders) in district', type: 'computed', span: 6, plain: true,
        dependsOn: ['msme_count'],
        formula: (v) => (v.msme_count === '' || v.msme_count == null ? '' : v.msme_count) },
      { name: 'member_directory', label: 'Member directory available', type: 'yesno', span: 6, required: true },
      { name: 'members_justification', label: 'Justification for choosing IA if active member base < 200', type: 'textarea', span: 12, required: true,
        showIf: (v) => v.members_gt200 === 'No' || (v.active_members !== '' && v.active_members != null && Number(v.active_members) < 200) },
      { name: 'members_justification_file', label: 'Approval letter from SIDBI (if any)', type: 'file', span: 12,
        showIf: (v) => v.members_gt200 === 'No' || (v.active_members !== '' && v.active_members != null && Number(v.active_members) < 200) },

      { name: '_building', label: 'Building of IA', type: 'subheading', span: 12 },
      { name: 'building', label: 'Building of IA', type: 'select', span: 6, required: true,
        options: ['Owned office', 'Rented office', 'Leased office', 'Office of office bearer'] },
      { name: 'declaration_signed', label: 'Declaration signed by office bearer', type: 'yesno', span: 6, required: true },
      { name: 'electricity_bill', label: 'Electricity bill (proof)', type: 'file', span: 6, required: true },
      { name: 'telephone_bill', label: 'Telephone bill (proof)', type: 'file', span: 6, required: true },

      { name: '_amenities', label: 'IT & staff', type: 'subheading', span: 12 },
      { name: 'it_infra', label: 'IT infrastructure (Computer / Printer / Scanner)?', type: 'yesno', span: 6, required: true },
      { name: 'it_infra_details', label: 'If yes, infrastructure available (select all that apply)', type: 'checkboxes', span: 12, required: true,
        showIf: (v) => v.it_infra === 'yes',
        options: ['Computer', 'Laptop', 'Printer', 'Printer with Scanner', 'Internet Connection'] },
      { name: 'secretariat_staff', label: 'Availability of Secretariat Staff', type: 'yesno', span: 12, required: true },
      { name: 'secretariat_list', label: 'Secretariat staff members', type: 'repeater', span: 12,
        showIf: (v) => v.secretariat_staff === 'yes', required: true,
        addLabel: 'Add staff',
        columns: [
          { name: 'name', label: 'Name', type: 'text' },
          { name: 'contact', label: 'Contact', type: 'tel' },
          { name: 'email', label: 'Email', type: 'email' },
        ] },

      { name: '_online', label: 'Online presence & services', type: 'subheading', span: 12 },
      { name: 'website', label: 'Website availability', type: 'yesno', span: 6, required: true },
      { name: 'paid_services', label: 'Paid services offered to members', type: 'yesno', span: 6, required: true },
      { name: 'website_url', label: 'Website URL', type: 'text', span: 12, required: true,
        showIf: (v) => v.website === 'yes',
        placeholder: 'https://example.com',
        pattern: URL_PATTERN },
      { name: 'paid_services_details', label: 'Details of paid services', type: 'text', span: 12, required: true, showIf: (v) => v.paid_services === 'yes' },

      { name: '_adverse', label: 'Adverse remarks', type: 'subheading', span: 12 },
      { name: 'adverse_remarks', label: 'Any adverse remarks about IA on web search?', type: 'yesno', span: 12, required: true },
      { name: 'adverse_details', label: 'If yes, details', type: 'textarea', span: 12, max: 500, required: true, showIf: (v) => v.adverse_remarks === 'yes' },
      { name: 'adverse_report', label: 'Upload web report', type: 'file', span: 12, required: true, showIf: (v) => v.adverse_remarks === 'yes' },
    ] },
    { n: 8, title: 'DIA Specific Details', fields: [
      { name: 'basis_of_selection', label: 'Basis of selection (select one / multiple / all)', type: 'checkboxes', required: true,
        options: ['More than 200 IAs', 'Active Website', 'Availability of Association Members Database', 'Ready to share the Database', 'Active in Conducting Training Programs', 'All'] },
      { name: 'willingness_comments', label: "Comments on IA's willingness to take up Micro income-generating activities", type: 'textarea', span: 12, max: 500, required: true },

      { name: '_grant', label: 'Grant proposal', type: 'subheading', span: 12 },
      { name: 'worked_before', label: 'GT / SIDBI worked with IA before?', type: 'yesno', span: 6, required: true },
      { name: 'grant_proposed', label: 'Grant Proposed (₹)', type: 'number', span: 6, prefix: '₹', required: true,
        placeholder: 'e.g. 1400000',
        help: 'Enter full amount in rupees. Maximum ₹14,00,000 (₹14 Lakhs)',
        validate: (v) => {
          if (v === '') return ''
          const n = Number(v)
          if (!Number.isFinite(n) || n < 0) return 'Enter a valid amount'
          if (n > 1400000) return 'Cannot exceed ₹14,00,000 (₹14 Lakhs)'
          return ''
        } },
      { name: 'grant_details', label: 'Grant Details proposed (BSE Salary ₹60,000/month from date of joining; Budget for IA Sustainability & Training Program ₹6,80,000)', type: 'textarea', span: 12, required: true },

      { name: '_envisaged', label: 'Envisaged impact', type: 'subheading', span: 12 },
      { name: 'envisaged_output', label: 'Envisaged Output', type: 'textarea', span: 12, max: 500, required: true },
      { name: 'envisaged_outcome', label: 'Envisaged Outcome', type: 'textarea', span: 12, max: 500, required: true },
      { name: 'envisaged_impact', label: 'Envisaged Impact', type: 'textarea', span: 12, max: 500, required: true },

      { name: '_sde', label: 'Route to SDE', type: 'subheading', span: 12 },
      { name: 'select_sde', label: 'Select SDE', type: 'select', options: sdeOptions, span: 12, required: true,
        help: sdeHelp },
    ] },
  ],
})

// ── BSE Candidate Proposal (GT Field Manager — new BSE onboarding) ──────────
// Factory: takes the list of IAs already cleared at In-Principle stage so the
// association dropdown is populated with live data from the app store.
export const makeBseCandidateSchema = (approvedIAs = []) => ({
  key: 'bse-candidate',
  sections: [
    { n: 1, title: 'Location & Industry Association', fields: [
      { name: 'state', label: 'State', type: 'select', options: STATES, span: 6, required: true },
      { name: 'district', label: 'District', type: 'select', optionsFrom: (v) => districtsOf(v.state), span: 6, required: true },
      { name: 'ia_name', label: 'Name of Association (BSE Proposed For)', type: 'select',
        options: approvedIAs.length ? approvedIAs : ['No In-Principle approved IA available'],
        span: 12, required: true },
    ] },
    { n: 2, title: 'Candidate Details', fields: [
      { name: 'bse_name', label: 'Name of Proposed BSE', type: 'text', span: 12, required: true },
      { name: 'mobile', label: 'Mobile No', type: 'tel', span: 6, required: true },
      { name: 'email', label: 'Email ID', type: 'email', span: 6, required: true, otp: true },
      { name: 'qualification', label: 'Highest Educational Qualification', type: 'select', span: 12, required: true,
        options: ['Under Graduate', 'Graduate', 'Post Graduate'] },
    ] },
    { n: 3, title: 'Experience', fields: [
      { name: 'experience_status', label: 'Prior Experience', type: 'select', options: ['Yes', 'No'], span: 12, required: true },
      { name: 'experience_years', label: 'Experience — Years', type: 'number', span: 6,
        showIf: (v) => v.experience_status === 'Yes', required: true,
        validate: (v) => (v === '' ? '' : (!/^\d+$/.test(String(v)) ? 'Whole number only' : '')) },
      { name: 'experience_months', label: 'Experience — Months', type: 'number', span: 6,
        showIf: (v) => v.experience_status === 'Yes', required: true,
        validate: (v) => {
          if (v === '') return ''
          if (!/^\d+$/.test(String(v))) return 'Whole number only'
          if (Number(v) > 11) return '0–11 months'
          return ''
        } },
    ] },
    { n: 4, title: 'Employment & Salary', fields: [
      { name: 'employment_status', label: 'Employment Status', type: 'select', options: ['Working', 'Resigned'], span: 12, required: true },
      { name: 'current_salary', label: 'Current Salary (₹ / month)', type: 'number', span: 6, prefix: '₹',
        showIf: (v) => v.employment_status === 'Working', required: true },
      { name: 'notice_period', label: 'Minimum Notice Period (Days)', type: 'number', span: 6,
        showIf: (v) => v.employment_status === 'Working', required: true },
      { name: 'last_drawn_salary', label: 'Last Drawn Salary (₹ / month)', type: 'number', span: 12, prefix: '₹',
        showIf: (v) => v.employment_status === 'Resigned', required: true },
      { name: 'resignation_doc', label: 'Resignation Acceptance / Relieving Letter', type: 'file', span: 12,
        showIf: (v) => v.employment_status === 'Resigned', required: true },
      { name: 'expected_salary', label: 'Expected Salary (₹ / month)', type: 'number', span: 6, prefix: '₹', required: true,
        help: 'Must be ≥ current/last drawn salary and ≤ ₹50,000',
        validate: (v, values) => {
          if (v === '' || v == null) return ''
          const n = Number(v)
          if (isNaN(n)) return 'Enter a valid amount'
          if (n > 50000) return 'Cannot exceed ₹50,000 / month'
          const base = values?.employment_status === 'Working'
            ? Number(values.current_salary)
            : Number(values?.last_drawn_salary)
          if (!isNaN(base) && n < base) return 'Must be ≥ current / last drawn salary'
          return ''
        } },
    ] },
    { n: 5, title: 'Documents', fields: [
      { name: 'resume_status', label: 'Resume Status', type: 'select', options: ['Received', 'Not Received'], span: 12, required: true },
      { name: 'resume_file', label: 'Upload Resume (PDF)', type: 'file', span: 12,
        showIf: (v) => v.resume_status === 'Received', required: true },
      { name: 'salary_proof', label: 'Salary Slip / Bank Statement (proof of last drawn salary)', type: 'file', span: 12, required: true },
    ] },
    { n: 6, title: 'GT Field Manager Recommendation', fields: [
      { name: 'recommendation', label: 'Recommendation Status', type: 'radio',
        options: ['Recommended', 'Not Recommended'], span: 6, required: true },
      { name: 'recommendation_date', label: 'Recommendation Date', type: 'date', span: 6, required: true },
    ] },
  ],
})

// ── Disburse BSE Salary (GT — manpower agency salary voucher + Annexure I) ──
const num = (v) => (v == null || v === '' ? NaN : parseFloat(v))

export const salarySchema = {
  key: 'bse-salary',
  sections: [
    { n: 1, title: 'Manpower Agency & Payment', fields: [
      { name: 'manpower_name', label: 'Manpower Agency Name', type: 'text', span: 6 },
      { name: 'agency_gstin', label: 'GSTIN of the Agency', type: 'text', span: 6 },
      { name: 'sidbi_gstin', label: 'GSTIN of SIDBI', type: 'text', span: 6, default: '09AABCS3480N5ZS', readOnly: true },
      { name: 'nature_payment', label: 'Nature of Payment', type: 'textarea', span: 12,
        default: 'Payment towards Salary for the month <<MMM-YYYY>> of ____ BSEs. BSE-wise Details in Annexure I.' },
    ] },
    { n: 2, title: 'Invoice Details', fields: [
      { name: 'invoice_date', label: 'Invoice Date', type: 'text', span: 3, placeholder: 'DD/MM/YYYY' },
      { name: 'invoice_number', label: 'Invoice Number', type: 'text', span: 3 },
      { name: 'value_service', label: 'Value of service / Items supplied', type: 'number', span: 3, prefix: '₹' },
      { name: 'igst', label: 'IGST @18%', type: 'computed', prefix: '₹', span: 3,
        formula: (v) => (isNaN(num(v.value_service)) ? '' : +(num(v.value_service) * 0.18).toFixed(2)) },
      { name: 'total_amount', label: 'Total amount', type: 'computed', prefix: '₹', span: 3,
        formula: (v) => (isNaN(num(v.value_service)) ? '' : +(num(v.value_service) * 1.18).toFixed(2)) },
    ] },
    { n: 3, title: 'Disbursement Decision', fields: [
      { name: 'tds', label: 'Applicability of TDS', type: 'yesno', span: 4 },
      { name: 'amount_recommended', label: 'Amount Recommended for Disbursement', type: 'number', span: 4, prefix: '₹' },
      { name: 'account_code', label: 'Account Code payment to be made', type: 'text', span: 4, default: 'EX1909010', readOnly: true },
      { name: 'compliance', label: 'Compliance of Pre-disbursement Terms & conditions', type: 'yesno', span: 5 },
      { name: 'recommendation', label: 'Recommendation', type: 'textarea', span: 12 },
    ] },
    { n: 4, title: 'Annexure I — BSE-wise Details', fields: [
      { name: 'ia_name', label: 'IA Name', type: 'text', span: 4 },
      { name: 'bse_name', label: 'BSE Name', type: 'text', span: 4 },
      { name: 'salary_month', label: 'Month for which salary is disbursed', type: 'text', span: 4, placeholder: 'MMM-YYYY' },
      { name: 'monthly_salary', label: 'Monthly Salary of BSE', type: 'number', span: 3, prefix: '₹' },
      { name: 'salary_days', label: 'No. of days salary is paid', type: 'number', span: 3 },
      { name: 'additional_amount', label: 'Any additional amount to BSE', type: 'number', span: 3, prefix: '₹' },
      { name: 'additional_reason', label: 'Reason for such payment', type: 'text', span: 3 },
      { name: 'payment_bse', label: 'Payment to be disbursed to BSE', type: 'computed', prefix: '₹', span: 4,
        formula: (v) => {
          const s = num(v.monthly_salary), d = num(v.salary_days), add = num(v.additional_amount) || 0
          if (isNaN(s) || isNaN(d)) return isNaN(add) ? '' : add
          return Math.round((s * d) / 30) + add
        } },
      { name: 'gt_comments_attendance', label: 'GT Comments on BSE attendance', type: 'textarea', span: 6 },
      { name: 'gt_comments_additional', label: 'GT Comments on additional payment, if any', type: 'textarea', span: 6 },
    ] },
  ],
}

// ── BSE — Disbursement Note for Reimbursement of CAPEX to IA ─────────────────
// Only BSE-fillable / autofilled fields. SDE (Amount Recommended, Recommendation)
// and GT FO (CAPEX verification comments) fields are excluded — they belong on
// the reviewer screens.
export const capexReimbursementSchema = {
  key: 'capex-reimbursement',
  sections: [
    { n: 1, title: 'Industry Association & Sanction Details', fields: [
      { name: 'ia_name', label: 'Industry Association Name', type: 'text', span: 8, readOnly: true,
        help: 'Autofilled from your BSE profile' },
      { name: 'ia_gstin', label: 'GSTIN of IA', type: 'text', span: 4, readOnly: true },
      { name: 'ia_gstin_na_reason', label: 'If GSTIN not applicable — reason', type: 'text', span: 12, readOnly: true,
        showIf: (v) => !v.ia_gstin },
      { name: 'sidbi_gstin', label: 'GSTIN of SIDBI', type: 'text', span: 4, readOnly: true, default: '09AABCS3480N5ZS' },
      { name: 'sanctioned_amount', label: 'Sanctioned Amount', type: 'number', prefix: '₹', span: 4, readOnly: true },
      { name: 'disbursed_till_date', label: 'Disbursed till Date', type: 'number', prefix: '₹', span: 4, readOnly: true },
      { name: 'disbursement_sought', label: 'Disbursement Sought', type: 'number', prefix: '₹', span: 6, required: true,
        validate: (v, values) => {
          if (v === '' || v == null) return ''
          const n = Number(v)
          if (isNaN(n) || n <= 0) return 'Enter a valid amount'
          const sanctioned = Number(values?.sanctioned_amount) || 0
          const already = Number(values?.disbursed_till_date) || 0
          const balance = sanctioned - already
          if (balance > 0 && n > balance) return `Cannot exceed remaining balance ₹${balance.toLocaleString('en-IN')}`
          return ''
        } },
      { name: 'nature_payment', label: 'Nature of Payment', type: 'textarea', span: 12, required: true,
        rows: 5,
        help: 'Editable — SDE may revise during review' },
    ] },
    { n: 2, title: 'Invoice Details', fields: [
      { name: 'invoice_date', label: 'Invoice Date', type: 'text', span: 3, placeholder: 'DD/MM/YYYY', required: true },
      { name: 'invoice_number', label: 'Invoice Number', type: 'text', span: 3, required: true },
      { name: 'value_service', label: 'Value of service / Items supplied', type: 'number', span: 3, prefix: '₹', required: true },
      { name: 'igst', label: 'IGST @18%', type: 'computed', prefix: '₹', span: 3,
        formula: (v) => (isNaN(num(v.value_service)) ? '' : +(num(v.value_service) * 0.18).toFixed(2)) },
      { name: 'total_amount', label: 'Total amount', type: 'computed', prefix: '₹', span: 3,
        formula: (v) => (isNaN(num(v.value_service)) ? '' : +(num(v.value_service) * 1.18).toFixed(2)) },
    ] },
    { n: 3, title: 'TDS & Compliance', fields: [
      { name: 'tds', label: 'Applicability of TDS', type: 'yesno', span: 4, help: 'Autofilled from IA profile' },
      { name: 'tds_na_reason', label: 'If TDS not applicable — reason', type: 'text', span: 8, readOnly: true,
        showIf: (v) => v.tds === 'no' },
      { name: 'account_code', label: 'Account Code payment to be made', type: 'text', span: 6, default: 'EX1909010', readOnly: true },
      { name: 'compliance', label: 'Compliance of Pre-disbursement Terms & Conditions', type: 'yesno', span: 6, required: true },
    ] },
  ],
}

// ── Manpower Agency — BSE Salary Disbursement Request ────────────────────────
// Factory: BSE roster comes from the agency's onboarding profile so the
// multi-select and Annexure I dropdown stay in sync with live data.
export const makeMpaDisbursementSchema = (bseRoster = []) => ({
  key: 'dia-disbursement',
  sections: [
    { n: 1, title: 'Agency, BSEs & Sanction Details', fields: [
      { name: 'bse_names', label: 'Select Name of BSE (multi)', type: 'checkboxes',
        options: bseRoster.length ? bseRoster : ['No BSE mapped to this agency'], span: 12, required: true },
      { name: 'manpower_name', label: 'Manpower Agency Name', type: 'text', span: 6, readOnly: true,
        help: 'Autofilled from login profile' },
      { name: 'agency_gstin', label: 'GSTIN of the Agency', type: 'text', span: 6, readOnly: true,
        help: 'Autofilled from login profile' },
      { name: 'gstin_na_reason', label: 'If GSTIN not applicable — reason', type: 'text', span: 12, readOnly: true,
        showIf: (v) => !v.agency_gstin },
      { name: 'sidbi_gstin', label: 'GSTIN of SIDBI', type: 'text', span: 6, readOnly: true, default: '09AABCS3480N5ZS' },
      { name: 'sanctioned_amount', label: 'Sanctioned Amount', type: 'number', prefix: '₹', span: 6, readOnly: true,
        help: 'Autofilled from sanction letter' },
      { name: 'disbursed_till_date', label: 'Disbursed till Date', type: 'number', prefix: '₹', span: 6, readOnly: true,
        help: 'Autofilled from ledger' },
      { name: 'disbursement_sought', label: 'Disbursement Sought', type: 'number', prefix: '₹', span: 6, required: true,
        validate: (v, values) => {
          if (v === '' || v == null) return ''
          const n = Number(v)
          if (isNaN(n) || n <= 0) return 'Enter a valid amount'
          const sanctioned = Number(values?.sanctioned_amount) || 0
          const already = Number(values?.disbursed_till_date) || 0
          const balance = sanctioned - already
          if (balance > 0 && n > balance) return `Cannot exceed remaining balance ₹${balance.toLocaleString('en-IN')}`
          return ''
        } },
      { name: 'nature_payment', label: 'Nature of Payment', type: 'textarea', span: 12, readOnly: true,
        default: 'Payment towards Salary for the month <<MMM-YYYY>> of ____ BSEs. BSE-wise Details in Annexure I.' },
    ] },
    { n: 2, title: 'Invoice Details', fields: [
      { name: 'invoice_date', label: 'Invoice Date', type: 'text', span: 3, placeholder: 'DD/MM/YYYY', required: true },
      { name: 'invoice_number', label: 'Invoice Number', type: 'text', span: 3, required: true },
      { name: 'value_service', label: 'Value of service / Items supplied', type: 'number', span: 3, prefix: '₹', required: true },
      { name: 'igst', label: 'IGST @18%', type: 'computed', prefix: '₹', span: 3,
        formula: (v) => (isNaN(num(v.value_service)) ? '' : +(num(v.value_service) * 0.18).toFixed(2)) },
      { name: 'total_amount', label: 'Total amount', type: 'computed', prefix: '₹', span: 3,
        formula: (v) => (isNaN(num(v.value_service)) ? '' : +(num(v.value_service) * 1.18).toFixed(2)) },
    ] },
    { n: 3, title: 'TDS & Compliance', fields: [
      { name: 'tds', label: 'Applicability of TDS', type: 'yesno', span: 4, help: 'Autofilled from agency profile' },
      { name: 'tds_na_reason', label: 'If TDS not applicable — reason', type: 'text', span: 8, readOnly: true,
        showIf: (v) => v.tds === 'no' },
      { name: 'account_code', label: 'Account Code payment to be made', type: 'text', span: 6, default: 'EX1909010', readOnly: true },
      { name: 'compliance', label: 'Compliance of Pre-disbursement Terms & Conditions', type: 'yesno', span: 6, required: true },
    ] },
    { n: 4, title: 'Annexure I — BSE-wise Details', fields: [
      { name: 'annex_ia_name', label: 'IA Name', type: 'text', span: 4, required: true },
      { name: 'annex_bse_name', label: 'BSE Name', type: 'select', optionsFrom: (v) => v.bse_names || [], span: 4, required: true,
        help: 'Choose from BSEs selected above' },
      { name: 'salary_month', label: 'Month for which salary is disbursed', type: 'text', span: 4, placeholder: 'MM-YYYY', required: true },
      { name: 'monthly_salary', label: 'Monthly Salary of BSE', type: 'number', span: 3, prefix: '₹', readOnly: true,
        help: 'Auto based on IA + BSE master' },
      { name: 'salary_days', label: 'No. of days salary is paid', type: 'number', span: 3, readOnly: true,
        help: 'Auto from attendance dashboard' },
      { name: 'additional_amount', label: 'Any additional amount to BSE', type: 'number', span: 3, prefix: '₹' },
      { name: 'additional_reason', label: 'Reason for such payment', type: 'text', span: 3 },
      { name: 'payment_bse', label: 'Payment to be disbursed to BSE', type: 'computed', prefix: '₹', span: 4,
        formula: (v) => {
          const s = num(v.monthly_salary), d = num(v.salary_days), add = num(v.additional_amount) || 0
          if (isNaN(s) || isNaN(d)) return isNaN(add) ? '' : add
          return Math.round((s * d) / 30) + add
        } },
    ] },
  ],
})

// ── BSE Salary Request (raised by the Industry Association) ──────────────────
export const salaryRequestSchema = {
  key: 'salary-request',
  sections: [
    { n: 1, title: 'Manpower Agency & Payment', fields: [
      { name: 'manpower_name', label: 'Manpower Agency Name', type: 'text', span: 6 },
      { name: 'agency_gstin', label: 'GSTIN of the Agency', type: 'text', span: 6 },
      { name: 'sidbi_gstin', label: 'GSTIN of SIDBI', type: 'text', span: 6, default: '09AABCS3480N5ZS', readOnly: true },
      { name: 'nature_payment', label: 'Nature of Payment', type: 'textarea', span: 12,
        default: 'Payment towards Salary for the month <<MMM-YYYY>> of ____ BSEs. BSE-wise Details enclosed.' },
    ] },
    { n: 2, title: 'Invoice Details', fields: [
      { name: 'invoice_date', label: 'Invoice Date', type: 'text', span: 3, placeholder: 'DD/MM/YYYY' },
      { name: 'invoice_number', label: 'Invoice Number', type: 'text', span: 3 },
      { name: 'value_service', label: 'Value of service / Items supplied', type: 'number', span: 3, prefix: '₹' },
      { name: 'igst', label: 'IGST @18%', type: 'computed', prefix: '₹', span: 3,
        formula: (v) => (isNaN(num(v.value_service)) ? '' : +(num(v.value_service) * 0.18).toFixed(2)) },
      { name: 'total_amount', label: 'Total amount', type: 'computed', prefix: '₹', span: 3,
        formula: (v) => (isNaN(num(v.value_service)) ? '' : +(num(v.value_service) * 1.18).toFixed(2)) },
    ] },
    { n: 3, title: 'BSE Salary Details', fields: [
      { name: 'ia_name', label: 'IA Name', type: 'text', span: 4 },
      { name: 'bse_name', label: 'BSE Name', type: 'text', span: 4 },
      { name: 'salary_month', label: 'Month for which salary is claimed', type: 'text', span: 4, placeholder: 'MMM-YYYY' },
      { name: 'monthly_salary', label: 'Monthly Salary of BSE', type: 'number', span: 3, prefix: '₹' },
      { name: 'salary_days', label: 'No. of days salary is paid', type: 'number', span: 3 },
      { name: 'additional_amount', label: 'Any additional amount to BSE', type: 'number', span: 3, prefix: '₹' },
      { name: 'additional_reason', label: 'Reason for such payment', type: 'text', span: 3 },
      { name: 'payment_bse', label: 'Payment claimed for BSE', type: 'computed', prefix: '₹', span: 4,
        formula: (v) => {
          const s = num(v.monthly_salary), d = num(v.salary_days), add = num(v.additional_amount) || 0
          if (isNaN(s) || isNaN(d)) return isNaN(add) ? '' : add
          return Math.round((s * d) / 30) + add
        } },
    ] },
  ],
}

// ── Disbursement Note — CAPEX (GT — CAPEX purchase voucher) ─────────────────
const igstField = { name: 'igst', label: 'IGST @18%', type: 'computed', prefix: '₹', span: 3,
  formula: (v) => (isNaN(num(v.value_service)) ? '' : +(num(v.value_service) * 0.18).toFixed(2)) }
const totalField = { name: 'total_amount', label: 'Total amount', type: 'computed', prefix: '₹', span: 3,
  formula: (v) => (isNaN(num(v.value_service)) ? '' : +(num(v.value_service) * 1.18).toFixed(2)) }

export const capexSchema = {
  key: 'capex-note',
  sections: [
    { n: 1, title: 'Industry Association', fields: [
      { name: 'ia_name', label: 'Industry Association Name', type: 'text', span: 8 },
      { name: 'ia_gstin', label: 'GSTIN of IA', type: 'text', span: 4 },
      { name: 'ia_gstin_na_reason', label: 'If GSTIN not applicable — reason', type: 'text', span: 8 },
      { name: 'sidbi_gstin', label: 'GSTIN of SIDBI', type: 'text', span: 4, default: '09AABCS3480N5ZS', readOnly: true },
    ] },
    { n: 2, title: 'Nature of Payment', fields: [
      { name: 'nature_payment', label: 'Nature of Payment', type: 'textarea', span: 12,
        default: 'Payment towards CAPEX purchase.\n\nIA has been sanctioned Rs.____/- towards the purchase of ____. Out of this Rs.____/- has already been disbursed towards the purchase of ____. The present disbursement is of Rs.____/- towards the purchase of ____.' },
    ] },
    { n: 3, title: 'Invoice Details', fields: [
      { name: 'invoice_date', label: 'Invoice Date', type: 'text', span: 3, placeholder: 'DD/MM/YYYY' },
      { name: 'invoice_number', label: 'Invoice Number', type: 'text', span: 3 },
      { name: 'value_service', label: 'Value of service / Items supplied', type: 'number', span: 3, prefix: '₹' },
      igstField,
      totalField,
    ] },
    { n: 4, title: 'Disbursement Decision', fields: [
      { name: 'tds', label: 'Applicability of TDS', type: 'yesno', span: 4 },
      { name: 'tds_na_reason', label: 'If TDS not applicable — reason', type: 'text', span: 8 },
      { name: 'amount_recommended', label: 'Amount Recommended for Disbursement', type: 'number', span: 4, prefix: '₹' },
      { name: 'account_code', label: 'Account Code payment to be made', type: 'text', span: 4, default: 'EX1909010', readOnly: true },
      { name: 'gt_comments_capex', label: 'GT Comments on CAPEX Verification in IA premises', type: 'textarea', span: 12 },
      { name: 'compliance', label: 'Compliance of Pre-disbursement Terms & conditions', type: 'yesno', span: 5 },
      { name: 'recommendation', label: 'Recommendation', type: 'textarea', span: 12 },
    ] },
  ],
}

// ── Appraisal (SIDBI SDE, second level — full 15-point) ─────────────────────
// Turn every editable input field in a section list required.
// Skips subheadings, computed fields (derived), and any field already flagged
// `readOnly` — those are autofetched and users can't fill them, so requiring
// them would only surface false positives when seed data is thin.
function requireAllInputs(sections) {
  return sections.map((sec) => ({
    ...sec,
    fields: sec.fields.map((f) =>
      ['subheading', 'computed'].includes(f.type) || f.readOnly
        ? f
        : { ...f, required: true },
    ),
  }))
}

export const appraisalSchema = {
  key: 'appraisal',
  sections: requireAllInputs([
    ...identity,
    { n: 7, title: 'Comments on Due Diligence', fields: [
      { name: '_dd_ia', label: 'Due Diligence of IA', type: 'subheading', span: 12 },
      { name: '_dd_ia_cibil', label: 'CIBIL — IA', type: 'subheading', span: 12 },
      { name: 'cibil_ref_no', label: 'CIBIL Report Reference No.', type: 'text', span: 6 },
      { name: 'cibil_date', label: 'CIBIL Report Date', type: 'date', span: 3, help: 'Must be after In-Principle creation', validate: afterIaCreation },
      { name: 'cibil_ranking', label: 'Ranking (per CCR)', type: 'text', span: 3 },
      { name: 'cibil_remarks', label: 'CIBIL Remarks', type: 'textarea', span: 12 },

      { name: '_dd_ia_darpan', label: 'NGO Darpan', type: 'subheading', span: 12 },
      { name: 'ngo_darpan_no', label: 'NGO Darpan Number', type: 'text', span: 6 },
      { name: 'ngo_darpan_file', label: 'NGO Darpan copy (upload)', type: 'file', span: 6 },

      { name: '_dd_ia_nabard', label: 'NABARD Blacklist', type: 'subheading', span: 12 },
      { name: 'nabard_blacklisted', label: 'NABARD Blacklisted?', type: 'yesno', span: 6 },
      { name: 'nabard_blacklist_file', label: 'Blacklist document (upload)', type: 'file', span: 6,
        showIf: (v) => v.nabard_blacklisted === 'yes' },

      { name: '_dd_ia_smart', label: 'SMART Report — IA', type: 'subheading', span: 12 },
      { name: 'smart_verified', label: 'SMART Report Available?', type: 'yesno', span: 6 },
      { name: 'smart_ref_no', label: 'SMART Report Reference No.', type: 'text', span: 6, showIf: (v) => v.smart_verified === 'yes' },
      { name: 'smart_date', label: 'SMART Report Date', type: 'date', span: 6, help: 'Must be after In-Principle creation', showIf: (v) => v.smart_verified === 'yes', validate: afterIaCreation },
      { name: 'smart_remarks', label: 'SMART Remarks', type: 'textarea', span: 12, showIf: (v) => v.smart_verified === 'yes' },

      { name: '_dd_ia_web', label: 'Web Search', type: 'subheading', span: 12 },
      { name: 'web_search_verified', label: 'Web Search Verified?', type: 'yesno', span: 6 },
      { name: 'web_search_document', label: 'Web Search Document (upload)', type: 'file', span: 6, showIf: (v) => v.web_search_verified === 'yes' },

      { name: '_dd_holder', label: 'Comments on Due Diligence of IA Office Holder', type: 'subheading', span: 12 },
      { name: '_dd_holder_cibil', label: 'IA Office Holder — CIBIL', type: 'subheading', span: 12 },
      { name: 'holder_cibil_ref_no', label: 'CIBIL Report Reference No.', type: 'text', span: 6 },
      { name: 'holder_cibil_date', label: 'CIBIL Report Date', type: 'date', span: 3, help: 'Must be after In-Principle creation', validate: afterIaCreation },
      { name: 'holder_cibil_score', label: 'CIBIL Score', type: 'text', span: 3 },
      { name: 'holder_cibil_remarks', label: 'CIBIL Remarks', type: 'textarea', span: 12 },
      { name: 'holder_cibil_file', label: 'CIBIL Report (upload)', type: 'file', span: 12 },

      { name: '_dd_holder_smart', label: 'IA Office Holder — SMART', type: 'subheading', span: 12 },
      { name: 'holder_smart_verified', label: 'SMART Report Available?', type: 'yesno', span: 6 },
      { name: 'holder_smart_date', label: 'SMART Report Date', type: 'date', span: 6, help: 'Must be after In-Principle creation', showIf: (v) => v.holder_smart_verified === 'yes', validate: afterIaCreation },
      { name: 'holder_smart_remarks', label: 'SMART Remarks', type: 'textarea', span: 12, showIf: (v) => v.holder_smart_verified === 'yes' },

      { name: '_dd_owner', label: 'Comments on Due Diligence of IA Beneficial Owner/s', type: 'subheading', span: 12 },
      { name: '_dd_owner_cibil', label: 'IA Beneficial Owner/s — CIBIL (extant KYC policy)', type: 'subheading', span: 12 },
      { name: 'owner_cibil_ref_no', label: 'CIBIL Report Reference No.', type: 'text', span: 6 },
      { name: 'owner_cibil_date', label: 'CIBIL Report Date', type: 'date', span: 3, help: 'Must be after In-Principle creation', validate: afterIaCreation },
      { name: 'owner_cibil_ranking', label: 'Ranking / Score', type: 'text', span: 3 },
      { name: 'owner_cibil_remarks', label: 'CIBIL Remarks', type: 'textarea', span: 12 },
      { name: 'owner_cibil_file', label: 'CIBIL Report (upload)', type: 'file', span: 12 },

      { name: '_dd_owner_smart', label: 'IA Beneficial Owner/s — SMART', type: 'subheading', span: 12 },
      { name: 'owner_smart_verified', label: 'SMART Report Available?', type: 'yesno', span: 6 },
      { name: 'owner_smart_date', label: 'SMART Report Date', type: 'date', span: 6, help: 'Must be after In-Principle creation', showIf: (v) => v.owner_smart_verified === 'yes', validate: afterIaCreation },
      { name: 'owner_smart_remarks', label: 'SMART Remarks', type: 'textarea', span: 12, showIf: (v) => v.owner_smart_verified === 'yes' },
    ] },
    { n: 8, title: 'Nearest SIDBI Branch Office', desc: 'Autofetched from In-Principle registration — modifiable', fields: [
      { name: 'sidbi_branch', label: 'Nearest SIDBI Branch Office', type: 'text', span: 6 },
    ] },
    { n: 9, title: 'Cluster / District Details', desc: 'Autofetched from In-Principle registration — modifiable', fields: [
      { name: 'cluster_mapped', label: 'Mapped with an identified cluster?', type: 'yesno', span: 3 },
      { name: 'cluster_which', label: 'If yes, which cluster', type: 'text', span: 5 },
      { name: 'district_mapped', label: 'Mapped with an important district?', type: 'yesno', span: 4 },
      { name: 'msme_count', label: 'MSMEs (without traders) in district', type: 'number', span: 4 },
    ] },
    { n: 10, title: 'Existing Infra Details', desc: 'Autofetched and modifiable', fields: [
      { name: 'members_gt200', label: 'Active members more than 200?', type: 'radio', options: ['Yes', 'No'], span: 6 },
      { name: 'active_members', label: 'No. of active members in IA', type: 'number', span: 3 },
      { name: 'members_justification', label: 'Justification if active member base is less than 200', type: 'textarea', span: 12,
        showIf: (v) => v.members_gt200 === 'No' },
      { name: 'own_building', label: 'Building of IA available?', type: 'yesno', span: 4 },
      { name: 'own_building_details', label: 'If yes, details / facilities', type: 'text', span: 8, showIf: (v) => v.own_building === 'yes' },
      { name: 'it_infra', label: 'IT infrastructure (Computer / Printer / Scanner)?', type: 'yesno', span: 4 },
      { name: 'it_infra_details', label: 'If yes, details', type: 'text', span: 8, showIf: (v) => v.it_infra === 'yes' },
      { name: 'secretariat_staff', label: 'Availability of Secretariat Staff?', type: 'yesno', span: 4 },
      { name: 'secretariat_details', label: 'If yes, details', type: 'text', span: 8, showIf: (v) => v.secretariat_staff === 'yes' },
      { name: 'website', label: 'Website availability?', type: 'yesno', span: 4 },
      { name: 'paid_services', label: 'Paid services offered to members?', type: 'yesno', span: 4 },
      { name: 'paid_services_details', label: 'Details of paid services', type: 'text', span: 12, showIf: (v) => v.paid_services === 'yes' },
      { name: 'major_sources_of_income', label: 'Major sources of income', type: 'textarea', span: 12 },
      { name: 'activities_last_year', label: 'List of activities done in the last year', type: 'textarea', span: 12 },
    ] },
    { n: 11, title: 'DIA Specific Details', fields: [
      { name: 'ready_formalization', label: "IA's readiness to undertake the formalization process", type: 'textarea', span: 12, max: 500 },
      { name: 'ready_referral_yn', label: "IA's readiness to enter referral arrangement with SIDBI", type: 'yesno', span: 4 },
      { name: 'ready_referral', label: 'Remarks — referral arrangement', type: 'textarea', span: 8, max: 500 },
      { name: 'ready_bse_yn', label: "IA's readiness to place SIDBI Business Support Executives", type: 'yesno', span: 4 },
      { name: 'ready_bse', label: 'Remarks — placing SIDBI BSE', type: 'textarea', span: 8, max: 500 },
      { name: '_sectors', label: 'Top 3 sectors of the IA members', type: 'subheading', span: 12 },
      { name: 'sector_1', label: 'Sector #1', type: 'text', span: 4 },
      { name: 'sector_1_problems', label: 'Sector #1 — 3 to 5 key problems', type: 'textarea', span: 8, max: 500 },
      { name: 'sector_2', label: 'Sector #2', type: 'text', span: 4 },
      { name: 'sector_2_problems', label: 'Sector #2 — 3 to 5 key problems', type: 'textarea', span: 8, max: 500 },
      { name: 'sector_3', label: 'Sector #3', type: 'text', span: 4 },
      { name: 'sector_3_problems', label: 'Sector #3 — 3 to 5 key problems', type: 'textarea', span: 8, max: 500 },
      { name: 'financing_scope', label: 'Scope for financing — description (50–75 words)', type: 'textarea', span: 8, max: 500 },
      { name: 'financing_scope_crore', label: 'Scope of financing (₹ crore)', type: 'number', span: 4, placeholder: 'e.g. 5',
        validate: (v) => {
          if (v === '' || v == null) return ''
          const n = Number(v)
          if (!Number.isFinite(n)) return 'Enter a valid amount'
          if (n < 0) return 'Cannot be negative'
          return ''
        } },
      { name: 'project_location', label: 'Location where the project is being proposed', type: 'text', span: 6 },
      { name: 'basis_of_selection', label: 'Basis of selection (autofetched from IA)', type: 'checkboxes', span: 12,
        options: ['More than 200 IAs', 'Active Website', 'Availability of Association Members Database', 'Ready to share the Database', 'Active in Conducting Training Programs', 'All'] },
      { name: 'grant_proposed', label: 'Grant Proposed (₹)', type: 'number', prefix: '₹', span: 4,
        help: 'Autofetched — modifiable. Full amount in rupees.' },
      { name: 'grant_details', label: 'Grant Details proposed', type: 'textarea', span: 12, help: 'Autofetched — modifiable' },
      { name: 'envisaged_output', label: 'Envisaged Output', type: 'textarea', span: 12, max: 500 },
      { name: 'envisaged_outcome', label: 'Envisaged Outcome', type: 'textarea', span: 12, max: 500 },
      { name: 'envisaged_impact', label: 'Envisaged Impact', type: 'textarea', span: 12, max: 500 },
    ] },
    { n: 12, title: 'Cluster Expert Comments', desc: 'Filled by the Cluster Expert before final SDE approval.', fields: [
      { name: 'cluster_expert_comments', label: "Cluster Expert's remarks on the proposal", type: 'textarea', span: 12, rows: 4 },
    ] },
    { n: 13, title: 'Terms of Assistance', fields: [
      { name: 'terms', label: 'Terms of assistance including disbursement pattern and conditions', type: 'textarea', span: 12, placeholder: 'As per Annexure' },
    ] },
    { n: 14, title: 'Budget', fields: [
      // Backend stores this as a LocalDate; we key each option on the
      // April-1 start-date so it round-trips cleanly.
      { name: 'financial_year', label: 'Financial Year', type: 'select', span: 3,
        options: [
          { value: '2023-04-01', label: 'FY 2023-24' },
          { value: '2024-04-01', label: 'FY 2024-25' },
          { value: '2025-04-01', label: 'FY 2025-26' },
          { value: '2026-04-01', label: 'FY 2026-27' },
          { value: '2027-04-01', label: 'FY 2027-28' },
          { value: '2028-04-01', label: 'FY 2028-29' },
        ] },
      { name: 'budget_allocated', label: 'Budget allocated (₹)', type: 'number', prefix: '₹', span: 3 },
      { name: 'budget_utilized', label: 'Utilization so far (₹)', type: 'number', prefix: '₹', span: 3 },
      { name: 'budget_available', label: 'Available Budget (₹)', type: 'computed', prefix: '₹', span: 3,
        formula: (v) => {
          const a = Number(v.budget_allocated) || 0
          const u = Number(v.budget_utilized) || 0
          return a - u
        } },
    ] },
    { n: 15, title: 'Delegation of Power', fields: [
      { name: 'dop_date', label: 'DoP date (as per extant PDIV DoP)', type: 'date', span: 6 },
    ] },
    { n: 16, title: 'Recommendation', fields: [
      { name: 'recommendation', label: 'Recommendation', type: 'radio', options: ['Recommended', 'Not Recommended'], span: 6, required: true },
      { name: 'recommendation_remarks', label: 'Remarks', type: 'textarea', span: 12 },
    ] },
  ]),
}
