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
import { DECISION, REVIEWER_ROLES } from '../../../../apis/stageActions'
import { downloadFile } from '../../../../apis/files'
import { decodeFilename } from '../../../../fileFieldLabels'
import { toFormValues as appraisalToFormValues } from '../../../../apis/industryAssociationAppraisals'
import { appraisalSchema } from '../../../../formSchemas'
import { useApproveIA, useFilesByRegistration } from '../../../../queries'

// AppraisalReviewView
// ────────────────────────────────────────────────────────────────────────
// Full L2 reviewer surface for a submitted appraisal. Same visual
// language as `SdeL1ReviewView` (hero + collapsible sections + docs
// sidebar + sticky decision bar + confirm dialog), retargeted at three
// audiences that hit this tab at different sub-stages:
//
//   • SIDBI_SDE  at DETAILED_APPRAISAL_SUBMITTED           → Approve L2 / Reject
//   • CLUSTER_EXPERT at DETAILED_APPRAISAL_APPROVAL_BY_SDE → Submit CE comments
//   • SIDBI_HO_MAKER at DETAILED_APPRAISAL_CE_COMMENTS_SUBMITTED → Approve / Reject
//
// Data source: the appraisal DTO. Values derive fresh from the DTO on
// every render, so background refetches surface immediately.
//
// Props
//   iaId        Registration id (used for docs list + approve mutation)
//   iaName      Display name of the IA (for the hero + confirm dialog)
//   appraisal   Raw appraisal DTO (from `useAppraisalByRegistration`)
//   viewerRole  Uppercase rawRole from useAuth — drives hero copy
//   decisions   [{ kind, to, label, stageId }] — from `decisionsForCurrent`
//   onDone      (result) => void — called after a decision is recorded
export default function AppraisalReviewView({
  iaId, iaName, appraisal, viewerRole, decisions = [], onDone,
}) {
  const theme = useTheme()
  const filesQ = useFilesByRegistration(iaId)
  const approve = useApproveIA()
  const [comments, setComments] = useState('')
  const [busyKind, setBusyKind] = useState(null)
  const [pendingDecision, setPendingDecision] = useState(null)
  const [justRecorded, setJustRecorded] = useState(null)

  // Values map is derived fresh from the appraisal DTO each render — the
  // reviewer surface is strictly read-only, so no editable state to
  // preserve. Background refetches will surface here immediately.
  const values = useMemo(() => appraisalToFormValues(appraisal || {}), [appraisal])

  const sections = appraisalSchema?.sections || []
  const [openSection, setOpenSection] = useState(() => sections[0]?.n ?? null)
  const toggleSection = (n) => setOpenSection((prev) => (prev === n ? null : n))

  const files = filesQ.data || []

  // Role-driven hero + remarks copy — every reviewer role hits this tab
  // with a different mental model, so speak to them plainly rather than
  // showing one generic "Awaiting decision" line.
  const roleCopy = useMemo(() => copyForRole(viewerRole), [viewerRole])

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
    if (d.kind === DECISION.COMMENT && !trimmed) {
      onDone?.({ severity: 'warning', msg: 'Please write your CE comments before submitting.' })
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
        // COMMENT (CE) is neither approval nor rejection — send false so
        // we don't accidentally toggle the sidbeApproved flag when the
        // CE only wanted to attach observations.
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
      <ReviewHero
        pillText={roleCopy.pill}
        title={iaName ? `${roleCopy.titlePrefix} ${iaName}` : roleCopy.titleFallback}
        submittedOn={appraisal?.updatedAt || appraisal?.createdAt}
        submittedBy={appraisal?.updatedBy || appraisal?.createdBy}
        filesCount={files.length}
      />

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
            <Typography sx={{ fontSize: 15.5, fontWeight: 700 }}>Detailed Appraisal (L2)</Typography>
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
                {roleCopy.remarksLabel}
              </Typography>
              <TextField
                value={comments}
                onChange={(e) => setComments(e.target.value.slice(0, 1000))}
                placeholder={roleCopy.remarksPlaceholder}
                fullWidth
                size="small"
                multiline
                minRows={1}
                maxRows={4}
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
                return (
                  <Button
                    key={d.kind + d.to}
                    onClick={() => requestDecision(d)}
                    disabled={disabled}
                    variant={buttonVariantFor(d.kind)}
                    color={buttonColorFor(d.kind)}
                    disableElevation
                    startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      minWidth: 148,
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

// ── Role-specific copy ──────────────────────────────────────────────────

function copyForRole(role) {
  switch (role) {
    case REVIEWER_ROLES.SIDBI_SDE:
      return {
        pill: 'Awaiting your L2 decision',
        titlePrefix: 'Review appraisal for',
        titleFallback: 'Review the L2 appraisal',
        remarksLabel: 'Approval remarks',
        remarksPlaceholder: 'Optional — required if rejecting',
      }
    case REVIEWER_ROLES.CLUSTER_EXPERT:
      return {
        pill: 'Cluster Expert review',
        titlePrefix: 'Add comments on',
        titleFallback: 'Add Cluster Expert comments',
        remarksLabel: 'Cluster Expert comments',
        remarksPlaceholder: 'Required — record your observations for the HO Maker',
      }
    case REVIEWER_ROLES.SIDBI_HO_MAKER:
      return {
        pill: 'Awaiting HO Maker sign-off',
        titlePrefix: 'Final review of',
        titleFallback: 'Final HO Maker sign-off',
        remarksLabel: 'HO Maker remarks',
        remarksPlaceholder: 'Optional — required if rejecting',
      }
    default:
      return {
        pill: 'Awaiting your decision',
        titlePrefix: 'Review',
        titleFallback: 'Review submission',
        remarksLabel: 'Remarks',
        remarksPlaceholder: 'Optional',
      }
  }
}

function buttonVariantFor(kind) {
  return kind === DECISION.APPROVE || kind === DECISION.COMMENT ? 'contained' : 'outlined'
}
function buttonColorFor(kind) {
  if (kind === DECISION.APPROVE) return 'success'
  if (kind === DECISION.REJECT) return 'error'
  if (kind === DECISION.COMMENT) return 'primary'
  return 'warning'
}

// ── Confirmation dialog ─────────────────────────────────────────────────

function ConfirmDecisionDialog({ pending, iaName, comments, busy, onCancel, onConfirm }) {
  const theme = useTheme()
  if (!pending) return null
  const kind = pending.kind
  const tone = toneFor(kind, theme)
  const title = confirmTitleFor(kind, iaName)
  const body = confirmBodyFor(kind)
  return (
    <Dialog open onClose={busy ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 13.5, color: theme.palette.text.secondary, mb: 1.5 }}>
          {body}
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
          color={buttonColorFor(kind)}
          disableElevation
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          {busy ? 'Recording…' : confirmActionFor(kind)}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function toneFor(kind, theme) {
  if (kind === DECISION.APPROVE) return theme.palette.success
  if (kind === DECISION.REJECT) return theme.palette.error
  if (kind === DECISION.COMMENT) return theme.palette.primary
  return theme.palette.warning
}

function confirmTitleFor(kind, iaName) {
  const suffix = iaName ? ` for ${iaName}?` : '?'
  if (kind === DECISION.APPROVE) return `Approve L2${suffix}`
  if (kind === DECISION.REJECT) return `Reject L2${suffix}`
  if (kind === DECISION.COMMENT) return `Submit CE comments${suffix}`
  return `Confirm decision${suffix}`
}

function confirmBodyFor(kind) {
  if (kind === DECISION.APPROVE) return 'This advances the workflow to the next reviewer. Recorded in the audit trail.'
  if (kind === DECISION.REJECT) return 'This rejects the L2 submission. The workflow terminates here — your remarks will be shown to GT.'
  if (kind === DECISION.COMMENT) return 'Your comments will be forwarded to the HO Maker for final decision.'
  return 'Recorded in the audit trail.'
}

function confirmActionFor(kind) {
  if (kind === DECISION.APPROVE) return 'Confirm approval'
  if (kind === DECISION.REJECT) return 'Confirm rejection'
  if (kind === DECISION.COMMENT) return 'Submit comments'
  return 'Confirm'
}

// ── Post-decision banner ────────────────────────────────────────────────

function RecordedBanner({ kind, label, comments }) {
  const theme = useTheme()
  const tone = toneFor(kind, theme)
  const title =
    kind === DECISION.APPROVE ? 'Approval recorded'
    : kind === DECISION.REJECT ? 'Rejection recorded'
    : kind === DECISION.COMMENT ? 'CE comments submitted'
    : 'Decision recorded'
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
            {title}
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

// ── Section list ────────────────────────────────────────────────────────

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
        .filter((r) => r && typeof r === 'object')
        .map((r) => Object.values(r).filter(Boolean).join(' · '))
        .join(' • ') || ''
    }
    return raw.join(', ')
  }
  if (f.type === 'yesno') return raw === 'yes' ? 'Yes' : raw === 'no' ? 'No' : ''
  if (f.type === 'select' || f.type === 'radio') {
    const opts = f.options || (typeof f.optionsFrom === 'function' ? f.optionsFrom({}) : [])
    const match = opts.find((o) => (o?.value ?? o) === raw)
    if (match) return match.label ?? match.value ?? String(match)
    return looksLikeOpaqueId(raw) ? '' : String(raw)
  }
  if (f.type === 'date') return formatDate(raw)
  return String(raw)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function looksLikeOpaqueId(raw) {
  const s = String(raw).trim()
  if (!s) return true
  if (/^\d+$/.test(s)) return true
  if (UUID_RE.test(s)) return true
  if (/-uuid$/i.test(s)) return true
  if (/^[a-z0-9]{16,}$/i.test(s) && !/\s/.test(s)) return true
  return false
}

function formatDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.valueOf())) return String(iso)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Hero + docs sidebar ─────────────────────────────────────────────────

function ReviewHero({ pillText, title, submittedBy, submittedOn, filesCount }) {
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
        {pillText}
      </Typography>
      <Typography sx={{ mt: 0.75, fontSize: { xs: 22, md: 26 }, fontWeight: 800, color: theme.palette.text.primary, letterSpacing: '-0.02em' }}>
        {title}
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
