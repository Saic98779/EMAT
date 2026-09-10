import { useMemo, useState } from 'react'
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, Divider, IconButton, Stack, TextField,
  Typography,
} from '@mui/material'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import { alpha, useTheme } from '@mui/material/styles'
import { DECISION } from '../../../../apis/stageActions'
import { downloadFile } from '../../../../apis/files'
import { decodeFilename } from '../../../../fileFieldLabels'
import { toFormValues as iaToFormValues } from '../../../../apis/industryAssociations'
import { useApproveIA, useFilesByRegistration } from '../../../../queries'

// SdeL1ReviewView
// ────────────────────────────────────────────────────────────────────────
// Full SDE review surface for a submitted L1 (In-Principle) application.
// Left: hero banner + collapsible sections listing every submitted field
// as label/value pairs (skipping subheadings / computed cells so the SDE
// scans a clean data view rather than a form).
// Right: docs sidebar — every file uploaded against this IA, each with a
// direct download.
// Bottom: sticky decision bar — remarks textarea + Approve / Reject /
// Send back to GT. Comments are required for Reject / Revert.
//
// Props
//   iaId        Registration id (needed for approve endpoint + file list)
//   iaName      Display name of the IA (used in the confirmation toast)
//   dto         Raw IA DTO — the reviewer view derives *fresh* form values
//               from this on every render, so React Query refetches
//               (background sync, cache invalidation) surface immediately.
//               NEVER pass the parent's mutable `values` state here — that
//               would freeze the reviewer's view at the seed snapshot.
//   schema      Same schema RegistrationTab builds — used to derive the
//               sections + fields to render. All fields treated read-only.
//   decisions   [{ kind, to, label, stageId }] — from `decisionsForCurrent`
//   onDone      (result) => void — called after a decision is recorded
export default function SdeL1ReviewView({
  iaId, iaName, dto, schema, decisions = [], onDone,
}) {
  const theme = useTheme()
  const filesQ = useFilesByRegistration(iaId)
  const approve = useApproveIA()
  const [comments, setComments] = useState('')
  const [busyKind, setBusyKind] = useState(null)
  // Two-step decision:
  //   pendingDecision → confirmation dialog is open, awaiting Confirm
  //   justRecorded    → last successful decision, shown inline as a
  //                     bold status card at the top of the view until the
  //                     workflow refetch flips the SDE out of reviewer mode
  const [pendingDecision, setPendingDecision] = useState(null)
  const [justRecorded, setJustRecorded] = useState(null)

  // Derive values fresh from `dto` each render — the reviewer surface is
  // read-only, so there's no editable state to preserve, and this keeps
  // the view in lock-step with the current persisted record.
  const values = useMemo(() => iaToFormValues(dto || {}), [dto])

  const sections = schema?.sections || []
  const [openSection, setOpenSection] = useState(() => sections[0]?.n ?? null)
  const toggleSection = (n) => setOpenSection((prev) => (prev === n ? null : n))

  const files = filesQ.data || []

  function requestDecision(d) {
    if (!iaId || !d?.stageId) {
      onDone?.({ severity: 'error', msg: 'Missing IA id or destination stage.' })
      return
    }
    const trimmed = comments.trim()
    if (d.kind === DECISION.REJECT && !trimmed) {
      onDone?.({ severity: 'warning', msg: 'Please add remarks explaining the rejection.' })
      return
    }
    setPendingDecision(d)
  }

  async function confirmDecision() {
    const d = pendingDecision
    if (!d) return
    setBusyKind(d.kind)
    try {
      await approve.mutateAsync({
        id: iaId,
        isSidbeApproved: d.kind === DECISION.APPROVE,
        stageId: d.stageId,
        stageComments: comments.trim() || undefined,
      })
      setJustRecorded({ kind: d.kind, label: d.label, comments: comments.trim() })
      setComments('')
      setPendingDecision(null)
      onDone?.({ severity: 'success', msg: `${d.label} · recorded.` })
    } catch (err) {
      onDone?.({ severity: 'error', msg: err?.message || 'Failed to record decision.' })
    } finally {
      setBusyKind(null)
    }
  }

  return (
    <>
      <ReviewHero iaName={iaName} submittedOn={dto?.updatedAt || dto?.createdAt} submittedBy={dto?.updatedBy || dto?.createdBy} filesCount={files.length} />

      {justRecorded && (
        <RecordedBanner
          kind={justRecorded.kind}
          label={justRecorded.label}
          comments={justRecorded.comments}
        />
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 300px' },
          columnGap: { xs: 3, md: 4 },
          rowGap: 3,
          alignItems: 'flex-start',
          mt: 3,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="baseline" spacing={1.5} sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: 15.5, fontWeight: 700 }}>Registration (L1) submission</Typography>
            <Typography sx={{ fontSize: 12.5, color: theme.palette.text.disabled }}>
              {sections.length} sections · read-only
            </Typography>
          </Stack>

          {sections.map((sec) => (
            <ReviewSection
              key={sec.n}
              section={sec}
              values={values}
              open={openSection === sec.n}
              onToggle={() => toggleSection(sec.n)}
            />
          ))}
        </Box>

        <DocsSidebar iaId={iaId} files={files} loading={filesQ.isLoading} />
      </Box>

      {!justRecorded && <Box sx={{ height: 112 }} />}

      {!justRecorded && (
      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          mt: 3,
          mx: { xs: -1, md: -1.5 },
          background: theme.palette.background.paper,
          borderTop: 1,
          borderColor: alpha(theme.palette.text.primary, 0.09),
          px: { xs: 2.5, md: 4 },
          py: 2.25,
          zIndex: 10,
          boxShadow: '0 -6px 20px rgba(0,0,0,0.06)',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={{ xs: 1.5, md: 3 }}
          alignItems={{ md: 'center' }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: theme.palette.text.disabled,
                mb: 0.5,
              }}
            >
              Approval remarks
            </Typography>
            <TextField
              value={comments}
              onChange={(e) => setComments(e.target.value.slice(0, 500))}
              placeholder="Optional — required if rejecting"
              fullWidth
              size="small"
              multiline
              minRows={1}
              maxRows={3}
              slotProps={{
                input: {
                  sx: {
                    borderRadius: 1.5,
                    background: alpha(theme.palette.text.primary, 0.025),
                    '& fieldset': { borderColor: alpha(theme.palette.text.primary, 0.12) },
                  },
                },
              }}
            />
          </Box>

          <Stack
            direction="row"
            spacing={1}
            sx={{ flexShrink: 0, alignSelf: { xs: 'flex-end', md: 'auto' } }}
          >
            {decisions.map((d) => {
              const busy = busyKind === d.kind
              const disabled = busyKind !== null
              const isApprove = d.kind === DECISION.APPROVE
              return (
                <Button
                  key={d.kind + d.to}
                  onClick={() => requestDecision(d)}
                  disabled={disabled}
                  variant={isApprove ? 'contained' : 'outlined'}
                  color={isApprove ? 'success' : 'error'}
                  disableElevation
                  startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    minWidth: 132,
                    py: 1,
                    borderRadius: 1.5,
                  }}
                >
                  {busy ? 'Recording…' : d.label}
                </Button>
              )
            })}
          </Stack>
        </Stack>
      </Box>
      )}

      <ConfirmDecisionDialog
        pending={pendingDecision}
        iaName={iaName}
        comments={comments}
        busy={busyKind !== null}
        onCancel={() => (busyKind === null ? setPendingDecision(null) : null)}
        onConfirm={confirmDecision}
      />
    </>
  )
}

