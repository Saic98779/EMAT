import { alpha } from '@mui/material/styles'

// Shared MUI sx override that converts the default "floating-label"
// outlined TextField into the design's simpler "label-above-a-clean-box"
// layout. Applied via a wrapper Box so consuming components don't need
// to change any of their TextField props.
//
// What it does:
//   • Detaches MUI's InputLabel from the notched border and drops it
//     above the input as small gray text.
//   • Hides the fieldset legend (removes the top-border notch cutout).
//   • Adds a hair of vertical breathing room between the label and the
//     input, matching the design's tight rhythm.
//   • Applies to both regular and select outlined inputs; select's own
//     inner label affordance is neutralised too.
//
// Usage
//   <Box sx={stackedLabelSx}>
//     <FormRenderer ... />                // or any TextField subtree
//   </Box>
export const stackedLabelSx = {
  // ── The floating label → static label-above ──────────────────────────
  '& .MuiInputLabel-root': {
    position: 'static',
    transform: 'none',
    marginBottom: '6px',
    fontSize: 12.5,
    fontWeight: 500,
    lineHeight: 1.2,
    color: (t) => t.palette.text.secondary,
    pointerEvents: 'auto',
    maxWidth: '100%',
    whiteSpace: 'normal',
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: (t) => t.palette.primary.main,
  },
  '& .MuiInputLabel-root.Mui-error': {
    color: (t) => t.palette.error.main,
  },
  // Even after focus/shrink, the label must stay put (default MUI
  // behaviour is to translate to the notch).
  '& .MuiInputLabel-shrink': {
    transform: 'none !important',
  },

  // ── Remove the notch cutout in the outlined border ──────────────────
  '& .MuiOutlinedInput-notchedOutline legend': {
    display: 'none',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    top: 0,
  },

  // ── Input container tuning ─────────────────────────────────────────
  '& .MuiOutlinedInput-root': {
    borderRadius: 1,
  },
  // Subtle hover + focus ring matching the design's teal accent.
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: (t) => alpha(t.palette.text.primary, 0.28),
  },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderWidth: 1.5,
  },

  // ── FormControlLabel + non-outlined bits stay untouched ─────────────
  // (Only the outlined text/select inputs get the treatment; radio /
  // checkbox / yesno components already render labels externally.)
}
