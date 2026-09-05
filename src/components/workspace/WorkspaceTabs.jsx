import { memo } from 'react'
import { Box, Tab, Tabs, useTheme } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { TABS, tabDotColor } from './workspaceConfig'

// WorkspaceTabs
// ────────────────────────────────────────────────────────────────────────
// Horizontal tab rail below the snapshot bar. Each tab shows its label
// plus a coloured status dot mirroring the stage tracker so users can see
// the state of every stage at a glance without jumping tabs.
//
// Controlled component — the parent owns the active tab (usually derived
// from the URL). `onChange(tabKey)` is invoked on click; parent decides
// how to navigate (push, replace, etc.).
//
// Props
//   activeKey     Current tab slug
//   stageStates   Same map passed to StageTracker — drives the dot colours
//   onChange      (tabKey) => void
function WorkspaceTabs({ activeKey, stageStates = {}, onChange }) {
  const theme = useTheme()

  return (
    <Box
      sx={{
        mt: 2,
        borderBottom: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
      }}
    >
      <Tabs
        value={activeKey}
        onChange={(_, key) => onChange?.(key)}
        variant="scrollable"
        scrollButtons={false}
        allowScrollButtonsMobile
        sx={{
          minHeight: 44,
          '& .MuiTab-root': {
            minHeight: 44,
            textTransform: 'none',
            fontSize: 13.5,
            fontWeight: 500,
            color: theme.palette.text.secondary,
            px: 1.75,
            py: 1.25,
          },
          '& .Mui-selected': {
            color: `${theme.palette.primary.dark} !important`,
            fontWeight: 600,
          },
          '& .MuiTabs-indicator': {
            background: theme.palette.primary.main,
            height: 2,
          },
        }}
      >
        {TABS.map((t) => {
          const dot = tabDotColor(t.key, stageStates, theme)
          return (
            <Tab
              key={t.key}
              value={t.key}
              label={
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                  {t.label}
                  {dot && (
                    <Box
                      component="span"
                      sx={{
                        display: 'inline-block',
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: dot,
                      }}
                    />
                  )}
                </Box>
              }
            />
          )
        })}
      </Tabs>
    </Box>
  )
}

export default memo(WorkspaceTabs)
