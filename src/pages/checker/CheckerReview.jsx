import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogContentText, DialogTitle, IconButton, Paper,
  Snackbar, Stack, TextField, Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CancelRoundedIcon from '@mui/icons-material/CancelRounded'
import UndoRoundedIcon from '@mui/icons-material/UndoRounded'
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import { PageHeader } from '../../components/shared'
import { useContentRecord, useUpdateContentStatus } from '../../queries'
import { CONTENT_STATUS } from '../../apis/contentStatus'
import { CONTENT_REVIEW_TYPES } from './contentReviewConfig'

// CheckerReview
// ────────────────────────────────────────────────────────────────────────
// Read-only render of one content record + sticky decision bar with
// three explicit actions:
//
//   Approve — publishes the content (green primary CTA)
//   Revert  — sends back to GT PMU for changes (warning tone). Remarks
//             REQUIRED — the submitter can't fix without context.
//   Reject  — final rejection (error tone). Remarks REQUIRED for the
//             audit trail.
//
// Config-driven: the same shell renders all 9 DIA content types.

export default function CheckerReview() {
  const navigate = useNavigate()
  const { type, id } = useParams()
  const cfg = CONTENT_REVIEW_TYPES[type]
  const recordQ = useContentRecord(type, id)
  const patchStatus = useUpdateContentStatus()

  const [remarks, setRemarks] = useState('')
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null) // { status, label, tone }
  const [remarksError, setRemarksError] = useState(false)

  if (!cfg) return <NotFound msg={`No review config for content type "${type}".`} />

  const dto = recordQ.data
  const currentStatus = dto?.status || null

  const requestDecide = (status) => {
    // Remarks are mandatory for revert + reject.
    const needsRemarks = status === CONTENT_STATUS.REVERT || status === CONTENT_STATUS.REJECT
    if (needsRemarks && !remarks.trim()) {
      setRemarksError(true)
      setToast({
        severity: 'warning',
        msg: status === CONTENT_STATUS.REVERT
          ? 'Add remarks so the submitter knows what to change.'
          : 'Add remarks explaining the rejection.',
      })
      return
    }
    setRemarksError(false)
    setConfirm({
      status,
      label: statusVisuals(status, null).label,
      tone: statusToneKey(status),
    })
  }

  const commitDecide = async () => {
    if (!confirm || !id) return
    try {
      await patchStatus.mutateAsync({
        path: type,
        id,
        status: confirm.status,
        remarks: remarks.trim() || undefined,
      })
      setToast({ severity: 'success', msg: `${confirm.label} · saved.` })
      setRemarks('')
      setConfirm(null)
    } catch (err) {
      setToast({ severity: 'error', msg: err.message || 'Failed to update status.' })
      setConfirm(null)
    }
  }

  return (
    <Box sx={{ maxWidth: 1040, mx: 'auto', pb: 16 }}>
      <Button
        component={Link}
        to="/checker"
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 1, textTransform: 'none', color: 'text.secondary' }}
      >
        Approval queue
      </Button>

      <PageHeader
        overline={cfg.overline}
        title="Review submission"
        subtitle="Read the entry below, then approve, revert, or reject with remarks."
      />

      {recordQ.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : recordQ.error ? (
        <Alert severity="error">{recordQ.error.message || 'Failed to load record.'}</Alert>
      ) : dto ? (
        <>
          <ReviewHero dto={dto} cfg={cfg} />
          <Stack spacing={2.5} sx={{ mt: 3 }}>
            {cfg.sections.map((sec) => (
              <ReviewSection key={sec.title} title={sec.title} fields={sec.fields} dto={dto} />
            ))}
          </Stack>
        </>
      ) : (
        <NotFound msg="Record not found." />
      )}

      {dto && (
        <DecisionBar
          currentStatus={currentStatus}
          remarks={remarks}
          setRemarks={(v) => { setRemarks(v); if (v.trim()) setRemarksError(false) }}
          remarksError={remarksError}
          onDecide={requestDecide}
          busy={patchStatus.isPending}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        confirm={confirm}
        remarks={remarks}
        busy={patchStatus.isPending}
        onCancel={() => setConfirm(null)}
        onOk={commitDecide}
      />

      <Snackbar
        open={!!toast}
        autoHideDuration={3600}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert severity={toast.severity} variant="filled" onClose={() => setToast(null)}>
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  )
}

