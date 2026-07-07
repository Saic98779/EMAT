import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './auth'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'

import GtDashboard from './pages/gt/GtDashboard'
import IndustryAssociations from './pages/gt/IndustryAssociations'
import ProposalDetail from './pages/gt/ProposalDetail'
import InPrincipleApproval from './pages/gt/InPrincipleApproval'
import BseTeam from './pages/gt/BseTeam'
import Attendance from './pages/gt/Attendance'
import Disbursals from './pages/gt/Disbursals'

import SdeDashboard from './pages/sde/SdeDashboard'
import ApprovalQueue from './pages/sde/ApprovalQueue'
import Appraisal from './pages/sde/Appraisal'

import BseDashboard from './pages/bse/BseDashboard'
import MyFieldVisits from './pages/bse/MyFieldVisits'
import BseAttendance from './pages/bse/BseAttendance'
import BseDisbursals from './pages/bse/BseDisbursals'
import RaiseDisbursal from './pages/bse/RaiseDisbursal'

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
        <Route path="/gt/ias/:id" element={<ProposalDetail />} />
        <Route path="/gt/team" element={<BseTeam />} />
        <Route path="/gt/attendance" element={<Attendance />} />
        <Route path="/gt/disbursals" element={<Disbursals />} />
      </Route>

      {/* SDE — SIDBI appraisal */}
      <Route element={<Protected role="sde"><AppLayout /></Protected>}>
        <Route path="/sde" element={<SdeDashboard />} />
        <Route path="/sde/queue" element={<ApprovalQueue />} />
        <Route path="/sde/ias" element={<IndustryAssociations basePath="/sde/ias" />} />
        <Route path="/sde/ias/:id" element={<ProposalDetail backPath="/sde/ias" />} />
        <Route path="/sde/ias/:id/appraisal" element={<Appraisal />} />
        <Route path="/sde/disbursals" element={<Disbursals role="sde" />} />
      </Route>

      {/* BSE — field officer */}
      <Route element={<Protected role="bse"><AppLayout /></Protected>}>
        <Route path="/bse" element={<BseDashboard />} />
        <Route path="/bse/visits" element={<MyFieldVisits />} />
        <Route path="/bse/attendance" element={<BseAttendance />} />
        <Route path="/bse/disbursals" element={<BseDisbursals />} />
        <Route path="/bse/disbursals/new" element={<RaiseDisbursal />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
