import { memo, useMemo, useState } from 'react'
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

// Props
//   readOnly    — when true, drop the decision bar + remarks input. Used
//                 by the GT PMU "My Submissions" surface to reuse this
//                 same read-only render without the review affordances.
//   backTo      — route the "back" button navigates to (defaults to the
//                 checker queue).
//   overline    — overline text above the title (defaults to the content
//                 type's overline from config).
export default function CheckerReview({
  readOnly = false,
  backTo = '/checker',
  backLabel = 'Approval queue',
  overline: overlineProp,
  title: titleProp = 'Review submission',
  subtitle: subtitleProp = 'Read the entry below, then approve, revert, or reject with remarks.',
} = {}) {
  const navigate = useNavigate()
  const { type, id } = useParams()
  const cfg = CONTENT_REVIEW_TYPES[type]
  const recordQ = useContentRecord(type, id)
  const patchStatus = useUpdateContentStatus()

  const [remarks, setRemarks] = useState('')
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null) // { status, label, tone }
  const [remarksError, setRemarksError] = useState(false)

  if (!cfg) return <NotFound msg={`No review config for content type "${type}".`} backTo={backTo} />

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
    <Box sx={{ maxWidth: 1040, mx: 'auto', pb: readOnly ? 8 : 16 }}>
      <Button
        component={Link}
        to={backTo}
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 1, textTransform: 'none', color: 'text.secondary' }}
      >
        {backLabel}
      </Button>

      <PageHeader
        overline={overlineProp || cfg.overline}
        title={titleProp}
        subtitle={subtitleProp}
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
        <NotFound msg="Record not found." backTo={backTo} />
      )}

      {dto && !readOnly && (
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

// ─── Header ────────────────────────────────────────────────────────────
// Simple, quiet header: title + label + submitter meta + status pill.
// No color stripe, no oversized type — the record itself is the content.
const ReviewHero = memo(function ReviewHero({ dto, cfg }) {
  const theme = useTheme()
  const title = primaryTitle(dto, cfg)
  const currentStatus = dto?.status || null

  return (
    <Box
      sx={{
        mt: 2, borderRadius: 2, border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        bgcolor: '#fff',
        px: 3, py: 2.5,
      }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={2}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.palette.text.disabled }}>
            {cfg.label}
          </Typography>
          <Typography
            sx={{
              mt: 0.25, fontSize: 20, fontWeight: 700, letterSpacing: '-0.015em',
              color: theme.palette.text.primary, lineHeight: 1.25,
            }}
          >
            {title}
          </Typography>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 0.5 }}>
            <MetaBit label="Submitted by" value={dto.createdBy || 'Unknown'} />
            <MetaBit label="Submitted on" value={formatDateTime(dto.createdAt) || '—'} />
            {dto.status && dto.approvedDate && (
              <MetaBit label="Decision on" value={formatDate(dto.approvedDate)} />
            )}
          </Stack>
        </Box>
        <StatusPill status={currentStatus} />
      </Stack>
    </Box>
  )
})

function MetaBit({ label, value }) {
  const theme = useTheme()
  return (
    <Stack direction="row" spacing={0.75} alignItems="baseline">
      <Typography sx={{ fontSize: 11.5, color: theme.palette.text.disabled, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: theme.palette.text.primary }}>
        {value}
      </Typography>
    </Stack>
  )
}

// ─── Section card ──────────────────────────────────────────────────────
// Quiet card: title lives in a compact header row, no accent stripe.
// Memoized — the review page's remarks textbox re-renders the parent
// on every keystroke, and we don't want to walk the entire read-only
// tree each time.
const ReviewSection = memo(function ReviewSection({ title, fields, dto }) {
  const theme = useTheme()
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
          px: 3, py: 1.75,
          borderBottom: 1,
          borderColor: alpha(theme.palette.text.primary, 0.06),
        }}
      >
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.palette.text.disabled }}>
          {title}
        </Typography>
      </Box>
      <Box
        sx={{
          px: 3, py: 2.5,
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          columnGap: 3, rowGap: 2,
        }}
      >
        {visible.map((f) => (
          <FieldCell key={f.key} field={f} value={dto[f.key]} />
        ))}
      </Box>
    </Box>
  )
})

