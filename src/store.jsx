import { createContext, useContext, useState } from 'react'
import {
  industryAssociations as seedIAs, disbursals as seedDisbursals,
  attendanceRequests as seedAttendance, fieldVisits as seedVisits,
  salaryRequests as seedSalaryRequests,
} from './data'

const DataContext = createContext(null)

const today = () =>
  new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

const nextId = (prefix, list) => {
  const nums = list.map((x) => parseInt(x.id.split('-')[1], 10)).filter((n) => !isNaN(n))
  return `${prefix}-${(nums.length ? Math.max(...nums) : 0) + 1}`
}

const money = (v) => {
  const n = parseFloat(v)
  return isNaN(n) ? '—' : `₹${n} L`
}

export function DataProvider({ children }) {
  const [ias, setIas] = useState(seedIAs)
  const [disbursals, setDisbursals] = useState(seedDisbursals)
  const [attendance, setAttendance] = useState(seedAttendance)
  const [visits, setVisits] = useState(seedVisits)
  const [salaryRequests, setSalaryRequests] = useState(seedSalaryRequests)
  const [bseCandidates, setBseCandidates] = useState([])

  // GT captures an In-Principle Approval → new IA enters the pipeline.
  const addIA = (f) => {
    const id = nextId('IA', ias)
    const ia = {
      id,
      name: f.ia_name || 'New Industry Association',
      sector: f.sector || '—',
      city: f.district || '—',
      state: f.state || '—',
      branch: f.sidbi_branch || '—',
      status: 'Basic · In Review',
      stage: 0,
      est: f.year_incorp || '—',
      address: f.address || '—',
      apex: { name: f.apex_name || '—', role: f.apex_designation || '—', phone: f.apex_contact || '—', email: f.apex_email || '—' },
      nodal: { name: f.nodal_name || '—', role: f.nodal_designation || '—', phone: f.nodal_contact || '—', email: f.nodal_email || '—' },
      detailed: null,
      submitted: today(),
      trail: [{ title: 'Basic proposal submitted', by: 'Anita Desai · GT', date: today() }],
    }
    setIas((prev) => [ia, ...prev])
    return id
  }

  // GT submits the detailed appraisal → advances the IA to final (L2) review.
  const submitAppraisal = (id, f) => {
    setIas((prev) => prev.map((ia) => {
      if (ia.id !== id) return ia
      return {
        ...ia,
        status: 'Final Review (L2)',
        stage: 2,
        detailed: {
          memberUnits: f.active_members || '—',
          turnover: '—',
          fundingAsk: money(f.grant_proposed),
          employment: '—',
          womenWorkforce: '—',
          purpose: f.why_selected || '—',
        },
        trail: [...ia.trail, { title: 'Detailed appraisal submitted', by: 'Anita Desai · GT', date: today() }],
      }
    }))
  }

  const setIAStatus = (id, status, stage) =>
    setIas((prev) => prev.map((ia) => (ia.id === id ? { ...ia, status, ...(stage != null ? { stage } : {}) } : ia)))

  // BSE raises a field-expense claim.
  const addDisbursal = (f) => {
    const id = nextId('DSB', disbursals)
    const d = {
      id,
      amount: parseFloat(f.amount) || 0,
      title: f.purpose || 'Field expense claim',
      who: 'Ravi Kumar',
      category: f.category || 'Miscellaneous',
      date: f.date || today(),
      status: 'GT Approval (L1)',
      flow: 'Awaiting GT (L1) → SIDBI (L2)',
    }
    setDisbursals((prev) => [d, ...prev])
    return id
  }

  const setDisbursalStatus = (id, status, flow) =>
    setDisbursals((prev) => prev.map((d) => (d.id === id ? { ...d, status, ...(flow ? { flow } : {}) } : d)))

  // GT disburses a BSE salary (via manpower agency) → recorded as a disbursal.
  const addSalary = (f) => {
    const id = nextId('DSB', disbursals)
    const d = {
      id,
      amount: parseFloat(f.amount_recommended) || 0,
      title: `BSE salary — ${f.bse_name || 'BSE'} · ${f.salary_month || ''}`.trim(),
      who: f.bse_name || 'BSE',
      category: 'BSE Salary',
      date: today(),
      status: 'Disbursed',
      flow: `Manpower agency · ${f.manpower_name || '—'}`,
    }
    setDisbursals((prev) => [d, ...prev])
    return id
  }

  const setAttendanceStatus = (id, status) =>
    setAttendance((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))

  // Industry Association raises a BSE salary disbursement request (with docs).
  const addSalaryRequest = (f, docs) => {
    const id = nextId('SR', salaryRequests)
    const s = parseFloat(f.monthly_salary), d = parseFloat(f.salary_days), add = parseFloat(f.additional_amount) || 0
    const payout = !isNaN(s) && !isNaN(d) ? Math.round((s * d) / 30) + add : (parseFloat(f.total_amount) || 0)
    const req = {
      id,
      agency: f.manpower_name || '—',
      bse: f.bse_name || '—',
      month: f.salary_month || '—',
      amount: payout,
      invoiceNo: f.invoice_number || '—',
      date: today(),
      status: 'Submitted to GT',
      docs: docs || [],
    }
    setSalaryRequests((prev) => [req, ...prev])
    return id
  }

  // GT reviews an IA salary request — records comments and a decision.
  const reviewSalaryRequest = (id, status, comments) =>
    setSalaryRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status, gtComments: comments } : r)))

  // GT disburses a CAPEX purchase for an IA → recorded as a disbursal.
  const addCapex = (f) => {
    const id = nextId('DSB', disbursals)
    const d = {
      id,
      amount: parseFloat(f.amount_recommended) || 0,
      title: `CAPEX — ${f.ia_name || 'IA'}${f.invoice_number ? ` · Inv ${f.invoice_number}` : ''}`,
      who: f.ia_name || 'IA',
      category: 'CAPEX',
      date: today(),
      status: 'Disbursed',
      flow: 'CAPEX purchase · IA premises verified',
    }
    setDisbursals((prev) => [d, ...prev])
    return id
  }

  // GT Field Manager proposes a new BSE candidate for an approved IA.
  const addBseCandidate = (f) => {
    const id = nextId('BSC', bseCandidates)
    const c = {
      id,
      name: f.bse_name || '—',
      ia: f.ia_name || '—',
      state: f.state || '—',
      district: f.district || '—',
      mobile: f.mobile || '—',
      email: f.email || '—',
      qualification: f.qualification || '—',
      experienceStatus: f.experience_status || '—',
      experience: f.experience_status === 'Yes'
        ? `${f.experience_years || 0}y ${f.experience_months || 0}m`
        : '—',
      employmentStatus: f.employment_status || '—',
      currentSalary: parseFloat(f.current_salary) || null,
      noticePeriod: f.notice_period || null,
      lastDrawnSalary: parseFloat(f.last_drawn_salary) || null,
      expectedSalary: parseFloat(f.expected_salary) || 0,
      resumeStatus: f.resume_status || '—',
      recommendation: f.recommendation || '—',
      recommendationDate: f.recommendation_date || today(),
      submitted: today(),
      status: 'Proposed by GT',
    }
    setBseCandidates((prev) => [c, ...prev])
    return id
  }

  const value = {
    ias, disbursals, attendance, visits, salaryRequests, bseCandidates,
    addIA, submitAppraisal, setIAStatus, addDisbursal, setDisbursalStatus, setAttendanceStatus,
    addSalary, addCapex, addSalaryRequest, reviewSalaryRequest, addBseCandidate,
  }
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export const useData = () => useContext(DataContext)
