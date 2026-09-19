import { API_BASE, apiFetch } from '../api'
import { fileUrl, uploadFilesBatch } from './files'

const SESSION_STORAGE_KEY = 'emat.session'
function getStoredToken() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)?.token || null
  } catch { return null }
}

// DIA content endpoints (GT PMU authoring surface).
//
// All six endpoints share the same shape: `POST /<path>` creates the
// record, backend echoes it back with `id + createdAt + createdBy` etc.
// filled in. Files are uploaded *after* the record exists via the
// generic file API, using the same path slug as the `stage` tag so
// `/files/{id}/<slug>/{id}/...` scopes them cleanly per entity type.

export const DIA_ENDPOINTS = {
  INFO_SERIES: 'dia-3c-info-series',
  ELEARNING:   'elearning-module-content',
  BROADCAST:   'bulk-broadcast',
  FORUM:       'discussion-forum',
  LATEST_DEV:  'latest-developments',
  POPUPS:      'pop-ups',
  BDSP:        'bdsp',
  PBSP:        'bds-service-providers-onboarding',
  SURVEY:      'surveys',
}

// Backend `bulkMessaging` / `broadcastThrough` enum values. Frontend
// keeps friendly labels ("Email / SMS / WhatsApp") for readability;
// send the uppercase enum to the backend.
const CHANNEL_ENUM = {
  Email:    'MAIL',
  SMS:      'SMS',
  WhatsApp: 'WHATSAPP',
}

export function toBackendChannels(labels) {
  return (labels || []).map((c) => CHANNEL_ENUM[c] || String(c).toUpperCase())
}

// POST /<path>. `requestedBy` and `requestDate` are NOT included —
// backend fills them from the JWT + server clock. Returns the created
// DTO (or the response envelope's `data` if apiFetch already unwrapped
// it, which it does).
export function createContent(path, body) {
  return apiFetch(`/${path}`, { method: 'POST', body })
}

// PUT /<path>/{id} — used to link the attachment URL(s) back onto the
// content record after we've uploaded the files. Backend takes the
// full DTO on PUT; caller must include every field they want persisted.
export function updateContent(path, id, body) {
  return apiFetch(`/${path}/${encodeURIComponent(id)}`, { method: 'PUT', body })
}

// POST /bdsp/import — multipart CSV / Excel bulk upload. Each row becomes
// one BDSP record and rides the same HO Checker approval workflow.
export async function importBdspRows(file, { signal } = {}) {
  const bearer = getStoredToken()
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/bdsp/import`, {
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
    const msg = (data && (data.message || data.error)) || `Import failed (${res.status})`
    const err = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

// GET /bdsp/import/template — downloads the CSV skeleton so users can
// fill it before uploading.
export async function downloadBdspTemplate() {
  const bearer = getStoredToken()
  const res = await fetch(`${API_BASE}/bdsp/import/template`, {
    headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
  })
  if (!res.ok) throw new Error(`Template download failed (${res.status})`)
  const blob = await res.blob()
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = 'bdsp-import-template.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}

function safeJson(t) {
  try { return JSON.parse(t) } catch { return null }
}

// Upload one-or-many files scoped to a freshly-created content record
// and return their canonical download URLs. `path` is the same endpoint
// slug used for POST — it doubles as the file API's `stage` tag so files
// land under `/files/{id}/{path}/{id}/...`.
//
// Returns an array of absolute URLs (empty if no files). Caller stores
// those on the content record's `attachment` (single) or `attachments`
// (array) field via `updateContent(...)`.
export async function uploadContentAttachments(path, id, files) {
  if (!id || !files?.length) return []
  const uploaded = await uploadFilesBatch(id, path, id, files)
  // Backend returns UploadedFileResponse[] with `filename`; build the
  // download URL from the same (id, path, id, filename) scope we uploaded to.
  return (uploaded || [])
    .map((f) => f?.filename)
    .filter(Boolean)
    .map((filename) => fileUrl(id, path, id, filename))
}
