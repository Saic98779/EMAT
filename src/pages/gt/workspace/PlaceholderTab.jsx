import { memo } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import ConstructionIcon from '@mui/icons-material/ConstructionRounded'
import { alpha, useTheme } from '@mui/material/styles'

// PlaceholderTab
// ────────────────────────────────────────────────────────────────────────
// Neutral "coming next" panel shown for workspace tabs whose real screen
// hasn't been ported into the new pattern yet. Keeps the shell renderable
// end-to-end while individual tabs land in follow-up passes.
//
// Props
//   title     Human name of the tab
//   summary   One-line description of what will live here
function PlaceholderTab({ title, summary }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        maxWidth: 620,
        mx: 'auto',
        mt: 4,
        p: 5,
        borderRadius: 2,
        border: 1,
        borderColor: alpha(theme.palette.text.primary, 0.09),
        background: alpha(theme.palette.primary.light, 0.35),
        textAlign: 'center',
      }}
    >
      <Stack alignItems="center" spacing={2}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: '#fff',
            display: 'grid',
            placeItems: 'center',
            color: theme.palette.primary.main,
          }}
        >
          <ConstructionIcon />
        </Box>
        <Typography sx={{ fontSize: 18, fontWeight: 700 }}>{title}</Typography>
        <Typography sx={{ fontSize: 14, color: 'text.secondary', maxWidth: 480 }}>
          {summary}
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: 'text.disabled' }}>
          This tab lands in the next port.
        </Typography>
      </Stack>
    </Box>
  )
}

export default memo(PlaceholderTab)
