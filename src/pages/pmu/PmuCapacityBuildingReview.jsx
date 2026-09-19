import { useMemo, useState } from 'react'
import {
  Box, Card, Table, TableHead, TableBody, TableRow, TableCell, Typography,
  Button, Alert, CircularProgress, TextField, InputAdornment, Chip, Collapse,
  IconButton, Stack, Grid, Paper, Snackbar,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import SaveIcon from '@mui/icons-material/Save'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { PageHeader } from '../../components/shared'
import {
  useCapacityBuildingOfficials, useUpdateCapacityBuildingOfficials,
} from '../../queries'
import { toFormValues, stageOf } from '../../apis/disbursementCapacityBuildingOfficials'

// GT PMU — capacity building (IA officials) event review queue.
// PMU's job on one of these notes is row 12 of the format: comments on how the
// event was organised and what it achieved. Nothing else on the note is
// theirs to edit.
export default function PmuCapacityBuildingReview() {
  const { data: rows = [], isLoading, isFetching, error, refetch } = useCapacityBuildingOfficials()
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())
  const [toast, setToast] = useState(null)

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((r) =>
      [r.invoiceNumber, r.eventManagementAgencyName, r.registrationName, r.natureOfPayment]
        .some((f) => (f || '').toLowerCase().includes(term)))
  }, [rows, q])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const da = a.invoiceDate || ''; const db = b.invoiceDate || ''
    return db.localeCompare(da)
  }), [filtered])

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const initialLoading = isLoading && rows.length === 0
  const refetching = isFetching && rows.length > 0

  return (
    <Box>
      <PageHeader
        title="Capacity Building (IA Officials) — Event Review"
        subtitle={initialLoading ? 'Loading…'
          : `${sorted.length} disbursement note${sorted.length === 1 ? '' : 's'} to comment on`}
        action={
          <Button variant="outlined"
            startIcon={refetching ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={() => refetch()} disabled={isLoading}>
            {refetching ? 'Refreshing…' : 'Refresh'}
          </Button>}
      />

      <TextField
        size="small" placeholder="Search agency, IA, invoice…" value={q}
        onChange={(e) => setQ(e.target.value)}
        sx={{ mb: 2, maxWidth: 380 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => refetch()}>Retry</Button>}>
          {error.message || 'Failed to load capacity building notes'}
        </Alert>
      )}

      {initialLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ overflow: 'hidden' }}>
          <Table sx={{
            '& thead th': {
              bgcolor: 'grey.50', color: 'text.secondary',
              fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', py: 1.25,
              borderBottom: '1px solid', borderColor: 'divider',
            },
            '& tbody td': { py: 1.5 },
          }}>
            <TableHead>
              <TableRow>
                <TableCell width={48} />
                <TableCell>Event Management Agency</TableCell>
                <TableCell>Invoice</TableCell>
                <TableCell align="right" width={140}>Total (₹)</TableCell>
                <TableCell width={160}>Stage</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">
                      {q ? `No notes match “${q}”.` : 'No notes awaiting your comments.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {sorted.map((r) => (
                <RowGroup
                  key={r.id}
                  dto={r}
                  isOpen={expanded.has(r.id)}
                  onToggle={() => toggle(r.id)}
                  onDone={(msg) => setToast(msg)}
                />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {toast && <Alert severity={toast.kind} variant="filled" onClose={() => setToast(null)}>{toast.msg}</Alert>}
      </Snackbar>
    </Box>
  )
}

