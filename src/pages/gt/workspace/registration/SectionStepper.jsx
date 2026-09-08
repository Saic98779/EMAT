import { memo } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineRounded'
import { alpha, useTheme } from '@mui/material/styles'

// SectionStepper
// ────────────────────────────────────────────────────────────────────────
// Left-rail navigation for the Registration (L1) form. Lightweight design:
// no outer card, just a stacked list of section rows. Each row shows a
// tiny dot indicator, the section name, and a subtle "active" background
// on the currently visible section.
//
// Fully controlled — parent owns activeIndex + completion; clicking a row
// invokes onSelect(index).
//
// Props
//   sections       [{ n, title }]
//   activeIndex    number
//   completion     { [n]: 'done' | 'error' | 'empty' | 'partial' }
//   completedCount number   — rendered as the "N of M complete" caption
//   onSelect       (index) => void
function SectionStepper({ sections, activeIndex, completion = {}, completedCount, onSelect }) {
  const theme = useTheme()

  return (
    <Box component="nav" aria-label="Form sections">
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 600,
          color: theme.palette.text.disabled,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          px: 0.5,
          pb: 1,
        }}
      >
        Sections · {completedCount} of {sections.length} complete
      </Typography>

      <Stack>
        {sections.map((sec, i) => {
          const state = completion[sec.n] || 'empty'
          const active = i === activeIndex
          const { dotBg, dotBorder, dotColor, dotIcon, labelColor, labelWeight } = rowVisuals(state, active, theme)

          return (
            <Box
              key={sec.n}
              component="button"
              type="button"
              onClick={() => onSelect(i)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                width: '100%',
                textAlign: 'left',
                border: 0,
                background: active ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                borderRadius: 1,
                px: 1.25,
                py: 1.125,
                cursor: 'pointer',
                fontFamily: 'inherit',
                position: 'relative',
                '&:hover': !active ? { background: alpha(theme.palette.text.primary, 0.035) } : undefined,
                // Active-row left-edge accent bar (matches design)
                '&::before': active
                  ? {
                    content: '""',
                    position: 'absolute',
                    left: 0, top: 6, bottom: 6,
                    width: 3,
                    borderRadius: 2,
                    background: theme.palette.primary.main,
                  }
                  : undefined,
              }}
            >
              <Box
                sx={{
                  width: 20,
                  height: 20,
                  flexShrink: 0,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  background: dotBg,
                  border: `${dotBorder.width}px solid ${dotBorder.color}`,
                  color: dotColor,
                }}
              >
                {dotIcon || (state === 'done' ? null : sec.n)}
              </Box>
              <Typography
                sx={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 13.5,
                  color: labelColor,
                  fontWeight: labelWeight,
                  textWrap: 'pretty',
                  lineHeight: 1.3,
                }}
              >
                {sec.title}
              </Typography>
            </Box>
          )
        })}
      </Stack>
    </Box>
  )
}

export default memo(SectionStepper)

function rowVisuals(state, active, theme) {
  const neutral = alpha(theme.palette.text.primary, 0.16)

  if (state === 'done') {
    return {
      dotBg: theme.palette.success.main,
      dotBorder: { width: 0, color: theme.palette.success.main },
      dotColor: '#fff',
      dotIcon: <CheckIcon sx={{ fontSize: 12 }} />,
      labelColor: theme.palette.text.primary,
      labelWeight: active ? 600 : 500,
    }
  }
  if (state === 'error') {
    return {
      dotBg: '#fff',
      dotBorder: { width: 1.5, color: theme.palette.warning.main },
      dotColor: theme.palette.warning.dark,
      dotIcon: <ErrorOutlineIcon sx={{ fontSize: 12 }} />,
      labelColor: theme.palette.warning.dark,
      labelWeight: 600,
    }
  }
  if (active) {
    return {
      dotBg: '#fff',
      dotBorder: { width: 2, color: theme.palette.primary.main },
      dotColor: theme.palette.primary.dark,
      dotIcon: null,
      labelColor: theme.palette.primary.dark,
      labelWeight: 600,
    }
  }
  return {
    dotBg: '#fff',
    dotBorder: { width: 1.5, color: neutral },
    dotColor: theme.palette.text.disabled,
    dotIcon: null,
    labelColor: theme.palette.text.secondary,
    labelWeight: 400,
  }
}
