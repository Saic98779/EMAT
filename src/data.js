// Mock domain data for the eMAT Portal — mirrors the source design's content.

export const ROLES = {
  gt: {
    key: 'gt',
    label: 'GT Field Team',
    tag: 'FIELD',
    short: 'GT Team',
    user: { name: 'Anita Desai', initials: 'AD', title: 'GT Field Team', email: 'anita.gt@emat.in' },
  },
  sde: {
    key: 'sde',
    label: 'SIDBI SDE',
    tag: 'APPRAISAL',
    short: 'SIDBI SDE',
    user: { name: 'Rajesh Menon', initials: 'RM', title: 'SIDBI SDE · Appraisal', email: 'rajesh.sde@sidbi.in' },
  },
  bse: {
    key: 'bse',
    label: 'BSE · Field',
    tag: 'FIELD',
    short: 'BSE',
    user: { name: 'Ravi Kumar', initials: 'RK', title: 'BSE · Field Officer', email: 'ravi.bse@emat.in' },
  },
  ia: {
    key: 'ia',
    label: 'Industry Association',
    tag: 'IA',
    short: 'IA',
    user: { name: 'Lakshmi Iyer', initials: 'LI', title: 'Coimbatore Textile Mfrs. Assn.', email: 'nodal@ctma.org' },
  },
  mpa: {
    key: 'mpa',
    label: 'Manpower Agency',
    tag: 'MPA',
    short: 'MPA',
    user: { name: 'Ramesh Sharma', initials: 'RS', title: 'Manpower Agency · Salary Disbursement', email: 'mpa@sidbi.in' },
  },
}

// Autofilled BSE profile — the IA this BSE is deployed to, sanction status, TDS.
// Used to prefill BSE-facing disbursement / reimbursement forms.
export const bseProfile = {
  ia_name: 'Coimbatore Textile Manufacturers Assn.',
  ia_gstin: '33AABCC1234A1Z1',
  ia_gstin_na_reason: '',
  sidbi_gstin: '09AABCS3480N5ZS',
  sanctioned_amount: 2100000,
  disbursed_till_date: 950000,
  tds_applicable: 'no',
  tds_na_reason: 'IA is a not-for-profit entity — not liable',
  account_code: 'EX1909010',
  nature_payment: 'Payment towards CAPEX purchase.\n\nIA has been sanctioned Rs.______/- towards the purchase of ___________. Out of this Rs.__________/- has already been disbursed towards the purchase of ____________. The present disbursement is of Rs.__________/- towards the purchase of ____________.',
}

// Autofilled agency profile — comes from the MPA's KYC/onboarding record.
export const manpowerProfile = {
  agency_name: 'Skillforce Manpower Pvt. Ltd.',
  agency_gstin: '27AAAAA0000A1Z5',
  gstin_na_reason: '',
  sanctioned_amount: 720000,
  disbursed_till_date: 384000,
  tds_applicable: 'no',
  tds_na_reason: 'Below deduction threshold as per FY declaration',
  sidbi_gstin: '09AABCS3480N5ZS',
  account_code: 'EX1909010',
  nature_payment: 'Payment towards Salary for the month <<MMM-YYYY>> of ____ BSEs. BSE-wise Details in Annexure I.',
  bse_roster: ['Ravi Kumar', 'Meena Joshi', 'Arjun Nair'],
  // Salary + attendance seeded per BSE — used to auto-fill Annexure I.
  bse_master: {
    'Ravi Kumar': { ia: 'Coimbatore Textile Manufacturers Assn.', monthly_salary: 32000, days_this_cycle: 26 },
    'Meena Joshi': { ia: 'Pune Auto Components Cluster', monthly_salary: 30000, days_this_cycle: 24 },
    'Arjun Nair': { ia: 'Surat Diamond & Gems Federation', monthly_salary: 28000, days_this_cycle: 25 },
  },
}

