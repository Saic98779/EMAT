// Data-driven schemas for the two onboarding forms.
// section: { n, title, fields[] }  |  field: { name, label, type, options?, placeholder?, span?, help? }
// types: text | number | email | tel | textarea | yesno | select | computed | subheading
// span is a 12-column width — keep short/numeric fields narrow.

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

// ── In-Principle Approval (GT capture, first level) ─────────────────────────
export const inPrincipleSchema = {
  key: 'in-principle',
  sections: [
    ...identity,
    { n: 7, title: 'Nearest SIDBI Branch Office', fields: [{ name: 'sidbi_branch', label: 'Nearest SIDBI Branch Office', type: 'text', span: 6 }] },
    { n: 8, title: 'Cluster Details', fields: clusterFields },
    { n: 9, title: 'Existing Infra Details', fields: [
      ...infraFields,
      { name: 'adverse_remarks', label: 'Any adverse remarks about IA on web search', type: 'textarea', span: 12 },
    ] },
    { n: 10, title: 'DIA Specific Details', fields: [
      { name: 'why_selected', label: 'Why it should be selected', type: 'textarea', span: 12 },
      ...grantFields,
      ...envisaged,
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
