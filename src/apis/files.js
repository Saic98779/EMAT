import { API_BASE, apiFetch } from '../api'
import { encryptString } from './pii'

// Backend `file-controller`.
//
// Endpoint shape (verified against live prod OpenAPI, 2026-09-19):
//   GET    /files?registrationId=&stage=&stageId=
//   POST   /files?registrationId=&stage=&stageId=          multipart, field `file`
//   POST   /files/batch?registrationId=&stage=&stageId=    multipart, field `files`
//   GET    /files/{filename}?registrationId=&stage=&stageId=
//   DELETE /files/{filename}?registrationId=&stage=&stageId=
//
// The scoping keys — `stage` (lowercase entity-type tag), `stageId`, and
// `registrationId` — travel as query params, NOT as path segments. An
// earlier iteration of this client mistakenly built path-shaped URLs
// (`/files/{registrationId}/{stage}/{stageId}/...`) and every call
// returned Spring's "No static resource" 500 because no controller
// matched that route.
//
// Convention across the app:
//   - Top-level entities (IA, BSE) pass their own id as both
//     `registrationId` and `stageId`.
//   - `stage` is a lowercase tag chosen by the caller:
//       "ia"                for anything under an IA workspace
//       "bse"               for a BSE candidate record
//       "dia-3c-info-series", "bulk-broadcast", … for DIA content
//     forms (the endpoint slug doubles as the file namespace tag).

const PATH = '/files'

// Live prod probe (2026-09-19) shows the backend accepts only these
// stage strings — anything else 400s with `Invalid stage: ...`.
// If a new DIA content endpoint needs its own bucket, ask backend to
// add it to the whitelist and extend this map.
export const FILE_STAGE = {
  IA: 'registration',   // was 'ia' before Sep '26 — backend uses 'registration'
  BSE: 'bse',
  APPRAISAL: 'appraisal',
}

const SESSION_STORAGE_KEY = 'emat.session'
function getStoredToken() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)?.token || null
  } catch { return null }
}

// Backend flipped to strict encryption on the file API (2026-09-23):
// query params `registrationId` and `stageId` must be `ENC:...` strings,
// plain integers now 400 with `Plain-text value rejected: expected an
// encrypted ENC:... value for a PII-protected field`. `stage` is a
// non-PII tag and stays plain-text.
//
// Callers still hand us whatever id they have in memory (an ENC string
// from a URL param, or a plain integer from a decrypted DTO); we
// idempotently upgrade both to ENC here. Because encryptString is
// async, every file API call site is async now.
async function encryptIdForFiles(v) {
  const s = v == null ? '' : String(v)
  if (s.startsWith('ENC:')) return s
  return await encryptString(s)
}

async function scopeQuery(registrationId, stage, stageId) {
  const [encReg, encStage] = await Promise.all([
    encryptIdForFiles(registrationId),
    encryptIdForFiles(stageId),
  ])
  const p = new URLSearchParams()
  p.set('registrationId', encReg)
  p.set('stage', String(stage))
  p.set('stageId', encStage)
  return p.toString()
}

// GET /files?registrationId=&stage=&stageId= → UploadedFileResponse[]
export async function listFiles(registrationId, stage, stageId, { signal } = {}) {
  const qs = await scopeQuery(registrationId, stage, stageId)
  return apiFetch(`${PATH}?${qs}`, { signal })
}

// POST /files?…  multipart/form-data, field name `file`
export async function uploadFile(registrationId, stage, stageId, file, { signal } = {}) {
  const bearer = getStoredToken()
  const form = new FormData()
  form.append('file', file)

  const qs = await scopeQuery(registrationId, stage, stageId)
  const res = await fetch(
    `${API_BASE}${PATH}?${qs}`,
    {
      method: 'POST',
      signal,
      headers: {
        Accept: 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: form,
    },
  )

  const text = await res.text()
  const data = text ? safeJson(text) : null
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `Upload failed (${res.status})`
    const err = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }
  return unwrap(data)
}

// POST /files/batch?…  multipart/form-data, repeating field `files`
export async function uploadFilesBatch(registrationId, stage, stageId, files, { signal } = {}) {
  if (!files || files.length === 0) return []
  const bearer = getStoredToken()
  const form = new FormData()
  for (const f of files) form.append('files', f)

  const qs = await scopeQuery(registrationId, stage, stageId)
  const res = await fetch(
    `${API_BASE}${PATH}/batch?${qs}`,
    {
      method: 'POST',
      signal,
      headers: {
        Accept: 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: form,
    },
  )

  const text = await res.text()
  const data = text ? safeJson(text) : null
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `Batch upload failed (${res.status})`
    const err = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }
  const payload = unwrap(data)
  return Array.isArray(payload)
    ? payload
    : (Array.isArray(payload?.content) ? payload.content
      : (Array.isArray(payload?.items) ? payload.items : []))
}

// DELETE /files/{filename}?…
export async function deleteFile(registrationId, stage, stageId, filename, { signal } = {}) {
  const qs = await scopeQuery(registrationId, stage, stageId)
  return apiFetch(
    `${PATH}/${encodeURIComponent(filename)}?${qs}`,
    { method: 'DELETE', signal },
  )
}

// Absolute URL for a specific file — pair with `downloadFile()` since
// bearer auth is required (naked <a href> won't carry the header).
// Async now because backend requires ENC-encrypted IDs on the query
// string; encryptString is a WebCrypto AES call.
export async function fileUrl(registrationId, stage, stageId, filename) {
  const qs = await scopeQuery(registrationId, stage, stageId)
  return `${API_BASE}${PATH}/${encodeURIComponent(filename)}?${qs}`
}

// Fetches the file as a Blob and triggers a browser download.
export async function downloadFile(registrationId, stage, stageId, filename) {
  const bearer = getStoredToken()
  const url = await fileUrl(registrationId, stage, stageId, filename)
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

// Response envelope unwrap — matches `apiFetch` in api.js. The multipart
// endpoints use bare fetch, so we handle the envelope ourselves.
function unwrap(v) {
  if (v != null && typeof v === 'object' && 'status' in v && 'data' in v) return v.data
  return v
}

function safeJson(t) {
  try { return JSON.parse(t) } catch { return null }
}