function FieldCell({ field, value }) {
  const theme = useTheme()
  const isFull = field.type === 'multiline' || field.type === 'questionnaire' || field.type === 'link' || field.full
  return (
    <Box
      sx={{
        gridColumn: {
          xs: 'span 12',
          sm: isFull ? 'span 12' : 'span 6',
        },
        minWidth: 0,
      }}
    >
      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.palette.text.disabled, mb: 0.5 }}>
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
      <Typography
        sx={{
          fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap',
          color: theme.palette.text.primary,
        }}
      >
        {String(value)}
      </Typography>
    )
  }

  if (field.type === 'chips') {
    const items = Array.isArray(value) ? value : String(value).split(',')
    return (
      <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
        {items.filter(Boolean).map((v) => (
          <Chip
            key={String(v)}
            label={String(v)}
            size="small"
            sx={{
              height: 22, fontSize: 12,
              bgcolor: alpha(theme.palette.text.primary, 0.05),
              color: theme.palette.text.primary,
              '.MuiChip-label': { px: 1 },
            }}
          />
        ))}
      </Stack>
    )
  }

  if (field.type === 'link') {
    const items = Array.isArray(value) ? value : [value]
    return (
      <Stack spacing={0.5}>
        {items.filter(Boolean).map((v, i) => (
          <Stack key={`${v}::${i}`} direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
            <LinkOutlinedIcon sx={{ fontSize: 14, color: theme.palette.text.disabled, flexShrink: 0 }} />
            <Box
              component="a"
              href={typeof v === 'string' ? v : '#'}
              target="_blank"
              rel="noreferrer"
              sx={{
                fontSize: 13.5, color: theme.palette.primary.main,
                wordBreak: 'break-all', textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
                minWidth: 0,
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
    return <Typography sx={{ fontSize: 13.5, color: theme.palette.text.primary }}>{formatDate(value)}</Typography>
  }
  if (field.type === 'datetime') {
    return <Typography sx={{ fontSize: 13.5, color: theme.palette.text.primary }}>{formatDateTime(value)}</Typography>
  }
  if (field.type === 'money') {
    return <Typography sx={{ fontSize: 13.5, color: theme.palette.text.primary }}>₹ {Number(value).toLocaleString('en-IN')}</Typography>
  }
  if (field.type === 'number') {
    return <Typography sx={{ fontSize: 13.5, color: theme.palette.text.primary }}>{Number(value).toLocaleString('en-IN')}</Typography>
  }
  if (field.type === 'yesNo') {
    const truthy = value === true || value === 'true'
    const isBool = truthy || value === false || value === 'false'
    return (
      <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: theme.palette.text.primary }}>
        {truthy ? 'Yes' : isBool ? 'No' : String(value)}
      </Typography>
    )
  }

  if (field.type === 'questionnaire') {
    const rows = Array.isArray(value) ? value : []
    return (
      <Stack spacing={1.5}>
        {rows.map((q, i) => (
          <Box key={q.id || i}>
            <Stack direction="row" alignItems="baseline" spacing={1}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.palette.text.disabled }}>
                Q{i + 1}
              </Typography>
              <Typography sx={{ fontSize: 10.5, color: theme.palette.text.disabled, textTransform: 'capitalize' }}>
                {(q.questionType || 'TEXT').replace('_', ' ').toLowerCase()}
              </Typography>
            </Stack>
            <Typography sx={{ mt: 0.25, fontSize: 13.5, fontWeight: 600, color: theme.palette.text.primary }}>
              {q.question || '—'}
            </Typography>
            {Array.isArray(q.options) && q.options.length > 0 && (
              <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5} sx={{ mt: 0.75 }}>
                {q.options.map((o, k) => (
                  <Chip
                    key={`${o}::${k}`}
                    label={o}
                    size="small"
                    sx={{
                      height: 20, fontSize: 11.5,
                      bgcolor: alpha(theme.palette.text.primary, 0.04),
                      color: theme.palette.text.secondary,
                      '.MuiChip-label': { px: 0.9 },
                    }}
                  />
                ))}
              </Stack>
            )}
          </Box>
        ))}
      </Stack>
    )
  }

  return <Typography sx={{ fontSize: 13.5, color: theme.palette.text.primary }}>{String(value)}</Typography>
}

