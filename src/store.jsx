import { createContext, useCallback, useContext, useState } from 'react'
import {
  disbursals as seedDisbursals,
  attendanceRequests as seedAttendance, fieldVisits as seedVisits,
  salaryRequests as seedSalaryRequests,
} from './data'
import { listIndustryAssociations, fromDto as iaFromDto } from './apis/industryAssociations'
import { listAppraisals } from './apis/industryAssociationAppraisals'
import { listBseRecommendations, fromDto as bseFromDto } from './apis/bseRecommendations'

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

// Backends may return a raw array, a Spring Page (`{ content: [] }`), or the
// generic `{ items: [] }` shape — accept all three.
function unwrapList(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.content)) return data.content
  if (Array.isArray(data?.items)) return data.items
  return []
}

export function DataProvider({ children }) {
  const [ias, setIas] = useState([])
  const [iasLoading, setIasLoading] = useState(false)
  const [iasError, setIasError] = useState(null)

  // Load Industry Association registrations from the backend + the linked
  // detailed appraisals so the derived status can advance to L2 / Approved.
  // Both fetches run in parallel; appraisals are matched to registrations by
  // `registrationUuid`. Appraisal failure is non-fatal — the list still
  // renders with L1 statuses.
  const refreshIAs = useCallback(async ({ signal } = {}) => {
    setIasLoading(true)
    setIasError(null)
    try {
      const [regRaw, apprRaw] = await Promise.all([
        listIndustryAssociations({ signal }),
        listAppraisals({ signal }).catch(() => []),
      ])
      const regs = unwrapList(regRaw)
      const apprs = unwrapList(apprRaw)
      const byReg = new Map(apprs.map((a) => [a.registrationUuid, a]).filter(([k]) => !!k))
      setIas(regs.map((r) => iaFromDto(r, byReg.get(r.uuid) || null)))
    } catch (err) {
      if (err.name === 'AbortError') return
      setIasError(err.message || 'Failed to load Industry Associations')
    } finally {
      setIasLoading(false)
    }
  }, [])
  const [disbursals, setDisbursals] = useState(seedDisbursals)
  const [attendance, setAttendance] = useState(seedAttendance)
  const [visits, setVisits] = useState(seedVisits)
  const [salaryRequests, setSalaryRequests] = useState(seedSalaryRequests)
  const [bseCandidates, setBseCandidates] = useState([])
  const [bseCandidatesLoading, setBseCandidatesLoading] = useState(false)
  const [bseCandidatesError, setBseCandidatesError] = useState(null)

  // Load BSE candidate recommendations from the backend. Mirrors refreshIAs:
  // callers decide when to trigger (on mount, after a mutation, etc.).
  const refreshBseCandidates = useCallback(async ({ signal } = {}) => {
    setBseCandidatesLoading(true)
    setBseCandidatesError(null)
    try {
      const data = await listBseRecommendations({ signal })
      const list = Array.isArray(data)
        ? data
        : (Array.isArray(data?.content) ? data.content
          : (Array.isArray(data?.items) ? data.items : []))
      setBseCandidates(list.map(bseFromDto))
    } catch (err) {
      if (err.name === 'AbortError') return
      setBseCandidatesError(err.message || 'Failed to load BSE candidates')
    } finally {
      setBseCandidatesLoading(false)
    }
  }, [])
  const [mpaRequests, setMpaRequests] = useState([])

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

  // BSE raises a CAPEX reimbursement note for the IA they are deployed to.
  const addBseCapexRequest = (f) => {
    const id = nextId('DSB', disbursals)
    const d = {
      id,
      amount: parseFloat(f.disbursement_sought) || 0,
      title: `CAPEX Reimbursement — ${f.ia_name || 'IA'}${f.invoice_number ? ` · Inv ${f.invoice_number}` : ''}`,
      who: f.ia_name || 'IA',
      category: 'CAPEX',
      date: today(),
      status: 'GT Approval (L1)',
      flow: 'Awaiting GT (L1) → SIDBI (L2)',
    }
    setDisbursals((prev) => [d, ...prev])
    return id
  }

  // Manpower Agency submits a salary disbursement request (per pay cycle).
  const addMpaRequest = (f) => {
    const id = nextId('MPA', mpaRequests)
    const req = {
      id,
      agency: f.manpower_name || '—',
      bses: (f.bse_names || []).length,
      bseList: f.bse_names || [],
      month: f.salary_month || '—',
      sought: parseFloat(f.disbursement_sought) || 0,
      total: parseFloat(f.total_amount) || 0,
      invoiceNo: f.invoice_number || '—',
      invoiceDate: f.invoice_date || '—',
      date: today(),
      status: 'Submitted to HO Maker',
    }
    setMpaRequests((prev) => [req, ...prev])
    return id
  }

  const value = {
    ias, iasLoading, iasError, refreshIAs,
    bseCandidatesLoading, bseCandidatesError, refreshBseCandidates,
    disbursals, attendance, visits, salaryRequests, bseCandidates, mpaRequests,
    submitAppraisal, setIAStatus, addDisbursal, setDisbursalStatus, setAttendanceStatus,
    addSalary, addCapex, addSalaryRequest, reviewSalaryRequest, addBseCandidate, addMpaRequest, addBseCapexRequest,
  }
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export const useData = () => useContext(DataContext)