function RowGroup({ dto, isOpen, onToggle, onDone }) {
  const stage = stageOf(dto)
  return (
    <>
      <TableRow hover onClick={onToggle}
        sx={{
          cursor: 'pointer',
          '& td': { borderBottom: isOpen ? 'none' : undefined },
          bgcolor: isOpen ? 'action.hover' : 'transparent',
        }}>
        <TableCell>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggle() }}>
            {isOpen ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography fontWeight={700} fontSize="0.95rem">{dto.eventManagementAgencyName || '—'}</Typography>
          <Typography variant="caption" color="text.secondary">{dto.registrationName || dto.gstinOfAgency || '—'}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{dto.invoiceNumber || '—'}</Typography>
          <Typography variant="caption" color="text.secondary">{formatDate(dto.invoiceDate)}</Typography>
        </TableCell>
        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
          {formatMoney(dto.totalAmount)}
        </TableCell>
        <TableCell>
          <StageChip stage={stage} />
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={5} sx={{ p: 0, border: 0, bgcolor: 'grey.50' }}>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <ReviewPanel dto={dto} onDone={onDone} />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

function ReviewPanel({ dto, onDone }) {
  const initial = useMemo(() => toFormValues(dto), [dto])
  const [comments, setComments] = useState(initial.gtCommentsOnEventOutcomeImpact || '')
  const update = useUpdateCapacityBuildingOfficials()

  const dirty = (comments || '') !== (initial.gtCommentsOnEventOutcomeImpact || '')
  const canSave = dirty && !!comments.trim()

  const save = async () => {
    try {
      await update.mutateAsync({
        id: dto.id,
        values: { ...initial, gtCommentsOnEventOutcomeImpact: comments },
      })
      onDone?.({ kind: 'success', msg: 'Event comments saved.' })
    } catch (e) {
      onDone?.({ kind: 'error', msg: e?.message || 'Failed to save comments.' })
    }
  }

  return (
    <Box sx={{ p: 2.5 }}>
      <Stack spacing={2}>
        <SubCard title="Invoice & Grant">
          <Grid container spacing={2.5}>
            <Snippet label="Invoice Date" value={formatDate(dto.invoiceDate)} />
            <Snippet label="Invoice Number" value={dto.invoiceNumber} mono />
            <Snippet label="Value of Service" value={formatMoney(dto.valueOfServiceItemsSupplied)} prefix="₹" />
            <Snippet label="IGST @18%" value={formatMoney(dto.igstAt18Percent)} prefix="₹" />
            <Snippet label="Total" value={formatMoney(dto.totalAmount)} prefix="₹" strong />
            <Snippet label="Sanctioned" value={formatMoney(dto.sanctionedAmount)} prefix="₹" />
            <Snippet label="Disbursed till Date" value={formatMoney(dto.disbursedTillDate)} prefix="₹" />
            <Snippet label="Compliance" value={dto.compliancePreDisbursementTerms} span={{ xs: 12, md: 12, lg: 8 }} />
          </Grid>
        </SubCard>

        <SubCard title="Nature of Payment">
          {dto.natureOfPayment
            ? <Typography sx={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{dto.natureOfPayment}</Typography>
            : <Typography variant="body2" color="text.disabled">Not recorded.</Typography>}
        </SubCard>

        <SubCard title="GT PMU — Event Organisation, Outcome & Impact" accent="primary">
          <TextField
            fullWidth multiline minRows={4} size="small"
            label="Comments on event organisation and its outcome and impact"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="How the event was organised, attendance, quality of delivery, outcomes observed, impact on IA members…"
          />
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2 }}>
            {initial.gtCommentsOnEventOutcomeImpact && !dirty && (
              <Chip icon={<CheckCircleOutlineIcon />} size="small" color="success" variant="outlined"
                label="Saved" sx={{ fontWeight: 600 }} />
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant="contained"
              startIcon={update.isPending ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              disabled={!canSave || update.isPending}
              onClick={save}
            >
              {update.isPending ? 'Saving…' : 'Save Comments'}
            </Button>
          </Stack>
        </SubCard>
      </Stack>
    </Box>
  )
}

// ── Building blocks ────────────────────────────────────────────────────────

function SubCard({ title, accent, children }) {
  return (
    <Paper variant="outlined" sx={{
      p: 2,
      borderColor: accent === 'primary' ? 'primary.light' : 'divider',
      bgcolor: 'background.paper', borderRadius: 1.5,
    }}>
      <Typography variant="overline" sx={{
        display: 'block', mb: 1.5,
        color: accent === 'primary' ? 'primary.dark' : 'text.secondary',
        fontWeight: 700, letterSpacing: '0.1em',
      }}>{title}</Typography>
      {children}
    </Paper>
  )
}

function Snippet({ label, value, prefix, mono, strong, span }) {
  const isEmpty = value == null || value === ''
  return (
    <Grid size={span ?? { xs: 12, sm: 6, md: 4, lg: 2 }}>
      <Typography variant="caption" color="text.secondary"
        sx={{ display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.68rem', fontWeight: 600, mb: 0.5 }}>
        {label}
      </Typography>
      <Typography sx={{
        fontWeight: strong ? 700 : 500,
        fontSize: strong ? '0.95rem' : '0.88rem',
        color: isEmpty ? 'text.disabled' : 'text.primary',
        fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' : undefined,
        fontVariantNumeric: 'tabular-nums', wordBreak: 'break-word',
      }}>
        {prefix && !isEmpty && <Box component="span" sx={{ color: 'text.secondary', mr: 0.5 }}>{prefix}</Box>}
        {isEmpty ? '—' : value}
      </Typography>
    </Grid>
  )
}

function StageChip({ stage }) {
  const color = stage === 'Recommended' ? 'success'
    : stage === 'Not Recommended' ? 'error'
    : stage === 'PMU Commented' ? 'info'
    : 'warning'
  return <Chip size="small" color={color} label={stage} sx={{ fontWeight: 700 }} />
}

function formatMoney(v) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-IN') : String(v)
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