// Salary disbursement requests raised by the IA (seed).
export const salaryRequests = [
  { id: 'SR-101', agency: 'Skillforce Manpower Pvt. Ltd.', bse: 'Ravi Kumar', month: 'May-2026', amount: 32000, invoiceNo: 'INV-5567', date: '02 Jun 2026', status: 'Approved by GT', docs: ['Invoice-INV-5567.pdf', 'Attendance-May.xlsx'] },
  { id: 'SR-102', agency: 'Skillforce Manpower Pvt. Ltd.', bse: 'Ravi Kumar', month: 'Jun-2026', amount: 32000, invoiceNo: 'INV-5601', date: '01 Jul 2026', status: 'Submitted to GT', docs: ['Invoice-INV-5601.pdf'] },
]

export const disbursals = [
  { id: 'DSB-344', amount: 6200, title: 'Field travel & per-diem — Surat cluster survey (2 days)', who: 'Arjun Nair', category: 'Travel & Per-diem', date: '20 Jun 2026', status: 'GT Approval (L1)', flow: 'Awaiting GT (L1) → SIDBI (L2)' },
  { id: 'DSB-341', amount: 8450, title: 'Field travel & per-diem — Tirupur cluster (3 days)', who: 'Ravi Kumar', category: 'Travel & Per-diem', date: '19 Jun 2026', status: 'GT Approval (L1)', flow: 'Awaiting GT (L1) → SIDBI (L2)' },
  { id: 'DSB-338', amount: 3100, title: 'Document printing & notarisation — IA-2048 detailed proposal', who: 'Ravi Kumar', category: 'Documentation', date: '16 Jun 2026', status: 'SIDBI Approval (L2)', flow: 'GT ✓ → Awaiting SIDBI (L2)', note: 'Verified against visit log.' },
  { id: 'DSB-330', amount: 5400, title: 'Field travel — Coimbatore unit visits (2 days)', who: 'Ravi Kumar', category: 'Travel & Per-diem', date: '10 Jun 2026', status: 'Disbursed', flow: 'GT ✓ · SIDBI ✓', note: 'Released to registered account.' },
  { id: 'DSB-325', amount: 4900, title: 'Misc. field expense — receipts incomplete', who: 'Meena Joshi', category: 'Miscellaneous', date: '07 Jun 2026', status: 'Rejected (L1)', flow: 'Rejected at GT (L1)', note: 'Resubmit with itemised receipts.' },
]

export const attendanceRequests = [
  { id: 'ATT-216', type: 'Field Visit', who: 'Ravi Kumar', date: '21 Jun 2026', place: 'Tirupur Knitwear Cluster', note: 'On-site verification at 3 member units; not reporting to branch office.', status: 'Pending' },
  { id: 'ATT-218', type: 'Field Visit', who: 'Meena Joshi', date: '21 Jun 2026', place: 'Bhosari MIDC, Pune', note: 'Member onboarding drive — 5 units.', status: 'Pending' },
  { id: 'ATT-214', type: 'Field Visit', who: 'Ravi Kumar', date: '18 Jun 2026', place: 'SIDBI Coimbatore + 2 units', note: 'Document collection for IA-2048.', status: 'Approved' },
  { id: 'ATT-209', type: 'Field Visit', who: 'Arjun Nair', date: '14 Jun 2026', place: 'Mahidharpura, Surat', note: 'Cluster mapping survey.', status: 'Rejected' },
]

export const bseTeam = [
  { initials: 'RK', name: 'Ravi Kumar', region: 'Tamil Nadu — West', visits: 14, open: 2 },
  { initials: 'MJ', name: 'Meena Joshi', region: 'Maharashtra — Pune', visits: 11, open: 1 },
  { initials: 'AN', name: 'Arjun Nair', region: 'Gujarat — Surat', visits: 9, open: 0 },
]