// ─── Hero ──────────────────────────────────────────────────────────────
// Big header showing what we're reviewing + who submitted + status.
function ReviewHero({ dto, cfg }) {
  const theme = useTheme()
  const title = primaryTitle(dto, cfg)
  const currentStatus = dto?.status || null
  const stripe = statusVisuals(currentStatus, theme).color

  return (
    <Box
      sx={{
        mt: 2, borderRadius: 2.5, border: 1, borderColor: alpha(theme.palette.text.primary, 0.09),
        overflow: 'hidden', bgcolor: '#fff', position: 'relative',
      }}
    >
      <Box
        sx={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          bgcolor: stripe.main,
        }}
      />
      <Box sx={{ px: 3, py: 2.75 }}>
        <Stack direction="row" alignItems="flex-start" spacing={2}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.palette.text.disabled }}>
              {cfg.label}
            </Typography>
            <Typography
              sx={{
                mt: 0.5, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em',
                color: theme.palette.text.primary, lineHeight: 1.2,
              }}
            >
              {title}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={2.5} sx={{ mt: 1.5, flexWrap: 'wrap', rowGap: 0.5 }}>
              <MetaBit
                icon={<PersonRoundedIcon sx={{ fontSize: 15 }} />}
                label="Submitted by"
                value={dto.createdBy || 'Unknown'}
              />
              <MetaBit
                icon={<ScheduleRoundedIcon sx={{ fontSize: 15 }} />}
                label="Submitted on"
                value={formatDateTime(dto.createdAt) || '—'}
              />
              {dto.status && dto.approvedDate && (
                <MetaBit
                  icon={<CheckCircleRoundedIcon sx={{ fontSize: 15, color: theme.palette.success.main }} />}
                  label="Decision"
                  value={formatDate(dto.approvedDate)}
                />
              )}
            </Stack>
          </Box>
          <StatusPill status={currentStatus} big />
        </Stack>
      </Box>
    </Box>
  )
}

function MetaBit({ icon, label, value }) {
  const theme = useTheme()
  return (
    <Stack direction="row" alignItems="center" spacing={0.75}>
      <Box sx={{ color: theme.palette.text.disabled }}>{icon}</Box>
      <Typography sx={{ fontSize: 12, color: theme.palette.text.disabled }}>{label}</Typography>
      <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: theme.palette.text.primary }}>{value}</Typography>
    </Stack>
  )
}

// ─── Section card ──────────────────────────────────────────────────────
function ReviewSection({ title, fields, dto }) {
  const theme = useTheme()
  // Skip sections whose fields are all empty — reduces noise on partial
  // records (e.g. Audit before an approval date exists).
  const visible = useMemo(
    () => fields.filter((f) => valueLooksMeaningful(dto[f.key])),
    [fields, dto],
  )
  if (visible.length === 0) return null

  return (
    <Box
      sx={{
        border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        borderRadius: 2,
        bgcolor: '#fff',
      }}
    >
      <Box
        sx={{
          px: 2.75, py: 1.5,
          borderBottom: 1,
          borderColor: alpha(theme.palette.text.primary, 0.06),
        }}
      >
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.palette.text.secondary }}>
          {title}
        </Typography>
      </Box>
      <Box
        sx={{
          px: 2.75, py: 2.25,
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          columnGap: 3, rowGap: 2.5,
        }}
      >
        {visible.map((f) => (
          <FieldCell key={f.key} field={f} value={dto[f.key]} />
        ))}
      </Box>
    </Box>
  )
}

function FieldCell({ field, value }) {
  const theme = useTheme()
  const isFull = field.type === 'multiline' || field.type === 'questionnaire' || field.type === 'link' || field.full
  const span = isFull ? 12 : 6
  return (
    <Box sx={{ gridColumn: `span ${span}`, minWidth: 0 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.palette.text.disabled, mb: 0.75 }}>
        {field.label}
      </Typography>
      {renderValue(field, value, theme)}
    </Box>
  )
}

