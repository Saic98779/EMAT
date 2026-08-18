import { useState } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import {
  Box, Drawer, AppBar, Toolbar, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Typography, Avatar, Badge, IconButton, InputBase, Stack, Divider,
  Chip, Menu, MenuItem, useMediaQuery,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined'
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined'
import SearchIcon from '@mui/icons-material/Search'
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone'
import LogoutIcon from '@mui/icons-material/Logout'
import MenuIcon from '@mui/icons-material/Menu'
import { useAuth } from '../auth'
import Logo from './Logo'
import sidbiLogo from '../assets/sidbi-logo.png'
import { useIAs, useAppraisals } from '../queries'
import { unpackHoDecision } from '../apis/industryAssociationAppraisals'

const DRAWER_WIDTH = 288

const ICONS = {
  home: HomeOutlinedIcon, doc: DescriptionOutlinedIcon, groups: GroupsOutlinedIcon,
  calendar: CalendarMonthOutlinedIcon, payments: PaymentsOutlinedIcon, inbox: InboxOutlinedIcon,
  route: RouteOutlinedIcon, personAdd: PersonAddAltOutlinedIcon,
}

// Per-role navigation. `meta` drives the top-bar overline/title per path.
export const NAV = {
  gt: [
    { icon: 'home', label: 'Dashboard', path: '/gt', overline: 'Overview', title: 'Dashboard' },
    { icon: 'doc', label: 'IA Onboarding', path: '/gt/ias', overline: 'Industry Association Onboarding', title: 'Industry Association Onboarding' },
    { icon: 'groups', label: 'BSE Team', path: '/gt/team', overline: 'Team', title: 'BSE team' },
    { icon: 'personAdd', label: 'BSE Onboarding', path: '/gt/team/candidate/new', overline: 'Team', title: 'Propose BSE Candidate' },
    { icon: 'inbox', label: 'Salary Requests', path: '/gt/salary-requests', badge: 1, overline: 'Disbursement', title: 'BSE Salary Requests' },
    { icon: 'calendar', label: 'Attendance', path: '/gt/attendance', badge: 2, overline: 'Field ops', title: 'Attendance' },
    { icon: 'payments', label: 'Disbursals', path: '/gt/disbursals', badge: 2, overline: 'Field ops', title: 'Disbursals' },
    { icon: 'doc', label: 'CAPEX Verification', path: '/gt/capex', overline: 'Field ops', title: 'CAPEX — Field Verification' },
    // Eligibility Matrix intentionally not in the sidebar — it's opened
    // as a read-only modal via the "View Eligibility Matrix" button inside
    // the In-Principle Approval form (see InPrincipleApproval.jsx). The
    // full-page /gt/eligibility/new route stays registered in App.jsx so
    // the eligibility form itself is still reachable for the first-time
    // assessment flow.
  ],
  sde: [
    { icon: 'home', label: 'Dashboard', path: '/sde', overline: 'Overview', title: 'Dashboard' },
    { icon: 'inbox', label: 'Approval Queue', path: '/sde/queue', overline: 'Approvals', title: 'Approval queue' },
    { icon: 'doc', label: 'Industry Associations', path: '/sde/ias', overline: 'Industry Associations', title: 'Industry Associations' },
    { icon: 'personAdd', label: 'Vendors', path: '/sde/vendors', overline: 'Vendors', title: 'Vendor Management' },
    { icon: 'payments', label: 'Disbursals', path: '/sde/disbursals', overline: 'Field ops', title: 'Disbursals' },
    { icon: 'doc', label: 'CAPEX Approvals', path: '/sde/capex', overline: 'Approvals', title: 'CAPEX Approvals' },
  ],
  bse: [
    { icon: 'home', label: 'Dashboard', path: '/bse', overline: 'Overview', title: 'Dashboard' },
    { icon: 'route', label: 'My Field Visits', path: '/bse/visits', overline: 'Field ops', title: 'My field visits' },
    { icon: 'calendar', label: 'Attendance', path: '/bse/attendance', overline: 'Field ops', title: 'Attendance' },
    { icon: 'payments', label: 'Disbursals', path: '/bse/disbursals', overline: 'Field ops', title: 'Disbursals' },
    { icon: 'doc', label: 'CAPEX Reimbursement', path: '/bse/capex/new', overline: 'Disbursement', title: 'Reimbursement of CAPEX to IA' },
  ],
  // CLUSTER_EXPERT rides the SDE routes (same read paths) but its job is only
  // to review applications and leave comments — no approval queue, no
  // disbursals. Keyed separately from `sde` and selected by rawRole below.
  ce: [
    { icon: 'home', label: 'Dashboard', path: '/sde', overline: 'Overview', title: 'Cluster Expert' },
    { icon: 'doc', label: 'Applications', path: '/sde/ias', overline: 'Applications', title: 'Applications' },
  ],
  // SIDBI_HO_MAKER also rides the SDE route space. Its entire job is to
  // approve/reject (with remarks) Industry Associations the Cluster Expert
  // has already commented on — no IA appraisal editing, no disbursals, no
  // L1/L2 approval queue.
  ho: [
    { icon: 'home', label: 'Dashboard', path: '/sde', overline: 'Overview', title: 'SIDBI HO Maker' },
    { icon: 'doc', label: 'IA Approvals', path: '/sde/ia-approvals', overline: 'Approvals', title: 'IA Approvals' },
    { icon: 'groups', label: 'BSE Approvals', path: '/sde/bse-approvals', overline: 'Approvals', title: 'BSE Approvals' },
    { icon: 'payments', label: 'Vendor Disbursements', path: '/sde/vendor-disbursements', overline: 'Approvals', title: 'Vendor Disbursements' },
  ],
  // GT_PMU rides the /gt workspace but only sees the PMU review screens.
  pmu: [
    { icon: 'home', label: 'Dashboard', path: '/gt', overline: 'Overview', title: 'GT PMU' },
    { icon: 'inbox', label: 'PMU Queue', path: '/gt/pmu/queue', overline: 'Approvals', title: 'BSE PMU Queue' },
  ],
  ia: [
    { icon: 'home', label: 'Dashboard', path: '/ia', overline: 'Overview', title: 'Dashboard' },
    { icon: 'payments', label: 'Salary Requests', path: '/ia/requests', overline: 'Disbursement', title: 'BSE Salary Requests' },
  ],
  mpa: [
    { icon: 'payments', label: 'Raise Disbursement Note', path: '/mpa/disburse', overline: 'Disbursement', title: 'Salary Disbursement Request' },
    { icon: 'inbox', label: 'Disbursement Notes', path: '/mpa/disbursements', overline: 'Disbursement', title: 'My Disbursement Notes' },
    { icon: 'groups', label: 'View My Resources', path: '/mpa/resources', overline: 'Resources', title: 'My Resources' },
    { icon: 'calendar', label: 'View Attendance', path: '/mpa/attendance', overline: 'Resources', title: 'Attendance of My Resources' },
    { icon: 'personAdd', label: 'Profile', path: '/mpa/profile', overline: 'Account', title: 'Vendor Profile' },
  ],
}

export default function AppLayout() {
  const { role, rawRole, roleInfo, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isDesktop = useMediaQuery((t) => t.breakpoints.up('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [anchor, setAnchor] = useState(null)

  // Cluster experts and SIDBI HO Makers share the `sde` workspace but each
  // get their own trimmed nav.
  const navKey =
    rawRole === 'CLUSTER_EXPERT' ? 'ce'
    : rawRole === 'SIDBI_HO_MAKER' ? 'ho'
    : rawRole === 'GT_PMU' ? 'pmu'
    : role

  // Live sidebar badges — same query hooks other pages use, so caches are
  // shared and counts stay in sync when approvals happen anywhere.
  const badges = useLiveBadges(navKey)

  const nav = (NAV[navKey] || []).map((item) => {
    const live = badges[item.path]
    return live ? { ...item, badge: live } : item
  })
  // Longest-prefix match so detail routes keep their parent highlighted.
  const active = [...nav].sort((a, b) => b.path.length - a.path.length)
    .find((n) => location.pathname === n.path || location.pathname.startsWith(n.path + '/'))
  const meta = active || nav[0]

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ gap: 1.25, minHeight: '72px !important', py: 1 }}>
        <Logo size={52} />
        <Box>
          <Typography fontWeight={800} fontSize="1.1rem" lineHeight={1} color="primary.dark">eMAT</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.14em' }}>PORTAL</Typography>
        </Box>
      </Toolbar>
      <Divider />
      <Typography variant="overline" color="text.secondary" sx={{ px: 2, pt: 1.5 }}>
        {/* CE / HO Maker share the `sde` workspace, so ROLES[role].label would
            read "SIDBI SDE" — name the actual role instead. */}
        {rawRole === 'CLUSTER_EXPERT' ? 'Cluster Expert'
          : rawRole === 'SIDBI_HO_MAKER' ? 'SIDBI HO Maker'
          : rawRole === 'GT_PMU' ? 'GT PMU'
          : roleInfo?.label}
      </Typography>
      <List sx={{ px: 1, flexGrow: 1 }}>
        {nav.map((item) => {
          const Icon = ICONS[item.icon]
          // Use `active` (not `meta`) so pages without a matching nav item
          // (e.g. /gt/eligibility/new) don't accidentally light up the
          // fallback Dashboard entry. Top-bar title still uses `meta`.
          const selected = active?.path === item.path
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.25 }}>
              <ListItemButton
                selected={selected}
                onClick={() => { navigate(item.path); setMobileOpen(false) }}
                sx={{
                  '&.Mui-selected': { bgcolor: 'primary.light', color: 'primary.dark' },
                  '&.Mui-selected:hover': { bgcolor: 'primary.light' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: selected ? 'primary.dark' : 'text.secondary' }}><Icon fontSize="small" /></ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: selected ? 700 : 500, fontSize: '0.9rem' }} />
                {item.badge > 0 && <Chip label={item.badge} size="small" color={selected ? 'primary' : 'default'} />}
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>
      <Divider />
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ p: 1.5 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36, fontSize: '0.85rem' }}>{roleInfo?.user.initials}</Avatar>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography fontWeight={600} fontSize="0.9rem" noWrap>{roleInfo?.user.name}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{roleInfo?.user.title}</Typography>
        </Box>
        <IconButton size="small" onClick={() => { logout(); navigate('/') }} title="Sign out"><LogoutIcon fontSize="small" /></IconButton>
      </Stack>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={1}
        sx={{ width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, ml: { md: `${DRAWER_WIDTH}px` } }}
      >
        <Toolbar sx={{ gap: 2 }}>
          {!isDesktop && <IconButton edge="start" onClick={() => setMobileOpen(true)}><MenuIcon /></IconButton>}
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="caption" color="text.secondary" lineHeight={1}>{meta?.overline}</Typography>
            <Typography variant="h6" lineHeight={1.2}>{meta?.title}</Typography>
          </Box>
          <Stack direction="row" alignItems="center" spacing={1}
            sx={{
              background: 'linear-gradient(180deg, #ffffff 0%, #eef2f9 100%)',
              border: '1px solid', borderColor: 'divider', borderRadius: 2,
              boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
              px: 1.5, py: 0.75, width: { xs: 0, sm: 260 }, display: { xs: 'none', sm: 'flex' },
              transition: 'box-shadow .2s, border-color .2s',
              '&:focus-within': { borderColor: 'primary.main', boxShadow: (t) => `0 0 0 3px ${alpha(t.palette.primary.main, 0.15)}` },
            }}>
            <SearchIcon fontSize="small" color="disabled" />
            <InputBase placeholder="Search IAs, requests…" sx={{ fontSize: '0.9rem', flexGrow: 1 }} />
          </Stack>
          <Box
            component="img"
            src={sidbiLogo}
            alt="SIDBI"
            sx={{ height: 48, width: 'auto', objectFit: 'contain', display: { xs: 'none', md: 'block' } }}
          />
          <Divider orientation="vertical" flexItem sx={{ my: 0.75, display: { xs: 'none', md: 'block' } }} />
          <IconButton>
            <Badge badgeContent={role === 'bse' ? 3 : 4} color="error"><NotificationsNoneIcon /></Badge>
          </IconButton>
          <IconButton onClick={(e) => setAnchor(e.currentTarget)} sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.8rem' }}>{roleInfo?.user.initials}</Avatar>
          </IconButton>
          <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
            <MenuItem disabled>{roleInfo?.user.email}</MenuItem>
            <Divider />
            <MenuItem onClick={() => { logout(); navigate('/') }}><LogoutIcon fontSize="small" sx={{ mr: 1 }} />Sign out</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={isDesktop ? 'permanent' : 'temporary'}
          open={isDesktop ? true : mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, minWidth: 0 }}>
        <Toolbar />
        <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1280, mx: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}

// Live badge counts, computed from cached query data. Only queries relevant
// to the current role fire (`enabled`), and every mutation that changes a
// list already invalidates the cache — so these counts stay in sync without
// any per-page wiring.
function useLiveBadges(role) {
  const isSde = role === 'sde'
  const isHo = role === 'ho'
  const iasQ = useIAs({ enabled: isSde || isHo })
  const apprsQ = useAppraisals({ enabled: isSde })

  if (isSde) {
    const ias = iasQ.data || []
    const apprs = apprsQ.data || []
    const l1 = ias.filter((i) => (i.stage ?? 0) === 0).length
    const l2 = apprs.filter((a) => !a.approved).length
    return { '/sde/queue': l1 + l2 }
  }
  if (isHo) {
    // Awaiting HO decision = Cluster Expert has commented but HO hasn't
    // packed a decision into recommendationRemarks yet (see
    // unpackHoDecision — no dedicated backend field for this).
    const ias = iasQ.data || []
    const pending = ias.filter((i) =>
      !!String(i.appraisal?.clusterExpertComments || '').trim() && !unpackHoDecision(i.appraisal).decision)
    return { '/sde/ia-approvals': pending.length }
  }
  return {}
}
