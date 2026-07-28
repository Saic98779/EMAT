import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Stack, Typography, Button, Alert, CircularProgress, Card, CardContent,
  Tabs, Tab, Avatar, Divider, Grid,
} from '@mui/material'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined'
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { PageHeader } from '../../components/shared'
import {
  useIAs,
  useAppraisals,
  useBseByPmuStatus,
  useBranchesByStates,
} from '../../queries'

// Queues shown here:
//   L1 pending — IAs with stage 0 in the shared IA list
//   L2 pending — appraisals with isSidbeApproved !== true
//   BSE PMU review — technically the PMU role's queue; kept here until a
//     dedicated PMU workspace exists.
// Approvals themselves happen on the Review pages, not inline — SDE should
// always see the full record before granting sanction.
const PMU_PENDING_STATUS = 'Pending'

const TABS = [
  { key: 'l1', label: 'In-Principle (L1)', icon: FactCheckOutlinedIcon, accent: 'warning' },
  { key: 'l2', label: 'Final Approval (L2)', icon: AssignmentTurnedInOutlinedIcon, accent: 'info' },
  { key: 'bse', label: 'BSE — PMU review', icon: GroupsOutlinedIcon, accent: 'primary' },
]

export default function ApprovalQueue() {
  const navigate = useNavigate()

  const iasQ = useIAs()
  const apprsQ = useAppraisals()
  const pmuQ = useBseByPmuStatus(PMU_PENDING_STATUS)

  const l1Pending = useMemo(
    () => (iasQ.data || []).filter((i) => (i.stage ?? 0) === 0),
    [iasQ.data],
  )
  // Resolve branch UUIDs → branch names for the L1 tab display.
  const { byUuid: branchNameByUuid } = useBranchesByStates(l1Pending.map((i) => i.state))
  // Appraisal DTOs don't carry the IA display name; join against the IA
  // list (already fetched) so rows show the association name, not a UUID.
  const iaNameByUuid = useMemo(() => {
    const m = new Map()
    for (const ia of iasQ.data || []) m.set(ia.uuid, ia.name)
    return m
  }, [iasQ.data])
  const l2Pending = useMemo(
    () => (apprsQ.data || [])
      .filter((a) => !a.approved)
      .map((a) => ({ ...a, iaName: iaNameByUuid.get(a.registrationUuid) || a.iaName })),
    [apprsQ.data, iaNameByUuid],
  )
  const pmuPending = pmuQ.data || []

  const counts = {
    l1: l1Pending.length,
    l2: l2Pending.length,
    bse: pmuPending.length,
  }
  const totalPending = counts.l1 + counts.l2 + counts.bse

  const [tab, setTab] = useState('l1')

  return (
    <Box>
      <PageHeader
        title="Approval queue"
        subtitle={
          totalPending === 0
            ? 'Nothing awaiting your review right now.'
            : `${totalPending} item${totalPending === 1 ? '' : 's'} awaiting your review.`
        }
      />

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {TABS.map((t) => (
          <Grid key={t.key} size={{ xs: 12, sm: 4 }}>
            <SummaryTile
              tab={t}
              count={counts[t.key]}
              active={tab === t.key}
              onClick={() => setTab(t.key)}
            />
          </Grid>
        ))}
      </Grid>

      <Card>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            px: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            minHeight: 48,
            '& .MuiTab-root': { minHeight: 48, textTransform: 'none', fontWeight: 600 },
          }}
        >
          {TABS.map((t) => (
            <Tab
              key={t.key}
              value={t.key}
              label={
                <Stack direction="row" alignItems="center" spacing={1}>
                  <span>{t.label}</span>
                  <CountPill count={counts[t.key]} accent={t.accent} muted={tab !== t.key} />
                </Stack>
              }
            />
          ))}
        </Tabs>

        <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
          {tab === 'l1' && (
            <QueueList
              icon={BusinessOutlinedIcon}
              iconAccent="warning"
              loading={iasQ.isLoading}
              error={iasQ.error}
              items={l1Pending}
              emptyMsg="Nothing pending L1 approval."
              renderItem={(ia) => ({
                primary: ia.name,
                secondary: [ia.city, ia.state].filter(Boolean).join(', ') + ' · ' + (branchNameByUuid.get(ia.branch) || ia.branch || '—'),
                meta: `Submitted ${ia.submitted}`,
                onClick: () => navigate(`/sde/ias/${ia.id}`),
              })}
            />
          )}
          {tab === 'l2' && (
            <QueueList
              icon={AssignmentTurnedInOutlinedIcon}
              iconAccent="info"
              loading={apprsQ.isLoading}
              error={apprsQ.error}
              items={l2Pending}
              emptyMsg="Nothing pending L2 approval."
              renderItem={(a) => ({
                primary: a.iaName,
                secondary: 'Detailed appraisal — awaiting your final sanction',
                meta: [
                  `Submitted ${a.submitted}`,
                  a.updated && a.updated !== a.submitted ? `Updated ${a.updated}` : null,
                ].filter(Boolean).join(' · '),
                onClick: a.registrationUuid ? () => navigate(`/sde/ias/${a.registrationUuid}`) : null,
              })}
            />
          )}
          {tab === 'bse' && (
            <QueueList
              icon={PersonSearchOutlinedIcon}
              iconAccent="primary"
              loading={pmuQ.isLoading}
              error={pmuQ.error}
              items={pmuPending}
              emptyMsg="No BSE candidates pending PMU review."
              renderItem={(c) => ({
                primary: c.name,
                secondary: [c.ia, c.qualification].filter(Boolean).join(' · '),
                meta: `Experience: ${c.experience}`,
                onClick: () => navigate(`/sde/team/${c.uuid}`),
              })}
            />
          )}
        </Box>
      </Card>
    </Box>
  )
}

