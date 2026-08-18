import { useMemo, useState } from 'react'
import {
  Box, Card, CardContent, Stack, Typography, Button, Avatar, Snackbar, Alert,
  Chip, CircularProgress, Tabs, Tab, Divider, Tooltip,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import RefreshIcon from '@mui/icons-material/Refresh'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import { PageHeader, Mono } from '../../components/shared'
import ConfirmDialog from '../../components/ConfirmDialog'
import {
  useBseAttendanceManualRequestList,
  useBseAttendanceManualRequestsByStatus,
  useApproveBseAttendanceManualRequest,
  useRejectBseAttendanceManualRequest,
  useBseList,
} from '../../queries'
import { userIdToUuid } from '../../apis/bseAttendanceManualRequest'
import { useAuth } from '../../auth'

// GT Field Team — manual attendance approvals.
//
// A BSE files a manual (backdated) attendance request from
// /bse/attendance ("Missed a day? → Request"). GT reviews the reason and
// the proposed in/out times, then approves or rejects. Approving flips
// the row's isApproved to true; the backend then counts it toward the
// BSE's working days.
//
// Backend split:
//   • GET /bse-attendance-manual-request                         → all rows
//   • GET /bse-attendance-manual-request/approval-status/true    → approved
//   • GET /bse-attendance-manual-request/approval-status/false   → rejected
//   • (no server filter for "pending" — status is nullable and the
//      endpoint only accepts a Boolean, so we list all and filter
//      isApproved === null on the client.)
//   • PATCH .../{id}/approve  · PATCH .../{id}/reject             → decision

const TABS = [
  { key: 'pending',  label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

export default function Attendance() {
  const { user } = useAuth()
  // Backend `/approve` + `/reject` require an `approvedBy` UUID query
  // param but users don't have UUIDs on this backend (userId is an int).
  // Encode the current approver's userId into a UUID-shaped placeholder
  // so the backend at least records who acted.
  const approvedBy = userIdToUuid(user?.userId)
  const [tab, setTab] = useState('pending')
  const [toast, setToast] = useState({ severity: '', msg: '' })
  const [confirm, setConfirm] = useState(null) // { row, action }

  const allQ = useBseAttendanceManualRequestList()
  const approvedQ = useBseAttendanceManualRequestsByStatus(true)
  const rejectedQ = useBseAttendanceManualRequestsByStatus(false)
  const bseQ = useBseList()

  const approve = useApproveBseAttendanceManualRequest()
  const reject = useRejectBseAttendanceManualRequest()

  const pending = useMemo(
    () => (allQ.data || []).filter((r) => r?.isApproved == null),
    [allQ.data],
  )
  const approved = approvedQ.data || []
  const rejected = rejectedQ.data || []

  // Name lookup for BSE recommendation ids — the manual-request DTO only
  // carries `bseRecommendationId`, so we join against the cached BSE list.
  const bseNameById = useMemo(() => {
    const m = new Map()
    for (const b of bseQ.data || []) {
      const id = b?.uuid || b?.id
      const nm = b?.bseName || b?.name
      if (id && nm) m.set(id, nm)
    }
    return m
  }, [bseQ.data])

  const rows = tab === 'pending' ? pending
             : tab === 'approved' ? approved
             : rejected

  const busy = allQ.isLoading || approvedQ.isLoading || rejectedQ.isLoading
  const mutating = approve.isPending || reject.isPending

  const runDecision = async () => {
    if (!confirm) return
    const mut = confirm.action === 'approve' ? approve : reject
    try {
      await mut.mutateAsync({
        id: confirm.row.uuid,
        approvedBy,
        recommendationId: confirm.row.bseRecommendationId,
      })
      setToast({
        severity: 'success',
        msg: `${confirm.action === 'approve' ? 'Approved' : 'Rejected'} ${confirm.row.attendanceDate}.`,
      })
      setConfirm(null)
    } catch (err) {
      setToast({ severity: 'error', msg: err?.message || `Failed to ${confirm.action} request.` })
    }
  }

  return (
    <Box>
      <PageHeader
        title="Attendance requests"
        subtitle="Review missed-day and backdated attendance filed by your BSE team. Approving counts the day toward salary and working-day totals."
        action={
          <Button
            variant="outlined"
            startIcon={busy ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={() => { allQ.refetch(); approvedQ.refetch(); rejectedQ.refetch() }}
            disabled={busy}
            sx={{ textTransform: 'none' }}
          >
            {busy ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />

      {/* Summary strip — quick glanceable count per bucket */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2.5 }}>
        <SummaryCard label="Pending review" value={pending.length} tone="warning" icon={<AccessTimeIcon />} />
        <SummaryCard label="Approved"       value={approved.length} tone="success" icon={<CheckCircleIcon />} />
        <SummaryCard label="Rejected"       value={rejected.length} tone="error"   icon={<CancelIcon />} />
      </Stack>

      <Card sx={{ mb: 2, borderRadius: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}
          sx={{
            px: 1,
            borderBottom: '1px solid', borderColor: 'divider',
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 48 },
          }}>
          {TABS.map((t) => {
            const count = t.key === 'pending' ? pending.length
              : t.key === 'approved' ? approved.length
              : rejected.length
            return (
              <Tab key={t.key} value={t.key}
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <span>{t.label}</span>
                    <Chip size="small" label={count}
                      color={t.key === 'pending' && count > 0 ? 'warning' : 'default'}
                      variant={t.key === tab ? 'filled' : 'outlined'}
                      sx={{ height: 20, fontWeight: 700 }} />
                  </Stack>
                }
              />
            )
          })}
        </Tabs>
      </Card>

      {busy && rows.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : rows.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <Stack spacing={1.5}>
          {rows.map((r) => (
            <RequestCard
              key={r.uuid}
              row={r}
              bseName={bseNameById.get(r.bseRecommendationId)}
              onApprove={() => setConfirm({ row: r, action: 'approve' })}
              onReject={() => setConfirm({ row: r, action: 'reject' })}
              disabled={mutating}
            />
          ))}
        </Stack>
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={runDecision}
        busy={mutating}
        severity={confirm?.action === 'approve' ? 'success' : 'error'}
        title={confirm?.action === 'approve'
          ? 'Approve attendance request?'
          : 'Reject attendance request?'}
        description={confirm && (
          <>
            {confirm.action === 'approve'
              ? 'This will mark the day as attended for the BSE and count it toward their salary / working-day totals.'
              : 'The BSE will see this request marked as rejected. This can\'t be undone from this screen.'}
            <br /><br />
            <strong>{bseNameById.get(confirm.row.bseRecommendationId) || 'BSE'}</strong> · {confirm.row.attendanceDate}
            {' · '}
            <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}>
              {short(confirm.row.inTime)} → {short(confirm.row.outTime)}
            </span>
          </>
        )}
        confirmLabel={confirm?.action === 'approve' ? 'Approve' : 'Reject'}
      />

      <Snackbar open={!!toast.msg} autoHideDuration={3000}
        onClose={() => setToast({ severity: '', msg: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={toast.severity || 'info'} variant="filled"
          onClose={() => setToast({ severity: '', msg: '' })}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}

function SummaryCard({ label, value, tone, icon }) {
  return (
    <Card sx={(t) => ({
      flex: 1,
      borderRadius: 2,
      borderLeft: `4px solid ${t.palette[tone].main}`,
      transition: 'box-shadow .15s',
      '&:hover': { boxShadow: 3 },
    })}>
      <CardContent sx={{ py: 1.75, '&:last-child': { pb: 1.75 } }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={(t) => ({
            width: 40, height: 40, borderRadius: 1.5,
            bgcolor: alpha(t.palette[tone].main, 0.12),
            color: t.palette[tone].dark,
            display: 'grid', placeItems: 'center',
          })}>
            {icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary"
              sx={{ letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
              {label}
            </Typography>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
              {value}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

function EmptyState({ tab }) {
  const msg = tab === 'pending'
    ? 'All caught up — no pending requests right now.'
    : tab === 'approved'
      ? 'No approved requests yet.'
      : 'No rejected requests.'
  return (
    <Card sx={{ borderRadius: 2 }}>
      <CardContent sx={{ py: 6, textAlign: 'center' }}>
        <InboxOutlinedIcon sx={{ fontSize: 44, color: 'text.disabled', mb: 1 }} />
        <Typography color="text.secondary">{msg}</Typography>
      </CardContent>
    </Card>
  )
}

function RequestCard({ row, bseName, onApprove, onReject, disabled }) {
  const pending = row.isApproved == null
  const tone = pending ? 'warning' : row.isApproved ? 'success' : 'error'
  const initials = (bseName || 'BSE').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()
  return (
    <Card sx={(t) => ({
      borderRadius: 2,
      borderLeft: `4px solid ${t.palette[tone].main}`,
      transition: 'box-shadow .15s, transform .15s',
      '&:hover': { boxShadow: 3 },
    })}>
      <CardContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}
          alignItems={{ sm: 'center' }}>
          <Avatar sx={(t) => ({
            bgcolor: alpha(t.palette[tone].main, 0.15),
            color: t.palette[tone].dark,
            fontWeight: 700, fontSize: '0.9rem',
          })}>
            {initials || <CalendarMonthOutlinedIcon fontSize="small" />}
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap">
              <Typography fontWeight={700} fontSize="0.95rem">
                {bseName || 'BSE'}
              </Typography>
              <Tooltip title="BSE recommendation id">
                <Mono sx={{ color: 'text.disabled', fontSize: '0.72rem' }}>
                  {shortId(row.bseRecommendationId)}
                </Mono>
              </Tooltip>
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5 }} flexWrap="wrap">
              <Chip size="small" variant="outlined" label={row.attendanceDate}
                sx={{ fontWeight: 600 }} />
              <Chip size="small" variant="outlined"
                icon={<AccessTimeIcon sx={{ fontSize: 14 }} />}
                label={`${short(row.inTime)} → ${short(row.outTime)}`}
                sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }} />
            </Stack>
            {row.reason && (
              <Typography variant="body2" color="text.secondary"
                sx={{ mt: 1, pl: 1, borderLeft: '2px solid', borderColor: 'divider', fontStyle: 'italic' }}>
                “{row.reason}”
              </Typography>
            )}
            {!pending && row.approvedDate && (
              <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" color="text.disabled">
                  {row.isApproved ? 'Approved' : 'Rejected'} on {formatDate(row.approvedDate)}
                </Typography>
              </>
            )}
          </Box>
          {pending ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <Button variant="outlined" color="error" size="small"
                startIcon={<CancelIcon />} onClick={onReject} disabled={disabled}
                sx={{ textTransform: 'none', fontWeight: 700 }}>
                Reject
              </Button>
              <Button variant="contained" color="success" size="small" disableElevation
                startIcon={<CheckCircleIcon />} onClick={onApprove} disabled={disabled}
                sx={{ textTransform: 'none', fontWeight: 700 }}>
                Approve
              </Button>
            </Stack>
          ) : (
            <Chip size="small"
              icon={row.isApproved ? <CheckCircleIcon /> : <CancelIcon />}
              color={row.isApproved ? 'success' : 'error'}
              label={row.isApproved ? 'Approved' : 'Rejected'}
              sx={{ fontWeight: 700 }} />
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────
function short(t) {
  if (!t) return '—'
  const s = String(t)
  return s.length >= 5 ? s.slice(0, 5) : s
}
function shortId(id) {
  if (!id) return ''
  const s = String(id)
  return s.length > 8 ? `#${s.slice(-8)}` : `#${s}`
}
function formatDate(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}
