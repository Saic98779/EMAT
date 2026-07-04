# eMAT Portal — MUI build

Enterprise Monitoring & Appraisal portal, reimplemented from the Claude Design
source (`eMAT Portal.dc.html`) using **React 19 + MUI v7 (Material Design)**.

Feature parity with the source, restyled with Material components/theme.

## Run

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # production bundle → dist/
```

## Roles (demo credentials — password `demo123`)

| Role | Sign-in | Sections |
|------|---------|----------|
| **GT Field Team** (`anita.gt@emat.in`) | field capture | Dashboard, Industry Associations (list · detail · new proposal), BSE Team, Attendance approvals, Disbursals (L1) |
| **SIDBI SDE** (`rajesh.sde@sidbi.in`) | appraisal | Dashboard, Approval Queue (L1/L2 review modal), Industry Associations, Disbursals (L2) |
| **BSE Field Officer** (`ravi.bse@emat.in`) | field ops | Dashboard (attendance calendar, streak, expense chart), My Field Visits, Attendance, Disbursals + Raise request |

Pick a role on the login screen (or click a demo-credential row to fill it), then Sign in.

## Workflow modelled

`Capture → Appraise → Disburse` — Industry Association proposals go Basic (GT) →
L1 approval (SDE) → Detailed proposal (GT) → L2 sanction (SDE). Field disbursals
are two-level: GT (L1) then SIDBI SDE (L2).

## Stack

- **MUI v7** `@mui/material`, `@mui/icons-material`, `@mui/x-charts` (bar/line charts)
- **React Router v7** — role-based routing, in-memory auth (`src/auth.jsx`)
- **IBM Plex Sans / Mono** via `@fontsource`
- Theme: navy + teal palette in `src/theme.js`; mock domain data in `src/data.js`

## Layout

```
src/
  App.jsx            routes + role guards
  theme.js           MUI theme (palette, typography, component overrides)
  data.js            mock domain data
  auth.jsx           auth context
  components/        AppLayout (drawer + appbar), shared (StatCard, StatusChip, …)
  pages/
    Login.jsx
    gt/    GtDashboard, IndustryAssociations, ProposalDetail, NewProposal, BseTeam, Attendance, Disbursals
    sde/   SdeDashboard, ApprovalQueue
    bse/   BseDashboard, MyFieldVisits, BseAttendance, BseDisbursals, RaiseDisbursal, AttendanceCalendar
```
