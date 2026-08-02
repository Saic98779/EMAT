import { API_BASE, apiFetch } from '../api'

// Backend `file-controller`. All files are keyed off the parent record's
// `registrationUuid` (Industry Association registration, BSE candidate, etc.).
const PATH = '/files'

// Kept in sync with STORAGE_KEY in auth.jsx. Duplicated here (rather than
// imported) to match the pattern in api.js and avoid circular imports.
const SESSION_STORAGE_KEY = 'emat.session'
function getStoredToken() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)?.token || null
  } catch { return null }
}

// GET /files/{registrationUuid} → UploadedFileResponse[]
export function listFiles(registrationUuid, { signal } = {}) {
  return apiFetch(`${PATH}/${encodeURIComponent(registrationUuid)}`, { signal })
}

// POST /files/{registrationUuid} (multipart/form-data, field name `file`)
// Returns the created UploadedFileResponse.
export async function uploadFile(registrationUuid, file, { signal } = {}) {
  const bearer = getStoredToken()
  const form = new FormData()
  form.append('file', file)

  const res = await fetch(`${API_BASE}${PATH}/${encodeURIComponent(registrationUuid)}`, {
    method: 'POST',
    signal,
    // NB: do NOT set Content-Type — the browser must set the multipart boundary.
    headers: {
      Accept: 'application/json',
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: form,
  })

  const text = await res.text()
  const data = text ? safeJson(text) : null
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `Upload failed (${res.status})`
    const err = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

// POST /files/{registrationUuid}/batch (multipart/form-data, repeating field
// name `files`). Replaces the sequential single-file loop we used to run —
// one TCP call, one auth check, backend controls internal concurrency.
// Returns whatever the batch endpoint returns (typically the list of
// UploadedFileResponse entries in request order).
export async function uploadFilesBatch(registrationUuid, files, { signal } = {}) {
  if (!files || files.length === 0) return []
  const bearer = getStoredToken()
  const form = new FormData()
  for (const f of files) form.append('files', f)

  const res = await fetch(`${API_BASE}${PATH}/${encodeURIComponent(registrationUuid)}/batch`, {
    method: 'POST',
    signal,
    headers: {
      Accept: 'application/json',
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: form,
  })

  const text = await res.text()
  const data = text ? safeJson(text) : null
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `Batch upload failed (${res.status})`
    const err = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }
  // Backend may return a bare array or a wrapper (`{content: []}` / `{items: []}`).
  return Array.isArray(data)
    ? data
    : (Array.isArray(data?.content) ? data.content
      : (Array.isArray(data?.items) ? data.items : []))
}

// DELETE /files/{registrationUuid}/{filename}
export function deleteFile(registrationUuid, filename, { signal } = {}) {
  return apiFetch(
    `${PATH}/${encodeURIComponent(registrationUuid)}/${encodeURIComponent(filename)}`,
    { method: 'DELETE', signal },
  )
}

// GET /files/{registrationUuid}/{filename} — absolute URL for direct download.
// Bearer auth is required, so this is intended for use with `downloadFile()`
// rather than a naked <a href> (which won't carry the Authorization header).
export function fileUrl(registrationUuid, filename) {
  return `${API_BASE}${PATH}/${encodeURIComponent(registrationUuid)}/${encodeURIComponent(filename)}`
}

// Fetches the file as a Blob and triggers a browser download. Ignores the
// server-provided `downloadUrl` — backend currently returns a relative path
// that resolves against the frontend origin (404). Always use fileUrl() so
// the request hits API_BASE (the backend host).
export async function downloadFile(registrationUuid, filename) {
  const bearer = getStoredToken()
  const url = fileUrl(registrationUuid, filename)
  const res = await fetch(url, {
    headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
  })
  if (!res.ok) throw new Error(`Download failed (${res.status})`)
  const blob = await res.blob()
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}

function safeJson(t) {
  try { return JSON.parse(t) } catch { return null }
}
