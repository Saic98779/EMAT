// Base URL for the backend.
//
// Default: `/emat/v1` — matches the Vite dev proxy in dev, and the nginx
// reverse-proxy expected in prod. Baking the default in so builds don't
// depend on env-var wiring in the CI/Jenkins pipeline; a bare `npm run
// build` still produces working paths.
//
// Override with `.env` → `VITE_API_BASE_URL=…` if you need a different
// prefix (e.g. an absolute API host during a cross-origin test).
export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/emat/v1'

// Kept in sync with STORAGE_KEY in auth.jsx. Duplicated here rather than
// imported to avoid a circular dependency (auth.jsx already imports api.js).
const SESSION_STORAGE_KEY = 'emat.session'

function getStoredToken() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)?.token || null
  } catch { return null }
}

// Thin fetch wrapper: sends JSON, attaches Bearer token from the stored session
// (unless explicitly overridden), throws with the server message on non-2xx.
export async function apiFetch(path, { method = 'GET', body, token, headers = {}, signal } = {}) {
  const bearer = token === undefined ? getStoredToken() : token
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...headers,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  const data = text ? safeJson(text) : null

  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `Request failed (${res.status})`
    const err = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

function safeJson(t) {
  try { return JSON.parse(t) } catch { return null }
}