function renderValue(field, value, theme) {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) {
    return <Typography sx={{ fontSize: 13.5, color: theme.palette.text.disabled }}>—</Typography>
  }

  if (field.type === 'multiline') {
    return (
      <Box
        sx={{
          fontSize: 13.75, lineHeight: 1.55, whiteSpace: 'pre-wrap',
          color: theme.palette.text.primary,
          borderLeft: 3, borderColor: alpha(theme.palette.primary.main, 0.28),
          pl: 1.75, py: 0.25,
        }}
      >
        {String(value)}
      </Box>
    )
  }

  if (field.type === 'chips') {
    const items = Array.isArray(value) ? value : String(value).split(',')
    return (
      <Stack direction="row" spacing={0.75} flexWrap="wrap" gap={0.5}>
        {items.filter(Boolean).map((v) => (
          <Chip
            key={String(v)}
            label={String(v)}
            size="small"
            sx={{
              fontWeight: 600, fontSize: 12,
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              color: theme.palette.primary.dark,
            }}
          />
        ))}
      </Stack>
    )
  }

  if (field.type === 'link') {
    const items = Array.isArray(value) ? value : [value]
    return (
      <Stack spacing={0.75}>
        {items.filter(Boolean).map((v, i) => (
          <Stack
            key={`${v}::${i}`}
            direction="row"
            alignItems="center"
            spacing={0.75}
            sx={{
              border: 1, borderColor: alpha(theme.palette.text.primary, 0.1),
              borderRadius: 1, px: 1.25, py: 0.75,
              bgcolor: alpha(theme.palette.text.primary, 0.02),
            }}
          >
            <LinkOutlinedIcon sx={{ fontSize: 15, color: theme.palette.primary.main }} />
            <Box
              component="a"
              href={typeof v === 'string' ? v : '#'}
              target="_blank"
              rel="noreferrer"
              sx={{
                fontSize: 13, color: theme.palette.primary.main,
                wordBreak: 'break-all', textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
                minWidth: 0, flex: 1,
              }}
            >
              {String(v)}
            </Box>
          </Stack>
        ))}
      </Stack>
    )
  }

  if (field.type === 'date') {
    return <Typography sx={{ fontSize: 13.75 }}>{formatDate(value)}</Typography>
  }
  if (field.type === 'datetime') {
    return <Typography sx={{ fontSize: 13.75 }}>{formatDateTime(value)}</Typography>
  }
  if (field.type === 'money') {
    return <Typography sx={{ fontSize: 13.75 }}>₹ {Number(value).toLocaleString('en-IN')}</Typography>
  }
  if (field.type === 'number') {
    return <Typography sx={{ fontSize: 13.75 }}>{Number(value).toLocaleString('en-IN')}</Typography>
  }
  if (field.type === 'yesNo') {
    const truthy = value === true || value === 'true'
    return (
      <Chip
        size="small"
        label={truthy ? 'Yes' : value === false || value === 'false' ? 'No' : String(value)}
        sx={{
          fontWeight: 700,
          bgcolor: truthy ? alpha(theme.palette.success.main, 0.12) : alpha(theme.palette.text.primary, 0.06),
          color: truthy ? theme.palette.success.dark : theme.palette.text.secondary,
        }}
      />
    )
  }

  if (field.type === 'questionnaire') {
    const rows = Array.isArray(value) ? value : []
    return (
      <Stack spacing={1.25}>
        {rows.map((q, i) => (
          <Box
            key={q.id || i}
            sx={{
              border: 1, borderColor: alpha(theme.palette.text.primary, 0.09),
              borderRadius: 1.5, px: 1.75, py: 1.5,
              bgcolor: alpha(theme.palette.text.primary, 0.015),
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box
                sx={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                  color: theme.palette.text.disabled,
                  border: 1, borderColor: alpha(theme.palette.text.primary, 0.18),
                  borderRadius: 999, px: 1, py: 0.25,
                }}
              >
                Q{i + 1}
              </Box>
              <Chip
                size="small"
                label={(q.questionType || 'TEXT').replace('_', ' ').toLowerCase()}
                sx={{ height: 18, fontSize: 10.5, textTransform: 'capitalize' }}
              />
            </Stack>
            <Typography sx={{ mt: 0.75, fontSize: 13.75, fontWeight: 600 }}>
              {q.question || '—'}
            </Typography>
            {Array.isArray(q.options) && q.options.length > 0 && (
              <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
                {q.options.map((o, k) => (
                  <Chip
                    key={`${o}::${k}`}
                    label={o}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: 12 }}
                  />
                ))}
              </Stack>
            )}
          </Box>
        ))}
      </Stack>
    )
  }

  return <Typography sx={{ fontSize: 13.75 }}>{String(value)}</Typography>
}

