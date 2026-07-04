import { createTheme } from '@mui/material/styles'

// Polished Material Design theme — modern palette, soft elevation, refined components.
const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: 'light',
    primary: { main: '#2563eb', dark: '#1d4ed8', light: '#dbeafe', contrastText: '#fff' },
    secondary: { main: '#0d9488', dark: '#0f766e', light: '#ccfbf1', contrastText: '#fff' },
    success: { main: '#16a34a', dark: '#15803d', light: '#dcfce7' },
    warning: { main: '#d97706', dark: '#b45309', light: '#fef3c7' },
    error: { main: '#dc2626', dark: '#b91c1c', light: '#fee2e2' },
    info: { main: '#0284c7', dark: '#0369a1', light: '#e0f2fe' },
    background: { default: '#f5f7fb', paper: '#ffffff' },
    text: { primary: '#0f172a', secondary: '#64748b' },
    divider: 'rgba(15,23,42,0.08)',
    action: { hover: 'rgba(37,99,235,0.06)', selected: 'rgba(37,99,235,0.10)' },
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
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none', borderRadius: 10,
          '&.Mui-selected': { backgroundColor: 'rgba(37,99,235,0.10)' },
        },
      },
    },
  },
})

export const monoFont = '"Roboto Mono", ui-monospace, monospace'

export default theme
