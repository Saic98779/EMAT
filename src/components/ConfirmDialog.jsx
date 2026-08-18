import {
  Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText,
  Button, Box, CircularProgress, Stack,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'

// Reusable confirm dialog. Renders an accent icon + coloured header per
// `severity` and forwards the confirm click to the caller. Keep the dialog
// open on rejection/cancel; parent owns close via `onClose`.
//
// Props:
//   open, onClose        — visibility
//   onConfirm            — async or sync; dialog stays open while a
//                          returned promise is pending so the button can
//                          show a spinner.
//   title, description   — content
//   confirmLabel         — button text (default "Confirm")
//   cancelLabel          — button text (default "Cancel")
//   severity             — 'primary' | 'success' | 'warning' | 'error' | 'info'
//   busy                 — external busy flag (overrides internal spinner)
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Confirm action',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  severity = 'primary',
  busy = false,
}) {
  const { Icon, color } = ICONS[severity] || ICONS.primary

  const handleConfirm = async () => {
    try {
      await onConfirm?.()
    } catch {
      // parent surfaces the error via a snackbar; leave dialog behaviour
      // to the caller (usually `onClose()` on success in the caller).
    }
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}
    >
      {/* Coloured strip so the severity reads at a glance without a full
          coloured background. Keeps the dialog calm. */}
      <Box sx={(t) => ({
        height: 4,
        bgcolor: t.palette[color]?.main || t.palette.primary.main,
      })} />

      <DialogTitle sx={{ pb: 1.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={(t) => ({
            width: 36, height: 36, borderRadius: 1.5,
            bgcolor: alpha(t.palette[color]?.main || t.palette.primary.main, 0.12),
            color: t.palette[color]?.dark || t.palette.primary.dark,
            display: 'grid', placeItems: 'center',
          })}>
            <Icon fontSize="small" />
          </Box>
          <Box sx={{ fontWeight: 700, fontSize: '1.05rem' }}>{title}</Box>
        </Stack>
      </DialogTitle>

      {description && (
        <DialogContent sx={{ pt: 0 }}>
          <DialogContentText sx={{ color: 'text.secondary' }}>
            {description}
          </DialogContentText>
        </DialogContent>
      )}

      <DialogActions sx={{ px: 3, py: 2, gap: 0.5 }}>
        <Button
          onClick={onClose}
          disabled={busy}
          sx={{ textTransform: 'none', color: 'text.secondary' }}
        >
          {cancelLabel}
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={busy}
          variant="contained"
          color={color}
          disableElevation
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ textTransform: 'none', fontWeight: 700, minWidth: 100 }}
        >
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const ICONS = {
  primary: { Icon: HelpOutlineIcon,           color: 'primary' },
  info:    { Icon: InfoOutlinedIcon,          color: 'info' },
  success: { Icon: CheckCircleOutlineIcon,    color: 'success' },
  warning: { Icon: WarningAmberOutlinedIcon,  color: 'warning' },
  error:   { Icon: WarningAmberOutlinedIcon,  color: 'error' },
}