function SummaryTile({ tab, count, active, onClick }) {
  const Icon = tab.icon
  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        borderColor: active ? `${tab.accent}.main` : 'divider',
        transition: 'border-color .15s, box-shadow .15s',
        ':hover': { borderColor: `${tab.accent}.main` },
      }}
    >
      <CardContent sx={{ p: 2.25, display: 'flex', alignItems: 'center', gap: 1.75 }}>
        <Avatar variant="rounded" sx={{ bgcolor: `${tab.accent}.light`, color: `${tab.accent}.dark`, width: 44, height: 44 }}>
          <Icon fontSize="small" />
        </Avatar>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.2 }}>{tab.label}</Typography>
          <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.2 }}>{count}</Typography>
        </Box>
      </CardContent>
    </Card>
  )
}

function CountPill({ count, accent, muted }) {
  if (count == null) return null
  return (
    <Box
      component="span"
      sx={{
        minWidth: 22, height: 22, px: 0.75, borderRadius: 999,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, lineHeight: 1,
        bgcolor: muted ? 'action.hover' : `${accent}.light`,
        color: muted ? 'text.secondary' : `${accent}.dark`,
      }}
    >
      {count}
    </Box>
  )
}

function QueueList({ icon: Icon, iconAccent, loading, error, items, emptyMsg, renderItem }) {
  if (error) return <Alert severity="error">{error.message || 'Failed to load'}</Alert>
  if (loading && items.length === 0) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={24} /></Box>
  }
  if (items.length === 0) {
    return (
      <Box sx={{ py: 5, textAlign: 'center' }}>
        <Avatar variant="rounded" sx={{ bgcolor: 'action.hover', color: 'text.secondary', width: 48, height: 48, mx: 'auto', mb: 1 }}>
          <Icon fontSize="small" />
        </Avatar>
        <Typography variant="body2" color="text.secondary">{emptyMsg}</Typography>
      </Box>
    )
  }

  return (
    <Stack divider={<Divider component="li" />} sx={{ listStyle: 'none', m: 0, p: 0 }} component="ul">
      {items.map((item) => {
        const view = renderItem(item)
        const clickable = !!view.onClick
        return (
          <Box
            component="li"
            key={item.uuid || item.id}
            onClick={view.onClick || undefined}
            sx={{
              display: 'flex', alignItems: 'center', gap: 2,
              px: 1.5, py: 1.5,
              cursor: clickable ? 'pointer' : 'default',
              transition: 'background-color .12s',
              ':hover': clickable ? { bgcolor: 'action.hover' } : undefined,
            }}
          >
            <Avatar variant="rounded" sx={{ bgcolor: `${iconAccent}.light`, color: `${iconAccent}.dark`, width: 40, height: 40 }}>
              <Icon fontSize="small" />
            </Avatar>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography fontWeight={600} noWrap>{view.primary}</Typography>
              <Typography variant="body2" color="text.secondary" noWrap>{view.secondary}</Typography>
              {view.meta && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                  {view.meta}
                </Typography>
              )}
            </Box>
            {clickable && (
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: 'text.secondary' }}>
                <Typography variant="button" sx={{ fontWeight: 600 }}>Review</Typography>
                <ChevronRightIcon fontSize="small" />
              </Stack>
            )}
          </Box>
        )
      })}
    </Stack>
  )
}
