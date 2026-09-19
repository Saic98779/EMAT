import { memo, useCallback, useRef } from 'react'
import {
  Alert, Box, Button, Chip, CircularProgress, Snackbar, Stack, TextField, Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { PageHeader } from '../../components/shared'
import { stackedLabelSx } from '../../components/workspace/formStyles'

// PMU form primitives
// ────────────────────────────────────────────────────────────────────────
// Minimal shell — matches the IA workspace's typography and rhythm.
// No card, no shadows, no progress ribbon — just a clean form on the
// page background with the same stacked-label inputs the IA registration
// form uses. If this file changes visually, all 8 PMU forms follow.

const APPROVAL_NOTE = "This entry goes to the SIDBI HO Checker for approval once submitted."

export function PmuFormShell({
  overline = 'Content · DIA',
  title,
  subtitle,
  headerAction = null,
  approvalNote = APPROVAL_NOTE,
  children,
  onSubmit,
  onReset,
  submitLabel = 'Submit for Approval',
  submitting = false,
  toast,
  onToastClose,
}) {
  const theme = useTheme()
  return (
    <Box sx={{ maxWidth: 940, mx: 'auto' }}>
      <PageHeader
        overline={overline}
        title={title}
        subtitle={subtitle}
        action={headerAction}
      />

      {approvalNote && (
        <Typography
          sx={{
            fontSize: 13,
            color: theme.palette.text.secondary,
            mt: -1,
            mb: 3,
          }}
        >
          {approvalNote}
        </Typography>
      )}

      <Box
        component="form"
        onSubmit={onSubmit}
        noValidate
        sx={stackedLabelSx}
      >
        {children}

        <Stack
          direction="row"
          spacing={1.25}
          justifyContent="flex-end"
          sx={{
            mt: 5,
            pt: 3,
            borderTop: 1,
            borderColor: alpha(theme.palette.text.primary, 0.08),
          }}
        >
          {onReset && (
            <Button
              variant="text"
              onClick={onReset}
              disabled={submitting}
              sx={{ textTransform: 'none', color: theme.palette.text.secondary }}
            >
              Reset
            </Button>
          )}
          <Button
            type="submit"
            variant="contained"
            disableElevation
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ textTransform: 'none', px: 3, fontWeight: 600 }}
          >
            {submitting ? 'Submitting…' : submitLabel}
          </Button>
        </Stack>
      </Box>

      <Snackbar
        open={!!toast}
        autoHideDuration={4200}
        onClose={onToastClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert severity={toast.severity} variant="filled" onClose={onToastClose}>
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  )
}

// Section — labelled group with a soft top rule between adjacent sections.
// Matches the IA registration SectionHeader — plain, quiet, no accents.
export function PmuSection({ title, description, children, first = false }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        pt: first ? 0 : 4,
        mt: first ? 0 : 4,
        borderTop: first ? 0 : 1,
        borderColor: alpha(theme.palette.text.primary, 0.08),
      }}
    >
      <Box sx={{ mb: 2.5 }}>
        <Typography
          sx={{
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: theme.palette.text.primary,
            lineHeight: 1.2,
          }}
        >
          {title}
        </Typography>
        {description && (
          <Typography sx={{ mt: 0.5, fontSize: 13, color: theme.palette.text.secondary }}>
            {description}
          </Typography>
        )}
      </Box>
      {children}
    </Box>
  )
}

// FieldRow — 12-col responsive grid so labels + inputs line up cleanly.
export function FieldRow({ children, columnGap = 3, rowGap = 2.5 }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        columnGap,
        rowGap,
        alignItems: 'start',
      }}
    >
      {children}
    </Box>
  )
}

// Cache the fully-built `sx` object per span so the Box below reuses the
// same reference across renders — otherwise every FieldCell allocates a
// fresh sx literal + gridColumn breakpoints map on every keystroke, and
// emotion has to re-hash them. With ~10 FieldCells per form this alone
// was measurable.
const SPAN_SX_CACHE = new Map()
function spanSx(span) {
  const key = typeof span === 'object' ? JSON.stringify(span) : `s${span}`
  let sx = SPAN_SX_CACHE.get(key)
  if (!sx) {
    const grid = typeof span === 'object'
      ? {
          gridColumn: {
            xs: `span ${span.xs || 12}`,
            sm: `span ${span.sm || span.xs || 12}`,
            md: `span ${span.md || span.sm || span.xs || 12}`,
            lg: `span ${span.lg || span.md || span.sm || span.xs || 12}`,
          },
        }
      : { gridColumn: `span ${span}` }
    sx = { ...grid, minWidth: 0 }
    SPAN_SX_CACHE.set(key, sx)
  }
  return sx
}

export function FieldCell({ span = 12, children }) {
  return <Box sx={spanSx(span)}>{children}</Box>
}

