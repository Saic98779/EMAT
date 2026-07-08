import { createContext, useContext, useState } from 'react'
import {
  industryAssociations as seedIAs, disbursals as seedDisbursals,
  attendanceRequests as seedAttendance, fieldVisits as seedVisits,
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

  const setAttendanceStatus = (id, status) =>
    setAttendance((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))

  const value = {
    ias, disbursals, attendance, visits,
    addIA, submitAppraisal, setIAStatus, addDisbursal, setDisbursalStatus, setAttendanceStatus,
  }
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export const useData = () => useContext(DataContext)
