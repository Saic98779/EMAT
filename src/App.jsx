import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './auth'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'

import GtDashboard from './pages/gt/GtDashboard'
import IndustryAssociations from './pages/gt/IndustryAssociations'
import ProposalDetail from './pages/gt/ProposalDetail'
import InPrincipleApproval from './pages/gt/InPrincipleApproval'
import Appraisal from './pages/gt/Appraisal'
import CapexNote from './pages/gt/CapexNote'
import BseTeam from './pages/gt/BseTeam'
import BseSalary from './pages/gt/BseSalary'
import BseCandidate from './pages/gt/BseCandidate'
import BseCandidateDetail from './pages/gt/BseCandidateDetail'
import GtSalaryRequests from './pages/gt/GtSalaryRequests'
import Attendance from './pages/gt/Attendance'
import Disbursals from './pages/gt/Disbursals'

import SdeDashboard from './pages/sde/SdeDashboard'
import ApprovalQueue from './pages/sde/ApprovalQueue'

import BseDashboard from './pages/bse/BseDashboard'
import MyFieldVisits from './pages/bse/MyFieldVisits'
import BseAttendance from './pages/bse/BseAttendance'
import BseDisbursals from './pages/bse/BseDisbursals'
import RaiseDisbursal from './pages/bse/RaiseDisbursal'
import BseCapexReimbursement from './pages/bse/BseCapexReimbursement'

import IaDashboard from './pages/ia/IaDashboard'
import IaRequests from './pages/ia/IaRequests'
import IaSalaryRequest from './pages/ia/IaSalaryRequest'

import MpaDashboard from './pages/mpa/MpaDashboard'
import MpaRaiseDisbursement from './pages/mpa/MpaRaiseDisbursement'

function Protected({ role, children }) {
  const { role: current } = useAuth()
  if (!current) return <Navigate to="/" replace />
  if (role && current !== role) return <Navigate to={`/${current}`} replace />
  return children
}

export default function App() {
  const { role } = useAuth()

  return (
    <Routes>
      <Route path="/" element={role ? <Navigate to={`/${role}`} replace /> : <Login />} />

      {/* GT — field team */}
      <Route element={<Protected role="gt"><AppLayout /></Protected>}>
        <Route path="/gt" element={<GtDashboard />} />
        <Route path="/gt/ias" element={<IndustryAssociations />} />
        <Route path="/gt/ias/new" element={<InPrincipleApproval />} />
        <Route path="/gt/ias/:id/appraisal" element={<Appraisal />} />
        <Route path="/gt/ias/:id/capex" element={<CapexNote />} />
        <Route path="/gt/ias/:id" element={<ProposalDetail />} />
        <Route path="/gt/team" element={<BseTeam />} />
        <Route path="/gt/team/salary" element={<BseSalary />} />
        <Route path="/gt/team/candidate/new" element={<BseCandidate />} />
        <Route path="/gt/team/:uuid" element={<BseCandidateDetail />} />
        <Route path="/gt/salary-requests" element={<GtSalaryRequests />} />
        <Route path="/gt/attendance" element={<Attendance />} />
        <Route path="/gt/disbursals" element={<Disbursals />} />
      </Route>

      {/* SDE — SIDBI appraisal */}
      <Route element={<Protected role="sde"><AppLayout /></Protected>}>
        <Route path="/sde" element={<SdeDashboard />} />
        <Route path="/sde/queue" element={<ApprovalQueue />} />
        <Route path="/sde/ias" element={<IndustryAssociations basePath="/sde/ias" />} />
        <Route path="/sde/ias/:id" element={<ProposalDetail backPath="/sde/ias" />} />
        <Route path="/sde/disbursals" element={<Disbursals role="sde" />} />
        <Route path="/sde/team/:uuid" element={<BseCandidateDetail backPath="/sde/queue" backLabel="Approval Queue" />} />
      </Route>

      {/* BSE — field officer */}
      <Route element={<Protected role="bse"><AppLayout /></Protected>}>
        <Route path="/bse" element={<BseDashboard />} />
        <Route path="/bse/visits" element={<MyFieldVisits />} />
        <Route path="/bse/attendance" element={<BseAttendance />} />
        <Route path="/bse/disbursals" element={<BseDisbursals />} />
        <Route path="/bse/disbursals/new" element={<RaiseDisbursal />} />
        <Route path="/bse/capex/new" element={<BseCapexReimbursement />} />
      </Route>

      {/* IA — Industry Association */}
      <Route element={<Protected role="ia"><AppLayout /></Protected>}>
        <Route path="/ia" element={<IaDashboard />} />
        <Route path="/ia/requests" element={<IaRequests />} />
        <Route path="/ia/requests/new" element={<IaSalaryRequest />} />
      </Route>

      {/* DIA — SIDBI internal / manpower disbursement ops */}
      <Route element={<Protected role="dia"><AppLayout /></Protected>}>
        <Route path="/dia" element={<MpaDashboard />} />
        <Route path="/dia/disburse" element={<MpaRaiseDisbursement />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