// ─── Decision bar ──────────────────────────────────────────────────────
function DecisionBar({ currentStatus, remarks, setRemarks, remarksError, onDecide, busy }) {
  const theme = useTheme()
  return (
    <Paper
      elevation={0}
      sx={{
        position: 'fixed',
        left: '50%',
        bottom: 16,
        transform: 'translateX(-50%)',
        width: 'min(100% - 32px, 1040px)',
        p: 2, borderRadius: 3,
        border: 1, borderColor: alpha(theme.palette.text.primary, 0.08),
        backdropFilter: 'blur(12px)',
        background: alpha(theme.palette.background.paper, 0.94),
        boxShadow: `0 10px 40px ${alpha(theme.palette.text.primary, 0.08)}`,
        zIndex: 10,
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'stretch' }}>
        <TextField
          size="small"
          fullWidth
          multiline
          minRows={1}
          maxRows={3}
          label="Remarks (required for Revert / Reject)"
          placeholder="Explain what needs to change, or why this is rejected"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          disabled={busy}
          error={remarksError}
          helperText={remarksError ? 'Remarks are required for this decision.' : ' '}
        />
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          <ActionButton
            tone="warning"
            icon={<UndoRoundedIcon />}
            label="Revert"
            onClick={() => onDecide(CONTENT_STATUS.REVERT)}
            disabled={busy}
          />
          <ActionButton
            tone="error"
            icon={<CancelRoundedIcon />}
            label="Reject"
            onClick={() => onDecide(CONTENT_STATUS.REJECT)}
            disabled={busy}
          />
          <ActionButton
            tone="success"
            variant="contained"
            icon={busy ? <CircularProgress size={16} color="inherit" /> : <CheckCircleRoundedIcon />}
            label="Approve"
            onClick={() => onDecide(CONTENT_STATUS.APPROVED)}
            disabled={busy}
          />
        </Stack>
      </Stack>
      {currentStatus && (
        <Typography sx={{ mt: 1, fontSize: 12, color: theme.palette.text.disabled }}>
          Currently <StatusPill status={currentStatus} inline /> — a new decision replaces the previous one.
        </Typography>
      )}
    </Paper>
  )
}

// Tone-colored action button. Approve is contained-primary; revert/reject
// are outlined in their color for visual distinction.
function ActionButton({ tone, icon, label, onClick, disabled, variant = 'outlined' }) {
  const theme = useTheme()
  const color = theme.palette[tone] || theme.palette.primary
  const isContained = variant === 'contained'
  return (
    <Button
      variant={variant}
      disableElevation
      startIcon={icon}
      onClick={onClick}
      disabled={disabled}
      sx={{
        textTransform: 'none',
        fontWeight: 700,
        px: 2.25,
        minWidth: 0,
        ...(isContained ? {
          bgcolor: color.main, color: '#fff',
          '&:hover': { bgcolor: color.dark },
        } : {
          borderColor: alpha(color.main, 0.55),
          color: color.dark,
          '&:hover': {
            bgcolor: alpha(color.main, 0.06),
            borderColor: color.main,
          },
        }),
      }}
    >
      {label}
    </Button>
  )
}

