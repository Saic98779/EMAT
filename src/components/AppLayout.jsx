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
import SearchIcon from '@mui/icons-material/Search'
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone'
import LogoutIcon from '@mui/icons-material/Logout'
import VerifiedIcon from '@mui/icons-material/Verified'
import MenuIcon from '@mui/icons-material/Menu'
import { useAuth } from '../auth'

const DRAWER_WIDTH = 260

const ICONS = {
  home: HomeOutlinedIcon, doc: DescriptionOutlinedIcon, groups: GroupsOutlinedIcon,
  calendar: CalendarMonthOutlinedIcon, payments: PaymentsOutlinedIcon, inbox: InboxOutlinedIcon,
  route: RouteOutlinedIcon,
}

// Per-role navigation. `meta` drives the top-bar overline/title per path.
export const NAV = {
  gt: [
    { icon: 'home', label: 'Dashboard', path: '/gt', overline: 'Overview', title: 'Dashboard' },
    { icon: 'doc', label: 'Industry Associations', path: '/gt/ias', overline: 'Industry Associations', title: 'Industry Associations' },
    { icon: 'groups', label: 'BSE Team', path: '/gt/team', overline: 'Team', title: 'BSE team' },
    { icon: 'calendar', label: 'Attendance', path: '/gt/attendance', badge: 2, overline: 'Field ops', title: 'Attendance' },
    { icon: 'payments', label: 'Disbursals', path: '/gt/disbursals', badge: 2, overline: 'Field ops', title: 'Disbursals' },
  ],
  sde: [
    { icon: 'home', label: 'Dashboard', path: '/sde', overline: 'Overview', title: 'Dashboard' },
    { icon: 'inbox', label: 'Approval Queue', path: '/sde/queue', badge: 4, overline: 'Approvals', title: 'Approval queue' },
    { icon: 'doc', label: 'Industry Associations', path: '/sde/ias', overline: 'Industry Associations', title: 'Industry Associations' },
    { icon: 'payments', label: 'Disbursals', path: '/sde/disbursals', badge: 1, overline: 'Field ops', title: 'Disbursals' },
  ],
  bse: [
    { icon: 'home', label: 'Dashboard', path: '/bse', overline: 'Overview', title: 'Dashboard' },
    { icon: 'route', label: 'My Field Visits', path: '/bse/visits', overline: 'Field ops', title: 'My field visits' },
    { icon: 'calendar', label: 'Attendance', path: '/bse/attendance', overline: 'Field ops', title: 'Attendance' },
    { icon: 'payments', label: 'Disbursals', path: '/bse/disbursals', overline: 'Field ops', title: 'Disbursals' },
  ],
}

export default function AppLayout() {
  const { role, roleInfo, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isDesktop = useMediaQuery((t) => t.breakpoints.up('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [anchor, setAnchor] = useState(null)

  const nav = NAV[role] || []
  // Longest-prefix match so detail routes keep their parent highlighted.
  const active = [...nav].sort((a, b) => b.path.length - a.path.length)
    .find((n) => location.pathname === n.path || location.pathname.startsWith(n.path + '/'))
  const meta = active || nav[0]

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ gap: 1.5 }}>
        <Avatar variant="rounded" sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}><VerifiedIcon fontSize="small" /></Avatar>
        <Box>
          <Typography fontWeight={700} lineHeight={1}>eMAT</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.12em' }}>PORTAL</Typography>
        </Box>
      </Toolbar>
      <Divider />
      <Typography variant="overline" color="text.secondary" sx={{ px: 2, pt: 1.5 }}>{roleInfo?.label}</Typography>
      <List sx={{ px: 1, flexGrow: 1 }}>
        {nav.map((item) => {
          const Icon = ICONS[item.icon]
          const selected = meta?.path === item.path
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
                {item.badge && <Chip label={item.badge} size="small" color={selected ? 'primary' : 'default'} />}
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
