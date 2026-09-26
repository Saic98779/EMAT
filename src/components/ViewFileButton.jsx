import { useState } from 'react'
import { Button, CircularProgress, IconButton, Tooltip } from '@mui/material'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'

// "View" action for a file row. `onView` should call one of the view helpers
// in apis/files.js — they open the tab synchronously, so it must be invoked
// directly from this click (it is: nothing is awaited before calling it).
export default function ViewFileButton({ onView, label = 'View', text = false }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (e) => {
    e?.stopPropagation?.()
    setError('')
    setBusy(true)
    try {
      await onView()
    } catch (err) {
      setError(err?.message || "Couldn't open the file")
    } finally {
      setBusy(false)
    }
  }

  if (text) {
    return (
      <Tooltip title={error}>
        <Button size="small" variant="text" color={error ? 'error' : 'primary'}
          onClick={run} disabled={busy} sx={{ textTransform: 'none', fontWeight: 600 }}>
          {busy ? 'Opening…' : label}
        </Button>
      </Tooltip>
    )
  }
  return (
    <Tooltip title={error || label}>
      <span>
        <IconButton size="small" color={error ? 'error' : 'default'}
          onClick={run} disabled={busy} aria-label={label}>
          {busy ? <CircularProgress size={14} /> : <VisibilityOutlinedIcon fontSize="small" />}
        </IconButton>
      </span>
    </Tooltip>
  )
}