// ── Confirmation dialog ─────────────────────────────────────────────────

function ConfirmDecisionDialog({ pending, iaName, comments, busy, onCancel, onConfirm }) {
  const theme = useTheme()
  if (!pending) return null
  const isApprove = pending.kind === DECISION.APPROVE
  const tone = isApprove ? theme.palette.success : theme.palette.error
  return (
    <Dialog open onClose={busy ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
        {isApprove ? `Approve L1 for ${iaName || 'this IA'}?` : `Reject L1 for ${iaName || 'this IA'}?`}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 13.5, color: theme.palette.text.secondary, mb: 1.5 }}>
          {isApprove
            ? 'This grants In-Principle Approval and unlocks Sustainability for GT. The decision will be recorded in the audit trail.'
            : 'This rejects the L1 submission. The workflow will end at this stage. Your remarks below will be shown to GT.'}
        </DialogContentText>
        {comments && (
          <Box
            sx={{
              border: 1,
              borderColor: alpha(tone.main, 0.35),
              background: alpha(tone.main, 0.06),
              borderRadius: 1.25,
              px: 1.5,
              py: 1,
            }}
          >
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: tone.dark, mb: 0.25 }}>
              Your remarks
            </Typography>
            <Typography sx={{ fontSize: 13, color: theme.palette.text.primary, whiteSpace: 'pre-wrap' }}>
              {comments}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={busy} color="inherit" sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={busy}
          variant="contained"
          color={isApprove ? 'success' : 'error'}
          disableElevation
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          {busy ? 'Recording…' : (isApprove ? 'Confirm approval' : 'Confirm rejection')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Post-decision banner (shows until workflow refetch flips the view) ──

function RecordedBanner({ kind, label, comments }) {
  const theme = useTheme()
  const isApprove = kind === DECISION.APPROVE
  const tone = isApprove ? theme.palette.success : theme.palette.error
  return (
    <Box
      sx={{
        mt: 2,
        borderRadius: 2,
        border: 1,
        borderColor: alpha(tone.main, 0.4),
        background: alpha(tone.main, 0.08),
        px: { xs: 3, md: 4 },
        py: { xs: 2.25, md: 2.75 },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <CheckCircleRoundedIcon sx={{ color: tone.dark, fontSize: 26 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: { xs: 17, md: 19 }, fontWeight: 800, color: tone.dark, letterSpacing: '-0.01em' }}>
            {isApprove ? 'L1 approval recorded' : 'L1 rejection recorded'}
          </Typography>
          <Typography sx={{ mt: 0.25, fontSize: 13, color: theme.palette.text.secondary }}>
            {label} · workflow refreshing…
          </Typography>
        </Box>
      </Stack>
      {comments && (
        <Typography sx={{ mt: 1.5, fontSize: 13, color: theme.palette.text.secondary, whiteSpace: 'pre-wrap' }}>
          Remarks: {comments}
        </Typography>
      )}
    </Box>
  )
}

// ── Section (collapsible field list) ────────────────────────────────────

function ReviewSection({ section, values, open, onToggle }) {
  const theme = useTheme()
  const rows = useMemo(() => buildRows(section, values), [section, values])
  if (rows.length === 0) return null
  return (
    <Box
      sx={{
        border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        borderRadius: 1.5,
        mb: 1,
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      <Box
        component="button"
        type="button"
        onClick={onToggle}
        sx={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          gap: 1.25,
          border: 0,
          background: 'transparent',
          fontFamily: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
          px: 2,
          py: 1.5,
        }}
      >
        <ExpandMoreRoundedIcon
          sx={{
            fontSize: 20,
            color: theme.palette.text.disabled,
            transform: open ? 'none' : 'rotate(-90deg)',
            transition: 'transform 120ms ease',
          }}
        />
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: theme.palette.text.primary }}>
          {section.title}
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: theme.palette.text.disabled, ml: 'auto' }}>
          {rows.length} {rows.length === 1 ? 'field' : 'fields'}
        </Typography>
      </Box>
      {open && (
        <>
          <Divider />
          <Box sx={{ px: 2, py: 2 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                columnGap: 3,
                rowGap: 1.75,
              }}
            >
              {rows.map((r) => (
                <FieldRow key={r.name} label={r.label} value={r.value} full={r.full} />
              ))}
            </Box>
          </Box>
        </>
      )}
    </Box>
  )
}

function FieldRow({ label, value, full }) {
  const theme = useTheme()
  const empty = value === '' || value == null
  return (
    <Box sx={{ gridColumn: full ? { md: '1 / -1' } : 'auto', minWidth: 0 }}>
      <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: theme.palette.text.disabled, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography
        sx={{
          mt: 0.25,
          fontSize: 13.5,
          color: empty ? theme.palette.text.disabled : theme.palette.text.primary,
          fontWeight: empty ? 400 : 500,
          wordBreak: 'break-word',
        }}
      >
        {empty ? '—' : value}
      </Typography>
    </Box>
  )
}

function buildRows(section, values) {
  const out = []
  for (const f of section.fields || []) {
    if (['subheading', 'computed', 'coordinates_capture', 'file'].includes(f.type)) continue
    if (typeof f.showIf === 'function' && !f.showIf(values)) continue
    const raw = values?.[f.name]
    out.push({
      name: f.name,
      label: (f.label || f.name).replace(/\s*\*\s*$/, ''),
      value: formatValue(f, raw),
      full: f.type === 'textarea' || f.type === 'repeater' || f.span === 12,
    })
  }
  return out
}

function formatValue(f, raw) {
  if (raw == null || raw === '') return ''
  if (Array.isArray(raw)) {
    if (raw.length === 0) return ''
    if (f.type === 'repeater') {
      return raw
        .filter((r) => r && (r.name || r.contact || r.email))
        .map((r) => [r.name, r.contact, r.email].filter(Boolean).join(' · '))
        .join(' • ') || ''
    }
    // Checkbox arrays — resolve each entry to its option label so
    // free-text options still render, and numeric-id options aren't
    // dropped by the opaque-id guard.
    if (f.type === 'checkboxes') {
      const opts = f.options || []
      const target = (v) => String(v)
      return raw
        .map((v) => {
          const hit = opts.map((o) => (o && typeof o === 'object' && 'value' in o ? o : { value: o, label: String(o) }))
            .find((o) => String(o.value) === target(v))
          return hit?.label ?? String(v)
        })
        .join(', ')
    }
    return raw.join(', ')
  }
  if (f.type === 'yesno') return raw === 'yes' ? 'Yes' : raw === 'no' ? 'No' : ''
  if (f.type === 'select' || f.type === 'radio') {
    // Backend list APIs return numeric ids that the DTO stores as
    // strings (e.g. `sde: "1"`, `sidbiBranch: "17"`), so coerce both
    // sides to string before matching. When the label lookup fails,
    // prefer showing the raw value over an em-dash — an unresolved
    // "1" is still more useful to the reviewer than "—". The
    // opaque-id filter only kicks in for truly opaque strings
    // (UUIDs / dev sentinels) so we don't leak DB internals.
    const opts = f.options || (typeof f.optionsFrom === 'function' ? f.optionsFrom({}) : [])
    const target = String(raw)
    const match = opts.find((o) => {
      const v = o && typeof o === 'object' && 'value' in o ? o.value : o
      return String(v) === target
    })
    if (match) return match.label ?? match.value ?? String(match)
    // Never resolved. Show the raw string unless it looks like a UUID
    // or dev sentinel — those we hide as they don't help the viewer.
    return looksLikeOpaqueId(raw) && !/^\d+$/.test(target) ? '' : target
  }
  if (f.type === 'date') return formatDate(raw)
  return String(raw)
}

// Guard for values that shouldn't be shown as-is when the label lookup
// fails — pure numeric ids, real UUIDs, and obvious "…-uuid" placeholders
// that snuck in via seed / test data.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function looksLikeOpaqueId(raw) {
  const s = String(raw).trim()
  if (!s) return true
  if (/^\d+$/.test(s)) return true
  if (UUID_RE.test(s)) return true
  if (/-uuid$/i.test(s)) return true            // dev sentinel like "some-branch-uuid"
  if (/^[a-z0-9]{16,}$/i.test(s) && !/\s/.test(s)) return true // long opaque token
  return false
}

function formatDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.valueOf())) return String(iso)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Hero + docs sidebar ─────────────────────────────────────────────────

function ReviewHero({ iaName, submittedBy, submittedOn, filesCount }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        mt: 2,
        borderRadius: 2,
        border: 1,
        borderColor: alpha(theme.palette.info.main, 0.35),
        background: alpha(theme.palette.info.main, 0.06),
        px: { xs: 3, md: 4 },
        py: { xs: 2.5, md: 3 },
      }}
    >
      <Typography sx={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.palette.info.dark }}>
        Awaiting your L1 decision
      </Typography>
      <Typography sx={{ mt: 0.75, fontSize: { xs: 22, md: 26 }, fontWeight: 800, color: theme.palette.text.primary, letterSpacing: '-0.02em' }}>
        {iaName ? `Review ${iaName}` : 'Review the L1 submission'}
      </Typography>
      <Stack direction="row" spacing={3} flexWrap="wrap" sx={{ mt: 1.5 }}>
        <Metric label="Filed by" value={submittedBy || '—'} />
        <Metric label="Received" value={submittedOn ? formatDate(submittedOn) : '—'} />
        <Metric label="Documents" value={`${filesCount} attached`} />
      </Stack>
    </Box>
  )
}

function Metric({ label, value }) {
  const theme = useTheme()
  return (
    <Box>
      <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.palette.text.disabled }}>
        {label}
      </Typography>
      <Typography sx={{ mt: 0.25, fontSize: 13.5, fontWeight: 600, color: theme.palette.text.primary }}>
        {value}
      </Typography>
    </Box>
  )
}