// ─── Decision bar ──────────────────────────────────────────────────────
function DecisionBar({ currentStatus, remarks, setRemarks, remarksError, onDecide, busy }) {
  const theme = useTheme()
  return (
    <Paper
      elevation={0}
      sx={{
        position: 'fixed',
        bottom: 16,
        // Anchor inside the main content column so the bar doesn't slide
        // under the 288px sidebar. On mobile the drawer is hidden so we
        // just inset from both edges.
        left: { xs: 16, md: `${288 + 16}px` },
        right: 16,
        maxWidth: 1040,
        mx: { md: 'auto' },
        p: 2, borderRadius: 2,
        border: 1, borderColor: alpha(theme.palette.text.primary, 0.1),
        backdropFilter: 'blur(10px)',
        background: alpha(theme.palette.background.paper, 0.96),
        boxShadow: `0 8px 24px ${alpha(theme.palette.text.primary, 0.06)}`,
        zIndex: 10,
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
        <TextField
          size="small"
          fullWidth
          multiline
          minRows={1}
          maxRows={3}
          placeholder="Remarks — required to revert or reject"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          disabled={busy}
          error={remarksError}
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
      {(remarksError || currentStatus) && (
        <Typography
          sx={{
            mt: 0.75, fontSize: 11.5,
            color: remarksError ? theme.palette.error.main : theme.palette.text.disabled,
          }}
        >
          {remarksError
            ? 'Remarks are required to revert or reject.'
            : <>Currently <StatusPill status={currentStatus} inline /> — a new decision replaces the previous one.</>}
        </Typography>
      )}
    </Paper>
  )
}

// Tone-colored action button. Approve is contained (primary CTA);
// revert/reject are text-only in their tone so they read as secondary.
function ActionButton({ tone, icon, label, onClick, disabled, variant = 'text' }) {
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
        fontWeight: 600,
        px: 2, minWidth: 0,
        ...(isContained ? {
          bgcolor: color.main, color: '#fff',
          '&:hover': { bgcolor: color.dark },
        } : {
          color: color.dark,
          '&:hover': { bgcolor: alpha(color.main, 0.08) },
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
      <DialogTitle sx={{ pb: 1, fontSize: 17, fontWeight: 700 }}>
        {confirm.label} submission
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 13.5, color: 'text.secondary' }}>
          {body}
        </DialogContentText>
        {remarks?.trim() && (
          <Box
            sx={{
              mt: 2, p: 1.5, borderRadius: 1,
              border: 1, borderColor: alpha(theme.palette.text.primary, 0.09),
              bgcolor: alpha(theme.palette.text.primary, 0.02),
            }}
          >
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'text.disabled', mb: 0.5 }}>
              Your remarks
            </Typography>
            <Typography sx={{ fontSize: 13, whiteSpace: 'pre-wrap', color: 'text.primary' }}>{remarks.trim()}</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={busy} sx={{ textTransform: 'none', color: 'text.secondary' }}>
          Cancel
        </Button>
        <Button
          onClick={onOk}
          disabled={busy}
          disableElevation
          variant="contained"
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{
            textTransform: 'none', fontWeight: 600,
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

function NotFound({ msg, backTo = '/checker' }) {
  const navigate = useNavigate()
  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', mt: 4 }}>
      <Alert severity="warning" sx={{ mb: 2 }}>{msg}</Alert>
      <Button variant="outlined" onClick={() => navigate(backTo)} sx={{ textTransform: 'none' }}>
        Back
      </Button>
    </Box>
  )
}
