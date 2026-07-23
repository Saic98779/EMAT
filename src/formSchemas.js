// Data-driven schemas for the onboarding & disbursement forms.
// field: { name, label, type, options?/optionsFrom?, span?, required?, pattern?, otp?, help? }
// types: text | number | email | tel | textarea | yesno | select | radio | checkboxes | file | computed | subheading
import { STATES, districtsOf, sidbiBranchesOf, SDE_OFFICERS } from './geo'
import { clustersOf } from './clusters'

const PINCODE = { re: /^[1-9]\d{5}$/, msg: '6-digit pincode' }

const apexNodal = (prefix) => [
  { name: `${prefix}_name`, label: 'Name', type: 'text', span: 3 },
  { name: `${prefix}_designation`, label: 'Designation', type: 'text', span: 3 },
  { name: `${prefix}_contact`, label: 'Contact Number', type: 'tel', span: 3 },
  { name: `${prefix}_email`, label: 'Email ID', type: 'email', span: 3 },
]

const clusterFields = [
  { name: 'cluster_mapped', label: 'Is it mapped with any identified cluster?', type: 'yesno', span: 5 },
  { name: 'cluster_which', label: 'If yes, which cluster — specify', type: 'text', span: 7 },
]

const grantFields = [
  { name: '_capex', label: 'CAPEX = Capacity Building (IA Members + IA Officials)', type: 'subheading', span: 12 },
  { name: 'grant_cb_member', label: 'Cap. Building — IA Members', type: 'number', span: 4 },
  { name: 'grant_cb_officials', label: 'Cap. Building — IA Officials', type: 'number', span: 4 },
  { name: 'grant_capex', label: 'CAPEX', type: 'computed', sum: ['grant_cb_member', 'grant_cb_officials'], span: 4 },
  { name: '_other_grant', label: 'Other grant components (₹ Lakhs)', type: 'subheading', span: 12 },
  { name: 'grant_bse_salary', label: 'BSE Salary', type: 'number', span: 3 },
  { name: 'grant_other', label: 'Any other', type: 'number', span: 3 },
  { name: 'grant_proposed', label: 'Total Grant Proposed', type: 'number', span: 3 },
]

const envisaged = [
  { name: 'envisaged_output', label: 'Envisaged Output', type: 'textarea', span: 12 },
  { name: 'envisaged_outcome', label: 'Envisaged Outcome', type: 'textarea', span: 12 },
  { name: 'envisaged_impact', label: 'Envisaged Impact', type: 'textarea', span: 12 },
]

const identity = [
  { n: 1, title: 'State', fields: [{ name: 'state', label: 'State', type: 'text', span: 4 }] },
  { n: 2, title: 'Industry Association (IA)', fields: [{ name: 'ia_name', label: 'Name of Industry Association', type: 'text', span: 8 }] },
  { n: 3, title: 'Constitution of IA', fields: [
    { name: 'year_incorp', label: 'Year of Incorporation', type: 'number', span: 3 },
    { name: 'proof_constitution', label: 'Proof of Constitution', type: 'text', span: 5, placeholder: 'Registration certificate / deed' },
  ] },
  { n: 4, title: 'Address of IA', fields: [
    { name: 'address', label: 'Registered address', type: 'text', span: 12 },
    { name: 'district', label: 'District', type: 'text', span: 4 },
    { name: 'pincode', label: 'Pincode', type: 'number', span: 3 },
  ] },
  { n: 5, title: 'Apex Office Holder Details of IA', fields: apexNodal('apex') },
  { n: 6, title: 'Nodal Person Details of IA', fields: apexNodal('nodal') },
]

