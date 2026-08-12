import { createTheme } from '@mui/material/styles'

// Polished Material Design theme — modern palette, soft elevation, refined components.
const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: 'light',
    primary: { main: '#1288ac', dark: '#0d6683', light: '#d4eef6', contrastText: '#fff' },
    secondary: { main: '#f5a021', dark: '#c47a10', light: '#fdefd5', contrastText: '#fff' },
    success: { main: '#43a047', dark: '#2e7d32', light: '#dcf1dd' },
    warning: { main: '#ef8b1f', dark: '#c26a10', light: '#fdecd2' },
    error: { main: '#e2381f', dark: '#b52a15', light: '#fbe0dc' },
    info: { main: '#35aecb', dark: '#1f7d95', light: '#dcf1f7' },
    background: { default: '#f4f8fa', paper: '#ffffff' },
    text: { primary: '#123b5e', secondary: '#5b7186' },
    divider: 'rgba(18,59,94,0.10)',
    action: { hover: 'rgba(18,136,172,0.06)', selected: 'rgba(18,136,172,0.10)' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
    h3: { fontWeight: 800, letterSpacing: '-0.025em' },
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, letterSpacing: '-0.015em' },
    h6: { fontWeight: 700 },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
    overline: { fontWeight: 700, letterSpacing: '0.08em', fontSize: '0.68rem' },
  },
  components: {
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: '1px solid rgba(15,23,42,0.07)',
          borderRadius: 16,
          boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.03)',
        },
      },
    },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: 16 } } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 10 }, sizeLarge: { paddingBlock: 11 } },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 600, borderRadius: 8 } } },
    MuiListItemButton: { styleOverrides: { root: { borderRadius: 10 } } },
    MuiLinearProgress: { styleOverrides: { root: { borderRadius: 5, height: 8 } } },
    MuiTableCell: {
      styleOverrides: {
        head: {
          textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.06em',
          fontWeight: 700, color: '#64748b',
        },
      },
    },
    MuiSelect: {
      defaultProps: {
        MenuProps: {
          anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
          transformOrigin: { vertical: 'top', horizontal: 'left' },
          slotProps: { paper: { sx: { maxHeight: 280, mt: 0.5 } } },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none', borderRadius: 10,
          '&.Mui-selected': { backgroundColor: 'rgba(37,99,235,0.10)' },
        },
      },
    },
    // Global rule for every TextField (and its OutlinedInput / FilledInput /
    // Input variants): kill native ⯅ ⯆ spinner arrows on `type="number"`
    // and reject the minus key so users can't enter negative amounts.
    // Individual fields no longer need to opt in.
    MuiTextField: {
      defaultProps: {
        onKeyDown: (e) => {
          if (e.target && e.target.type === 'number' && (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+')) {
            e.preventDefault()
          }
        },
      },
      styleOverrides: {
        root: {
          '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
            WebkitAppearance: 'none', margin: 0,
          },
          '& input[type=number]': { MozAppearance: 'textfield' },
        },
      },
    },
  },
})

export const monoFont = '"Roboto Mono", ui-monospace, monospace'

export default theme