export const fieldVisits = [
  { id: 'FV-518', name: 'Pollachi Engineering Units', place: 'Pollachi, Tamil Nadu', date: '22 Jun 2026', units: '4 units', purpose: 'Initial cluster survey', status: 'Scheduled' },
  { id: 'FV-512', name: 'Coimbatore Textile Mfrs. Assn.', place: 'Peelamedu, Coimbatore', date: '21 Jun 2026', units: '3 units', purpose: 'Document collection — detailed proposal', status: 'Completed' },
  { id: 'FV-509', name: 'Tirupur Knitwear Cluster', place: 'Tirupur', date: '18 Jun 2026', units: '5 units', purpose: 'Member onboarding verification', status: 'Completed' },
  { id: 'FV-505', name: 'Coimbatore Textile Mfrs. Assn.', place: 'SIDBI Coimbatore', date: '15 Jun 2026', units: '—', purpose: 'Branch coordination meeting', status: 'Completed' },
]

// Approval queue for the SDE role.
export const approvalQueue = [
  { kind: 'BASIC · LEVEL 1', name: 'Surat Diamond & Gems Federation', meta: 'IA-2051 · Surat · submitted 19 Jun 2026', badge: 'Review L1', action: 'Review', iaId: 'IA-2051' },
  { kind: 'BASIC · LEVEL 1', name: 'Morbi Ceramics Association', meta: 'IA-2052 · Morbi · submitted 20 Jun 2026', badge: 'Review L1', action: 'Review', iaId: 'IA-2052' },
  { kind: 'DETAILED · FINAL L2', name: 'Coimbatore Textile Manufacturers Assn.', meta: 'IA-2048 · detailed · funding ask ₹2.10 Cr', badge: 'Final L2', action: 'Final review', iaId: 'IA-2048' },
  { kind: 'DISBURSAL · LEVEL 2', name: 'Disbursal ₹3,100 — Ravi Kumar', meta: 'DSB-338 · Documentation · cleared GT (L1)', badge: 'Disburse', action: 'Approve', iaId: null },
]

// Attendance calendar for the BSE role (June 2026). type: visit | branch | weekend | future
export const attendanceCalendar = (() => {
  // June 2026 starts on Monday. 30 days.
  const branchDays = new Set([9, 16, 23])
  const days = []
  for (let d = 1; d <= 30; d++) {
    const dow = (d - 1) % 7 // 0=Mon .. 6=Sun
    let type
    if (dow >= 5) type = 'weekend'
    else if (d > 22) type = 'future'
    else if (branchDays.has(d)) type = 'branch'
    else type = 'visit'
    days.push({ d, type })
  }
  return days
})()

export const gtStats = {
  cards: [
    { icon: 'proposal', value: 5, label: 'IAs in pipeline', accent: 'primary', delta: { dir: 'up', text: '+2 this week' } },
    { icon: 'action', value: 2, label: 'Need your action', flag: 'action due', accent: 'warning' },
    { icon: 'clock', value: 3, label: 'Awaiting SDE', accent: 'info', delta: { dir: 'up', text: '1 due today' } },
    { icon: 'team', value: 4, label: 'Team requests', accent: 'secondary', delta: { dir: 'down', text: '-1 vs last wk' } },
  ],
  attention: [
    { title: 'Enter detailed appraisal — Pune Auto Components Cluster', meta: 'IA-2047 · basic approved by SDE', badge: 'Action', icon: 'proposal', to: '/gt/ias/IA-2047/appraisal' },
    { title: 'Revise & resubmit — Rajkot Engineering Cluster', meta: 'IA-2044 · changes requested', badge: 'Revise', icon: 'proposal', to: '/gt/ias/IA-2044/appraisal' },
    { title: 'Approve disbursal — ₹6,200', meta: 'DSB-344 · Arjun Nair · Travel & Per-diem', badge: 'L1', icon: 'money', to: '/gt/disbursals' },
    { title: 'Approve disbursal — ₹8,450', meta: 'DSB-341 · Ravi Kumar · Travel & Per-diem', badge: 'L1', icon: 'money', to: '/gt/disbursals' },
    { title: 'Approve attendance — Ravi Kumar', meta: 'ATT-216 · Tirupur Knitwear Cluster', badge: 'L1', icon: 'calendar', to: '/gt/attendance' },
    { title: 'Approve attendance — Meena Joshi', meta: 'ATT-218 · Bhosari MIDC, Pune', badge: 'L1', icon: 'calendar', to: '/gt/attendance' },
  ],
  pipeline: [
    { label: 'Basic in review', value: 2, total: 6, color: 'warning' },
    { label: 'Detailed pending', value: 1, total: 6, color: 'info' },
    { label: 'Final review', value: 1, total: 6, color: 'secondary' },
    { label: 'Approved', value: 1, total: 6, color: 'success' },
  ],
  funnel: [
    { label: 'Captured', value: 6 },
    { label: 'Basic approved', value: 3 },
    { label: 'Detailed submitted', value: 2 },
    { label: 'Sanctioned', value: 1 },
  ],
  week: { data: [3, 5, 4, 6, 2, 1, 0], labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], avgL1: '1.8d', completion: '92%' },
}