// FileDropField — dashed drop zone; chip list for selected files.
export function FileDropField({
  label = 'Attachment',
  accept,
  helperText,
  multiple = false,
  files = null,
  onChange,
}) {
  const theme = useTheme()
  const inputRef = useRef(null)
  const list = multiple ? (Array.isArray(files) ? files : []) : (files ? [files] : [])

  const openPicker = () => inputRef.current?.click()
  const onPick = (e) => {
    const picked = Array.from(e.target.files || [])
    if (picked.length) {
      if (multiple) {
        const key = (f) => `${f.name}::${f.size}`
        const existing = new Set(list.map(key))
        const additions = picked.filter((f) => !existing.has(key(f)))
        onChange?.([...list, ...additions])
      } else {
        onChange?.(picked[0])
      }
    }
    if (inputRef.current) inputRef.current.value = ''
  }
  const removeAt = (idx) => {
    if (multiple) onChange?.(list.filter((_, i) => i !== idx))
    else onChange?.(null)
  }

  return (
    <Box>
      <Typography
        sx={{
          fontSize: 12.5,
          fontWeight: 500,
          lineHeight: 1.2,
          color: theme.palette.text.secondary,
          mb: '6px',
        }}
      >
        {label}
      </Typography>
      <Box
        onClick={openPicker}
        role="button"
        sx={{
          border: `1px dashed ${alpha(theme.palette.text.primary, 0.24)}`,
          borderRadius: 1,
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          cursor: 'pointer',
          transition: 'border-color 120ms ease, background 120ms ease',
          '&:hover': {
            borderColor: alpha(theme.palette.primary.main, 0.5),
            background: alpha(theme.palette.primary.main, 0.03),
          },
        }}
      >
        <CloudUploadOutlinedIcon sx={{ color: theme.palette.text.disabled }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: theme.palette.text.primary }}>
            {multiple ? 'Add files' : (list.length > 0 ? 'Replace file' : 'Upload a file')}
          </Typography>
          {helperText && (
            <Typography sx={{ fontSize: 12, color: theme.palette.text.disabled, mt: 0.25 }}>
              {helperText}
            </Typography>
          )}
        </Box>
      </Box>
      <input
        ref={inputRef} type="file" hidden
        accept={accept}
        multiple={multiple}
        onChange={onPick}
      />
      {list.length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" gap={1} sx={{ mt: 1.25 }}>
          {list.map((f, i) => (
            <Chip
              key={`${f.name}::${f.size}::${i}`}
              label={`${f.name} · ${formatFileSize(f.size)}`}
              onDelete={(e) => { e.stopPropagation(); removeAt(i) }}
              deleteIcon={<CloseRoundedIcon />}
              variant="outlined"
              sx={{ maxWidth: '100%' }}
            />
          ))}
        </Stack>
      )}
    </Box>
  )
}

export function todayIso() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function formatFileSize(bytes) {
  if (!bytes || bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Shared renderValue for multi-select "chips" — kept at module scope so
// every Select in every form uses the exact same function reference,
// which keeps MUI Select from re-instantiating on every parent keystroke.
export const CHIP_RENDER_VALUE = (selected) => (
  <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
    {selected.map((c) => <Chip key={c} label={c} size="small" />)}
  </Stack>
)

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const PHONE_RE = /^[+\d][\d\s\-]{6,}$/
export const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[^\s]*)?$/i

// ── Perf helpers ────────────────────────────────────────────────────
// Stable references for the inline-object props we hand to TextField
// so `React.memo` in FormTextField isn't defeated by fresh literals
// on every parent render.
export const SHRINK_LABEL = { shrink: true }

// `useFieldHandlers` — returns `set(name)` and `blur(name)` factories that
// cache their per-name handlers across renders. Without this, each
// `const set = (name) => (e) => ...` in a form component minted brand
// new onChange/onBlur closures every keystroke, so every TextField in
// the form re-rendered even when only one field's value changed. With
// stable handlers + a memoised FormTextField, only the field whose
// value or error changed re-renders.
export function useFieldHandlers(setValues, setTouched) {
  const changeCache = useRef({})
  const blurCache = useRef({})

  const set = useCallback((name) => {
    if (!changeCache.current[name]) {
      changeCache.current[name] = (e) =>
        setValues((p) => ({ ...p, [name]: e?.target?.value ?? e }))
    }
    return changeCache.current[name]
  }, [setValues])

  const blur = useCallback((name) => {
    if (!blurCache.current[name]) {
      blurCache.current[name] = () =>
        setTouched((p) => (p[name] ? p : { ...p, [name]: true }))
    }
    return blurCache.current[name]
  }, [setTouched])

  return { set, blur }
}

// Memoised TextField. Custom comparator does a shallow compare across
// scalar props and a nested-shallow compare on the three prop objects
// (inputProps / InputProps / InputLabelProps) we frequently pass — so
// callers can keep passing plain literals like `InputLabelProps={{ shrink: true }}`
// as long as the *contents* are stable across renders.
export const FormTextField = memo(function FormTextField(props) {
  return <TextField {...props} />
}, arePropsShallowEqual)

// Zero-alloc shallow-compare. Original version used `new Set([...keys(a), ...keys(b)])`
// which allocated a Set + 2 arrays per compare — with 30 FormTextFields per
// form and this comparator running per field on every keystroke, that was
// several ms of pure GC pressure.
function arePropsShallowEqual(a, b) {
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  for (let i = 0; i < ak.length; i++) {
    const k = ak[i]
    if (!(k in b)) return false
    if (k === 'inputProps' || k === 'InputProps' || k === 'InputLabelProps') {
      if (!shallowEqObj(a[k], b[k])) return false
    } else if (a[k] !== b[k]) {
      return false
    }
  }
  return true
}

function shallowEqObj(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  for (const k of ak) if (a[k] !== b[k]) return false
  return true
}