function DocsSidebar({ iaId, files, loading }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        position: { md: 'sticky' },
        top: { md: 96 },
        border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        borderRadius: 1.5,
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: alpha(theme.palette.text.primary, 0.06) }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.palette.text.secondary }}>
          Documents · {files.length}
        </Typography>
      </Box>
      {loading && files.length === 0 ? (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <CircularProgress size={18} />
        </Box>
      ) : files.length === 0 ? (
        <Typography sx={{ py: 3, textAlign: 'center', fontSize: 12.5, color: theme.palette.text.disabled }}>
          No files uploaded.
        </Typography>
      ) : (
        <Stack divider={<Divider />}>
          {files.map((f) => (
            <FileRow key={f.filename || f.name} iaId={iaId} file={f} />
          ))}
        </Stack>
      )}
    </Box>
  )
}

function FileRow({ iaId, file }) {
  const theme = useTheme()
  const filename = file.filename || file.name
  const decoded = decodeFilename(filename)
  const label = decoded.label || decoded.name
  const size = file.size ? formatSize(file.size) : ''
  const ext = (decoded.name.split('.').pop() || '').toUpperCase().slice(0, 4)
  const [busy, setBusy] = useState(false)

  async function onDownload() {
    setBusy(true)
    try { await downloadFile(iaId, filename) } finally { setBusy(false) }
  }

  return (
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2, py: 1.25 }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          background: alpha(theme.palette.primary.main, 0.09),
          color: theme.palette.primary.dark,
        }}
      >
        <InsertDriveFileRoundedIcon sx={{ fontSize: 18 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: 12.75,
            fontWeight: 600,
            color: theme.palette.text.primary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={label}
        >
          {label}
        </Typography>
        <Typography sx={{ fontSize: 11, color: theme.palette.text.disabled }}>
          {ext}{size ? ` · ${size}` : ''}
        </Typography>
      </Box>
      <IconButton size="small" onClick={onDownload} disabled={busy} aria-label={`Download ${label}`}>
        {busy ? <CircularProgress size={14} /> : <DownloadRoundedIcon fontSize="small" />}
      </IconButton>
    </Stack>
  )
}

function formatSize(bytes) {
  if (!bytes || bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