export const sdeStats = {
  cards: [
    { icon: 'proposal', value: 2, label: 'Basic in review (L1)', accent: 'warning', delta: { dir: 'up', text: '2 submitted' } },
    { icon: 'shield', value: 1, label: 'Final review (L2)', accent: 'info' },
    { icon: 'money', value: 1, label: 'Disbursals to clear', accent: 'secondary' },
    { icon: 'shield', value: 1, label: 'Approved (MTD)', flag: '+1', accent: 'success', delta: { dir: 'up', text: '+1 today' } },
  ],
  month: [
    { label: 'Basic approved', value: 4, total: 5, color: 'success' },
    { label: 'Final sanctioned', value: 1, total: 5, color: 'success' },
    { label: 'Changes requested', value: 1, total: 5, color: 'secondary' },
    { label: 'Disbursed', value: 1, total: 5, color: 'info' },
  ],
  throughput: { data: [2, 4, 3, 5, 4, 6], labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'] },
  avgTurnaround: '2.4',
  decisionMix: [
    { label: 'Approved', value: 6, color: 'success' },
    { label: 'Changes requested', value: 2, color: 'secondary' },
    { label: 'Rejected', value: 1, color: 'error' },
  ],
}

export const bseStats = {
  cards: [
    { icon: 'route', value: 13, label: 'Field visits (MTD)', flag: 'streak 16d', accent: 'success', delta: { dir: 'up', text: '+3 vs last month' } },
    { icon: 'calendar', value: 1, label: 'Attendance pending', accent: 'warning' },
    { icon: 'money', value: 2, label: 'Disbursals in flight', accent: 'info' },
    { icon: 'shield', value: 1, label: 'Reimbursed (MTD)', accent: 'secondary', delta: { dir: 'up', text: '₹5,400 released' } },
  ],
  recent: [
    { title: 'Field travel & per-diem — Tirupur cluster (3 days)', meta: 'DSB-341 · ₹8,450 · 19 Jun 2026', badge: 'GT Approval (L1)' },
    { title: 'Document printing & notarisation — IA-2048 detailed proposal', meta: 'DSB-338 · ₹3,100 · 16 Jun 2026', badge: 'SIDBI Approval (L2)' },
    { title: 'Field travel — Coimbatore unit visits (2 days)', meta: 'DSB-330 · ₹5,400 · 10 Jun 2026', badge: 'Disbursed' },
  ],
  attendanceMonth: [
    { label: 'Field-visit days', value: 13, total: 16, color: 'success' },
    { label: 'At branch', value: 3, total: 16, color: 'info' },
    { label: 'On-time check-in', value: 100, total: 100, color: 'success', suffix: '%' },
  ],
  streak: { days: 16, note: 'Personal best · 16 days · no missed field days' },
  expense: { data: [4900, 3100, 5400, 8450, 6200], labels: ['May W3', 'May W4', 'Jun W1', 'Jun W2', 'Jun W3'] },
}

export const disbursalCategories = ['Travel & Per-diem', 'Documentation', 'Field Allowance', 'Miscellaneous']