// ─── Confirm dialog ────────────────────────────────────────────────────
function ConfirmDialog({ open, confirm, remarks, busy, onCancel, onOk }) {
  const theme = useTheme()
  if (!confirm) return null
  const color = theme.palette[confirm.tone] || theme.palette.primary
  const body = confirm.status === CONTENT_STATUS.APPROVED
    ? 'This publishes the submission and notifies GT PMU.'
    : confirm.status === CONTENT_STATUS.REVERT
      ? 'This sends the submission back to GT PMU with your remarks so they can fix and resubmit.'
      : 'This rejects the submission permanently.'

  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box
            sx={{
              width: 26, height: 26, borderRadius: '50%',
              display: 'grid', placeItems: 'center',
              bgcolor: alpha(color.main, 0.14),
              color: color.dark,
            }}
          >
            {confirm.status === CONTENT_STATUS.APPROVED
              ? <CheckCircleRoundedIcon sx={{ fontSize: 16 }} />
              : confirm.status === CONTENT_STATUS.REVERT
                ? <UndoRoundedIcon sx={{ fontSize: 16 }} />
                : <CancelRoundedIcon sx={{ fontSize: 16 }} />}
          </Box>
          <Typography sx={{ fontSize: 17, fontWeight: 700 }}>{confirm.label} submission</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 13.5, mb: remarks ? 1.5 : 0 }}>
          {body}
        </DialogContentText>
        {remarks?.trim() && (
          <Box
            sx={{
              mt: 1, p: 1.25, borderRadius: 1,
              bgcolor: alpha(theme.palette.text.primary, 0.03),
              border: 1, borderColor: alpha(theme.palette.text.primary, 0.09),
            }}
          >
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'text.disabled', mb: 0.5 }}>
              Your remarks
            </Typography>
            <Typography sx={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{remarks.trim()}</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={busy} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button
          onClick={onOk}
          disabled={busy}
          disableElevation
          variant="contained"
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{
            textTransform: 'none', fontWeight: 700,
            bgcolor: color.main,
            '&:hover': { bgcolor: color.dark },
          }}
        >
          {busy ? 'Saving…' : `Confirm ${confirm.label.toLowerCase()}`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Status pill (exported for the queue) ───────────────────────────────
export function StatusPill({ status, inline = false, big = false }) {
  const theme = useTheme()
  const { label, color } = statusVisuals(status, theme)
  return (
    <Chip
      size={big ? 'medium' : 'small'}
      label={label}
      sx={{
        bgcolor: alpha(color.main, 0.14),
        color: color.dark,
        fontWeight: 700,
        letterSpacing: '0.02em',
        ...(big ? { fontSize: 12.5, height: 26, '.MuiChip-label': { px: 1.25 } } : {}),
        ...(inline ? { mx: 0.5, verticalAlign: 'middle' } : {}),
      }}
    />
  )
}

function statusVisuals(status, theme) {
  // theme may be null when called during initial render to just derive
  // the label (see requestDecide). Use a safe access pattern.
  const t = theme || { palette: { success: {}, error: {}, warning: {}, info: {} } }
  switch (status) {
    case 'APPROVED': return { label: 'Approved', color: t.palette.success }
    case 'REJECT':   return { label: 'Rejected', color: t.palette.error }
    case 'REVERT':   return { label: 'Reverted', color: t.palette.warning }
    default:         return { label: 'Pending',  color: t.palette.info }
  }
}

function statusToneKey(status) {
  switch (status) {
    case 'APPROVED': return 'success'
    case 'REJECT':   return 'error'
    case 'REVERT':   return 'warning'
    default:         return 'info'
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────
function primaryTitle(dto, cfg) {
  const c = cfg.columns?.[0]
  if (c && dto[c.key]) return String(dto[c.key])
  return cfg.label
}

function formatDate(v) {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(v) {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function valueLooksMeaningful(v) {
  if (v == null || v === '') return false
  if (Array.isArray(v) && v.length === 0) return false
  return true
}

function NotFound({ msg }) {
  const navigate = useNavigate()
  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', mt: 4 }}>
      <Alert severity="warning" sx={{ mb: 2 }}>{msg}</Alert>
      <Button variant="outlined" onClick={() => navigate('/checker')} sx={{ textTransform: 'none' }}>
        Back to queue
      </Button>
    </Box>
  )
}