const infraFields = [
  { name: 'active_members', label: 'No. of active members (should be > 300)', type: 'number', span: 4 },
  { name: 'members_justification', label: 'Justification if active member base is less than 300', type: 'text', span: 8 },
  { name: 'own_building', label: 'Own Building of IA', type: 'yesno', span: 4 },
  { name: 'own_building_details', label: 'If yes, details thereof', type: 'text', span: 8 },
  { name: 'it_infra', label: 'IT infrastructure (Computer / Printer / Scanner etc.)', type: 'yesno', span: 4 },
  { name: 'it_infra_details', label: 'If yes, details thereof', type: 'text', span: 8 },
  { name: 'secretariat_staff', label: 'Availability of Secretariat Staff', type: 'yesno', span: 4 },
  { name: 'secretariat_details', label: 'If yes, details thereof', type: 'text', span: 8 },
  { name: 'website', label: 'Website Availability', type: 'yesno', span: 4 },
  { name: 'paid_services', label: 'Paid services offered to members', type: 'yesno', span: 4 },
  { name: 'paid_services_details', label: 'Details of Paid Services', type: 'text', span: 12 },
]

// ── In-Principle Approval (GT capture, first level) — full validated format ──
export const inPrincipleSchema = {
  key: 'in-principle',
  sections: [
    { n: 1, title: 'State & Industry Association', fields: [
      { name: 'state', label: 'State', type: 'select', options: STATES, span: 4, required: true, help: 'Auto-fetched from location; modifiable' },
      { name: 'ia_name', label: 'Name of Industry Association', type: 'text', span: 8, required: true },
    ] },
    { n: 2, title: 'Constitution of IA', fields: [
      { name: 'constitution_type', label: 'Constitution', type: 'select', span: 5, required: true,
        options: ['Societies Registration Act 1860', 'Section 8 Company', 'Trust', 'Other'] },
      { name: 'ia_profit_type', label: 'Type of IA', type: 'select', span: 4, required: true, options: ['For Profit', 'Not for Profit'] },
      { name: 'year_incorp', label: 'Year of Incorporation', type: 'number', span: 3, required: true,
        validate: (v) => (v === '' ? '' : (!/^\d{4}$/.test(String(v)) ? '4-digit year' : (Number(v) < 1800 || Number(v) > 2026 ? 'Year 1800–2026' : ''))) },
      { name: 'incorp_certificate', label: 'Incorporation Certificate', type: 'file', span: 6 },
      { name: 'constitution_proof', label: 'Proof of Constitution', type: 'file', span: 6 },
    ] },
    { n: 3, title: 'Address of IA', fields: [
      { name: 'address', label: 'Registered address', type: 'text', span: 5 },
      { name: 'district', label: 'District', type: 'select', optionsFrom: (v) => districtsOf(v.state), span: 4, required: true, help: 'Within the selected State' },
      { name: 'pincode', label: 'Pincode', type: 'text', span: 3, required: true, pattern: PINCODE },
    ] },
    { n: 4, title: 'Apex Office Holder Details of IA', fields: [
      { name: 'apex_name', label: 'Name', type: 'text', span: 3, required: true },
      { name: 'apex_designation', label: 'Designation', type: 'text', span: 3 },
      { name: 'apex_contact', label: 'Contact Number', type: 'tel', span: 3, required: true },
      { name: 'apex_email', label: 'Email ID', type: 'email', span: 3, required: true, otp: true },
      { name: 'apex_kyc_doc', label: 'KYC Document (Address Proof)', type: 'select', span: 4,
        options: ['Voter ID card', 'Driving licence', 'Passport', 'Telephone bill', 'Electricity bill', 'Water consumption bill', 'Gas receipt / connection card'] },
      { name: 'apex_id_proof', label: 'ID Proof', type: 'select', span: 4, options: ['PAN', 'Aadhaar', 'Passport', 'Driving Licence'] },
      { name: 'apex_kyc_file', label: 'Upload KYC / ID documents', type: 'file', span: 4 },
    ] },
    { n: 5, title: 'Details of Nodal Contact of IA', fields: [
      { name: 'nodal_name', label: 'Name', type: 'text', span: 3, required: true },
      { name: 'nodal_designation', label: 'Designation', type: 'text', span: 3 },
      { name: 'nodal_contact', label: 'Contact Number', type: 'tel', span: 3, required: true },
      { name: 'nodal_email', label: 'Email ID', type: 'email', span: 3, required: true, otp: true },
    ] },
    { n: 6, title: 'Cluster / District Details', fields: [
      { name: 'sidbi_branch', label: 'Nearest SIDBI Branch Office', type: 'select', optionsFrom: (v) => sidbiBranchesOf(v.state), span: 6, required: true },
      { name: 'cluster_mapped', label: 'Mapped with any identified cluster?', type: 'yesno', span: 3 },
      { name: 'district_mapped', label: 'Mapped with an important district?', type: 'yesno', span: 3 },
      { name: 'cluster_which', label: 'If yes, which cluster', type: 'select', span: 8,
        showIf: (v) => v.cluster_mapped === 'yes',
        optionsFrom: (v) => { const c = clustersOf(v.state).map((x) => x.name); return c.length ? c : ['No identified cluster listed for this State'] } },
      { name: 'msme_count', label: 'No. of MSMEs (without traders) in district', type: 'number', span: 4,
        validate: (v) => (v === '' ? '' : (!/^\d+$/.test(String(v)) ? 'Numbers only' : '')) },
    ] },
    { n: 7, title: 'Existing Infra Details', fields: [
      { name: 'members_gt200', label: 'No. of active members more than 200?', type: 'radio', options: ['Yes', 'No'], span: 5, required: true },
      { name: 'active_members', label: 'No. of active members in IA', type: 'number', span: 3, required: true,
        validate: (v) => (v === '' ? '' : (!/^\d+$/.test(String(v)) ? 'Whole number only' : '')) },
      { name: 'member_directory', label: 'Member directory available', type: 'yesno', span: 4 },
      { name: 'members_justification', label: 'Justification for choosing IA if active member base < 200', type: 'textarea', span: 9, required: true,
        showIf: (v) => v.members_gt200 === 'No' || (v.active_members !== '' && v.active_members != null && Number(v.active_members) < 200) },
      { name: 'members_justification_file', label: 'Approval letter from SIDBI (if any)', type: 'file', span: 3,
        showIf: (v) => v.members_gt200 === 'No' || (v.active_members !== '' && v.active_members != null && Number(v.active_members) < 200) },
      { name: 'building', label: 'Building of IA', type: 'select', span: 4,
        options: ['Owned office', 'Rented office', 'Leased office', 'Office of office bearer'] },
      { name: 'building_proof', label: 'Building proof (declaration / electricity / telephone bill)', type: 'file', span: 4 },
      { name: 'it_infra', label: 'IT infrastructure (Computer / Printer / Scanner)', type: 'yesno', span: 4 },
      { name: 'it_infra_details', label: 'If yes, details', type: 'checkboxes', showIf: (v) => v.it_infra === 'yes',
        options: ['Computer', 'Laptop', 'Printer', 'Printer with Scanner', 'Internet Connection'] },
      { name: 'secretariat_staff', label: 'Availability of Secretariat Staff', type: 'yesno', span: 4 },
      { name: 'secretariat_details', label: 'If yes: Name · Contact No · Email ID', type: 'text', span: 8, showIf: (v) => v.secretariat_staff === 'yes' },
      { name: 'website', label: 'Website availability', type: 'yesno', span: 4 },
      { name: 'website_url', label: 'If yes, website URL', type: 'text', span: 8, showIf: (v) => v.website === 'yes' },
      { name: 'paid_services', label: 'Paid services offered to members', type: 'yesno', span: 4 },
      { name: 'paid_services_details', label: 'Details of paid services', type: 'text', span: 8, showIf: (v) => v.paid_services === 'yes' },
      { name: 'adverse_remarks', label: 'Any adverse remarks about IA on web search?', type: 'yesno', span: 4 },
      { name: 'adverse_details', label: 'If yes, details', type: 'textarea', span: 5, max: 500, showIf: (v) => v.adverse_remarks === 'yes' },
      { name: 'adverse_report', label: 'Upload web report', type: 'file', span: 3, showIf: (v) => v.adverse_remarks === 'yes' },
    ] },
    { n: 8, title: 'DIA Specific Details', fields: [
      { name: 'basis_of_selection', label: 'Basis of selection (select one / multiple / all)', type: 'checkboxes',
        options: ['More than 200 IAs', 'Active Website', 'Availability of Association Members Database', 'Ready to share the Database', 'Active in Conducting Training Programs', 'All'] },
      { name: 'willingness_comments', label: "Comments on IA's willingness to take up Micro income-generating activities", type: 'textarea', span: 12, max: 500 },
      { name: 'worked_before', label: 'GT / SIDBI worked with IA before?', type: 'yesno', span: 4 },
      { name: 'grant_proposed', label: 'Grant Proposed (₹ Lakhs)', type: 'number', span: 4, prefix: '₹',
        validate: (v) => (v === '' ? '' : (isNaN(Number(v)) || Number(v) < 0 ? 'Enter a valid amount' : '')) },
      { name: 'grant_details', label: 'Grant Details proposed (BSE Salary ₹60,000/month from date of joining; Budget for IA Sustainability & Training Program ₹6,80,000)', type: 'textarea', span: 12 },
      { name: 'envisaged_output', label: 'Envisaged Output', type: 'textarea', span: 12, max: 500 },
      { name: 'envisaged_outcome', label: 'Envisaged Outcome', type: 'textarea', span: 12, max: 500 },
      { name: 'envisaged_impact', label: 'Envisaged Impact', type: 'textarea', span: 12, max: 500 },
      { name: 'select_sde', label: 'Select SDE', type: 'select', options: SDE_OFFICERS, span: 6, required: true },
    ] },
  ],
}

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
      { name: 'bse_name', label: 'Name of Proposed BSE', type: 'text', span: 6, required: true },
      { name: 'mobile', label: 'Mobile No', type: 'tel', span: 3, required: true },
      { name: 'email', label: 'Email ID', type: 'email', span: 3, required: true, otp: true },
      { name: 'qualification', label: 'Highest Educational Qualification', type: 'select', span: 12, required: true,
        options: ['Under Graduate', 'Graduate', 'Post Graduate'] },
    ] },
    { n: 3, title: 'Experience', fields: [
      { name: 'experience_status', label: 'Prior Experience', type: 'select', options: ['Yes', 'No'], span: 4, required: true },
      { name: 'experience_years', label: 'Experience — Years', type: 'number', span: 4,
        showIf: (v) => v.experience_status === 'Yes',
        validate: (v) => (v === '' ? '' : (!/^\d+$/.test(String(v)) ? 'Whole number only' : '')) },
      { name: 'experience_months', label: 'Experience — Months', type: 'number', span: 4,
        showIf: (v) => v.experience_status === 'Yes',
        validate: (v) => {
          if (v === '') return ''
          if (!/^\d+$/.test(String(v))) return 'Whole number only'
          if (Number(v) > 11) return '0–11 months'
          return ''
        } },
    ] },
    { n: 4, title: 'Employment & Salary', fields: [
      { name: 'employment_status', label: 'Employment Status', type: 'select', options: ['Working', 'Resigned'], span: 4, required: true },
      { name: 'current_salary', label: 'Current Salary (₹ / month)', type: 'number', span: 4, prefix: '₹',
        showIf: (v) => v.employment_status === 'Working', required: true },
      { name: 'notice_period', label: 'Minimum Notice Period (Days)', type: 'number', span: 4,
        showIf: (v) => v.employment_status === 'Working', required: true },
      { name: 'last_drawn_salary', label: 'Last Drawn Salary (₹ / month)', type: 'number', span: 8, prefix: '₹',
        showIf: (v) => v.employment_status === 'Resigned', required: true },
      { name: 'resignation_doc', label: 'Resignation Acceptance / Relieving Letter', type: 'file', span: 12,
        showIf: (v) => v.employment_status === 'Resigned', required: true },
      { name: 'expected_salary', label: 'Expected Salary (₹ / month)', type: 'number', span: 4, prefix: '₹', required: true,
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
      { name: 'resume_status', label: 'Resume Status', type: 'select', options: ['Received', 'Not Received'], span: 4, required: true },
      { name: 'resume_file', label: 'Upload Resume (PDF)', type: 'file', span: 8,
        showIf: (v) => v.resume_status === 'Received', required: true },
      { name: 'salary_proof', label: 'Salary Slip / Bank Statement (proof of last drawn salary)', type: 'file', span: 12 },
    ] },
    { n: 6, title: 'GT Field Manager Recommendation', fields: [
      { name: 'recommendation', label: 'Recommendation Status', type: 'radio',
        options: ['Recommended', 'Not Recommended'], span: 6, required: true },
      { name: 'recommendation_date', label: 'Recommendation Date', type: 'text', placeholder: 'DD/MM/YYYY', span: 6, required: true },
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
export const appraisalSchema = {
  key: 'appraisal',
  sections: [
    ...identity,
    { n: 7, title: 'Comments on Due Diligence', fields: [
      { name: '_dd_ia', label: 'Due Diligence of IA', type: 'subheading', span: 12 },
      { name: 'dd_ia_cibil', label: 'CIBIL', type: 'text', span: 3 },
      { name: 'dd_ia_darpan', label: 'NGO Darpan', type: 'text', span: 3 },
      { name: 'dd_ia_nabard', label: 'NABARD Blacklist', type: 'text', span: 3 },
      { name: 'dd_ia_smart', label: 'DD report from SMART', type: 'text', span: 3 },
      { name: '_dd_holder', label: 'Due Diligence of IA office holder/s', type: 'subheading', span: 12 },
      { name: 'dd_holder_cibil', label: 'CIBIL', type: 'text', span: 3 },
      { name: 'dd_holder_smart', label: 'DD report from SMART', type: 'text', span: 4 },
      { name: '_dd_owner', label: 'Due Diligence of IA beneficial owner/s (extant KYC policy)', type: 'subheading', span: 12 },
      { name: 'dd_owner_cibil', label: 'CIBIL', type: 'text', span: 3 },
      { name: 'dd_owner_smart', label: 'DD report from SMART', type: 'text', span: 4 },
    ] },
    { n: 8, title: 'Nearest SIDBI Branch Office', fields: [{ name: 'sidbi_branch', label: 'Nearest SIDBI Branch Office', type: 'text', span: 6 }] },
    { n: 9, title: 'Cluster Details', fields: clusterFields },
    { n: 10, title: 'Existing Infra Details', fields: infraFields },
    { n: 11, title: 'DIA Specific Details', fields: [
      { name: 'ready_formalization', label: "Comments on IA's readiness to undertake the formalization process", type: 'textarea', span: 12 },
      { name: 'ready_referral', label: 'Readiness to enter referral arrangement with SIDBI for business leads', type: 'textarea', span: 12 },
      { name: 'ready_bse', label: 'Readiness to place SIDBI Business Support Executives', type: 'textarea', span: 12 },
      { name: 'project_location', label: 'Location where the project is being proposed', type: 'text', span: 6 },
      { name: 'why_selected', label: 'Why IA should be selected', type: 'textarea', span: 12 },
      ...grantFields,
      ...envisaged,
    ] },
    { n: 12, title: 'Terms of Assistance', fields: [
      { name: 'terms', label: 'Terms of assistance including disbursement pattern and condition', type: 'textarea', span: 12, placeholder: 'As per Annexure', help: 'As per Annexure' },
    ] },
    { n: 13, title: 'Budget', fields: [
      { name: 'budget_allocated', label: 'Budget allocated FY-202_', type: 'number', span: 3 },
      { name: 'budget_utilized', label: 'Utilization so far', type: 'number', span: 3 },
      { name: 'budget_available', label: 'Available Budget', type: 'number', span: 3 },
    ] },
    { n: 14, title: 'Delegation of Power', fields: [
      { name: 'dop', label: 'Delegation of Power as per extant PDIV DoP dated', type: 'text', span: 7 },
    ] },
    { n: 15, title: 'Recommendations', fields: [
      { name: 'recommendations', label: 'Recommendations', type: 'textarea', span: 12 },
    ] },
  ],
}
