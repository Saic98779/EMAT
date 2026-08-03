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
import IaEdit from './pages/sde/IaEdit'

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

import ClusterExpertDashboard from './pages/ce/ClusterExpertDashboard'

import HoMakerDashboard from './pages/ho/HoMakerDashboard'
import HoIaApprovals from './pages/ho/HoIaApprovals'
import HoIaReview from './pages/ho/HoIaReview'
import HoBseApprovals from './pages/ho/HoBseApprovals'
import HoBseReview from './pages/ho/HoBseReview'

import PmuDashboard from './pages/pmu/PmuDashboard'
import PmuQueue from './pages/pmu/PmuQueue'
import PmuReview from './pages/pmu/PmuReview'

function Protected({ role, children }) {
  const { role: current } = useAuth()
  if (!current) return <Navigate to="/" replace />
  if (role && current !== role) return <Navigate to={`/${current}`} replace />
  return children
}

// `/sde` is shared by the SIDBI appraisal chain, cluster experts, and SIDBI HO
// Makers — each of the latter two gets its own review-only landing page
// instead of the appraisal/disbursal dashboard.
function SdeHome() {
  const { rawRole } = useAuth()
  if (rawRole === 'CLUSTER_EXPERT') return <ClusterExpertDashboard />
  if (rawRole === 'SIDBI_HO_MAKER') return <HoMakerDashboard />
  return <SdeDashboard />
}

// `/gt` is shared by GT Field Team + GT PMU. Field Team lands on the usual
// GT dashboard; PMU gets a review-only landing page instead.
function GtHome() {
  const { rawRole } = useAuth()
  if (rawRole === 'GT_PMU') return <PmuDashboard />
  return <GtDashboard />
}

// Cluster experts and SIDBI HO Makers share the /sde/* route space; GT Field
// Team and GT PMU share /gt/*. Wraps screens that carry decisions outside a
// role's remit so a hand-typed URL can't hand out powers the sidebar never
// offered. `to` is the fallback landing page for the workspace this guard
// lives in (defaults to /sde for backward-compat).
function DenyRawRoles({ roles, to = '/sde', children }) {
  const { rawRole } = useAuth()
  if (roles.includes(rawRole)) return <Navigate to={to} replace />
  return children
}

export default function App() {
  const { role } = useAuth()

  return (
    <Routes>
      <Route path="/" element={role ? <Navigate to={`/${role}`} replace /> : <Login />} />

      {/* GT — field team + PMU share this workspace. GT_PMU only reaches the
          PMU screens; GT_FIELD_TEAM never sees the PMU queue. Guards default
          `to` to /gt so redirects land inside this workspace. */}
      <Route element={<Protected role="gt"><AppLayout /></Protected>}>
        <Route path="/gt" element={<GtHome />} />
        <Route path="/gt/ias" element={<DenyRawRoles roles={['GT_PMU']} to="/gt"><IndustryAssociations /></DenyRawRoles>} />
        <Route path="/gt/ias/new" element={<DenyRawRoles roles={['GT_PMU']} to="/gt"><InPrincipleApproval /></DenyRawRoles>} />
        <Route path="/gt/ias/:id/appraisal" element={<DenyRawRoles roles={['GT_PMU']} to="/gt"><Appraisal /></DenyRawRoles>} />
        <Route path="/gt/ias/:id/capex" element={<DenyRawRoles roles={['GT_PMU']} to="/gt"><CapexNote /></DenyRawRoles>} />
        <Route path="/gt/ias/:id" element={<DenyRawRoles roles={['GT_PMU']} to="/gt"><ProposalDetail /></DenyRawRoles>} />
        <Route path="/gt/team" element={<DenyRawRoles roles={['GT_PMU']} to="/gt"><BseTeam /></DenyRawRoles>} />
        <Route path="/gt/team/salary" element={<DenyRawRoles roles={['GT_PMU']} to="/gt"><BseSalary /></DenyRawRoles>} />
        <Route path="/gt/team/candidate/new" element={<DenyRawRoles roles={['GT_PMU']} to="/gt"><BseCandidate /></DenyRawRoles>} />
        <Route path="/gt/team/:uuid" element={<DenyRawRoles roles={['GT_PMU']} to="/gt"><BseCandidateDetail /></DenyRawRoles>} />
        <Route path="/gt/salary-requests" element={<DenyRawRoles roles={['GT_PMU']} to="/gt"><GtSalaryRequests /></DenyRawRoles>} />
        <Route path="/gt/attendance" element={<DenyRawRoles roles={['GT_PMU']} to="/gt"><Attendance /></DenyRawRoles>} />
        <Route path="/gt/disbursals" element={<DenyRawRoles roles={['GT_PMU']} to="/gt"><Disbursals /></DenyRawRoles>} />
        <Route path="/gt/pmu/queue" element={<DenyRawRoles roles={['GT_FIELD_TEAM']} to="/gt"><PmuQueue /></DenyRawRoles>} />
        <Route path="/gt/pmu/:uuid" element={<DenyRawRoles roles={['GT_FIELD_TEAM']} to="/gt"><PmuReview /></DenyRawRoles>} />
      </Route>

      {/* SDE — SIDBI appraisal */}
      <Route element={<Protected role="sde"><AppLayout /></Protected>}>
        <Route path="/sde" element={<SdeHome />} />
        <Route path="/sde/queue" element={<DenyRawRoles roles={['CLUSTER_EXPERT', 'SIDBI_HO_MAKER']}><ApprovalQueue /></DenyRawRoles>} />
        <Route path="/sde/ias" element={<DenyRawRoles roles={['SIDBI_HO_MAKER']}><IndustryAssociations basePath="/sde/ias" /></DenyRawRoles>} />
        <Route path="/sde/ias/:id" element={<DenyRawRoles roles={['SIDBI_HO_MAKER']}><ProposalDetail backPath="/sde/ias" /></DenyRawRoles>} />
        <Route path="/sde/ias/:id/edit" element={<DenyRawRoles roles={['CLUSTER_EXPERT', 'SIDBI_HO_MAKER']}><IaEdit /></DenyRawRoles>} />
        <Route path="/sde/ias/:id/appraisal" element={<DenyRawRoles roles={['SIDBI_HO_MAKER']}><Appraisal backPath="/sde/ias" /></DenyRawRoles>} />
        <Route path="/sde/disbursals" element={<DenyRawRoles roles={['CLUSTER_EXPERT', 'SIDBI_HO_MAKER']}><Disbursals role="sde" /></DenyRawRoles>} />
        <Route path="/sde/team/:uuid" element={<DenyRawRoles roles={['CLUSTER_EXPERT', 'SIDBI_HO_MAKER']}><BseCandidateDetail backPath="/sde/queue" backLabel="Approval Queue" /></DenyRawRoles>} />
        <Route path="/sde/ia-approvals" element={<DenyRawRoles roles={['CLUSTER_EXPERT']}><HoIaApprovals /></DenyRawRoles>} />
        <Route path="/sde/ias/:id/ho-review" element={<DenyRawRoles roles={['CLUSTER_EXPERT', 'SIDBI_SDE']}><HoIaReview /></DenyRawRoles>} />
        <Route path="/sde/bse-approvals" element={<DenyRawRoles roles={['CLUSTER_EXPERT', 'SIDBI_SDE']}><HoBseApprovals /></DenyRawRoles>} />
        <Route path="/sde/bse/:uuid/ho-review" element={<DenyRawRoles roles={['CLUSTER_EXPERT', 'SIDBI_SDE']}><HoBseReview /></DenyRawRoles>} />
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
