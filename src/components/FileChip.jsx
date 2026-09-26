import { useState } from 'react'
import { Chip, CircularProgress, Tooltip } from '@mui/material'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import { viewFile, viewFileUrl, viewLocalFile, filenameFromUrl } from '../apis/files'
import { decodeFilename } from '../fileFieldLabels'

// One attached file, clickable to view it in a new tab. Handles every shape
// a file can be in across the app:
//   • `file` as a File       — picked but not saved yet; previews from memory
//   • `file` as a string     — stored filename; needs `scope` to fetch it
//   • `url`                  — stored file-API URL (DIA content records)
// A stored filename without a scope can't be fetched, so it renders as a
// plain, non-clickable chip rather than a broken button.
export default function FileChip({
  file, url, scope, label, onDelete, deleteIcon, size = 'small', sx,
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const isLocal = typeof File !== 'undefined' && file instanceof File
  const name = label
    || (isLocal ? file.name
      : url ? filenameFromUrl(url)
        : typeof file === 'string' ? decodeFilename(file).name
          : '')
  const viewable = isLocal || !!url || (typeof file === 'string' && !!scope)

  const view = async () => {
    setError('')
    if (isLocal) { viewLocalFile(file); return }
    setBusy(true)
    try {
      if (url) await viewFileUrl(url, name)
      else await viewFile(scope.registrationId, scope.stage, scope.stageId ?? scope.registrationId, file)
    } catch (e) {
      setError(e?.message || "Couldn't open the file")
    } finally {
      setBusy(false)
    }
  }

  const icon = busy
    ? <CircularProgress size={14} />
    : viewable ? <VisibilityOutlinedIcon /> : <DescriptionOutlinedIcon />

  return (
    <Tooltip title={error || (viewable ? 'View file' : '')}>
      <Chip
        size={size}
        variant="outlined"
        color={error ? 'error' : 'default'}
        icon={icon}
        label={name || 'File'}
        onClick={viewable ? view : undefined}
        onDelete={onDelete}
        deleteIcon={deleteIcon}
        sx={{ maxWidth: '100%', ...sx }}
      />
    </Tooltip>
  )
}
