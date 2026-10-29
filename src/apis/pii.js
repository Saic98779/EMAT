import { apiFetch } from '../api'

// AES-GCM PII key management for the frontend.
//
// The key is a shared AES-256 (backend-generated, Vault-held) that
// encrypts every PII field on every non-login endpoint. Format on the
// wire (both directions):
//   `<url-safe-base64(iv[12] || ciphertext || auth-tag[16])>`
//
// UAT 2026-10-29: backend dropped the `ENC:` prefix it used to prepend
// to every encrypted field. The ciphertext envelope (IV ‖ CT ‖ Tag,
// url-safe base64, no padding) is unchanged — only the self-describing
// marker is gone. Detection on the response walker shifted from a
// string-prefix check to a shape heuristic (url-safe-b64 charset,
// minimum length) + an AES-GCM auth-tag probe; non-ciphertext strings
// that happen to match the shape fail the tag check and pass through
// unchanged. The dual-mode guards still strip a legacy `ENC:` on input
// so any endpoint not yet migrated keeps working.
//
// Delivery paths (see auth.jsx):
//   1. Fresh login — the AES key rides inside the POST /users/login
//      response as `piiKey`. Caller passes it to `setKeyFromBase64()`.
//   2. Page refresh — memory wipes, but JWT survives in localStorage.
//      `ensureKey()` re-fetches via GET /pii-encryption-key using the
//      JWT that apiFetch already attaches. Same shared key comes back.
//   3. Logout / 401 — `clearKey()` drops the in-memory reference so
//      the next login starts fresh.

let cachedKey = null // Web Crypto AES-GCM CryptoKey
let inflight = null

async function importAesKey(rawBytes) {
  return window.crypto.subtle.importKey(
    'raw',
    rawBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

// Prime the cache from a base64-encoded 32-byte key. The login flow
// calls this immediately after a successful `POST /users/login` so the
// key is available before any post-login request fires.
export async function setKeyFromBase64(b64) {
  if (!b64) return null
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  cachedKey = await importAesKey(raw)
  return cachedKey
}

// Refetch the key from the server. Used on page refresh (JWT still
// valid, memory wiped) and as a fallback when a random request finds
// the cache empty. Dedupes parallel callers via `inflight` so a burst
// of requests at boot only triggers one network trip.
//
// Optional `token` — pass the JWT explicitly during the login handshake
// (the localStorage session hasn't been written yet at that point, so
// apiFetch's automatic token-from-storage lookup returns null and we'd
// hit the endpoint unauthenticated → 403).
export async function ensureKey({ token } = {}) {
  if (cachedKey) return cachedKey
  if (inflight) return inflight
  inflight = apiFetch('/pii-encryption-key', { token })
    .then(({ secretKey }) => setKeyFromBase64(secretKey))
    .finally(() => { inflight = null })
  return inflight
}

export function clearKey() {
  cachedKey = null
  inflight = null
}

export function hasKey() {
  return cachedKey != null
}

// ── Encrypt / decrypt primitives ───────────────────────────────────────

// Legacy prefix kept only for backwards-compat on inputs: a caller /
// endpoint still shipping `ENC:...` gets the prefix stripped before the
// shape + decrypt probe runs. We never emit it any more on request.
const LEGACY_ENC_PREFIX = 'ENC:'

// Shape of an AES-GCM ciphertext in url-safe-base64. Envelope is
// IV(12) ‖ CT(≥1) ‖ Tag(16) = 29+ bytes → 39+ base64 chars. Non-ASCII
// chars or anything outside the url-safe alphabet (so no `.`, `:`,
// `@`, `+`, `/`, `=`) means not ciphertext. Short strings (role
// enums, districts, pincodes, dates) are rejected on length alone.
const CIPHERTEXT_RE = /^[A-Za-z0-9_-]{39,}$/

// Fast gate used by the response walker and by `decryptString` to
// decide whether something is even worth running through AES-GCM.
// Deliberately conservative on length; false positives are harmless
// (auth-tag failure returns the original string).
export function looksLikeCiphertext(value) {
  if (typeof value !== 'string') return false
  const raw = value.startsWith(LEGACY_ENC_PREFIX)
    ? value.slice(LEGACY_ENC_PREFIX.length)
    : value
  return CIPHERTEXT_RE.test(raw)
}

// URL-safe base64 without padding — matches backend's format
// (Java `Base64.getUrlEncoder().withoutPadding()`).
function urlsafeB64Encode(bytes) {
  const b64 = btoa(String.fromCharCode(...bytes))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function urlsafeB64Decode(str) {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4)
  const std = padded.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(std), (c) => c.charCodeAt(0))
}

// Encrypt a string, return the raw url-safe-base64 ciphertext envelope
// (no prefix — the backend rejects `ENC:...` since 2026-10-29). No-ops
// on null / empty values so callers can pass anything through without
// pre-checking.
export async function encryptString(plaintext) {
  if (plaintext == null) return plaintext
  const str = String(plaintext)
  if (!str) return str
  const key = await ensureKey()
  if (!key) throw new Error('PII key not initialised — cannot encrypt')
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const ct = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(str),
  )
  // Layout: IV || Ciphertext || AuthTag  (Web Crypto returns ct+tag concatenated already)
  const combined = new Uint8Array(iv.byteLength + ct.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ct), iv.byteLength)
  return urlsafeB64Encode(combined)
}

// Decrypt a ciphertext string back to plaintext. The shape heuristic
// (`looksLikeCiphertext`) gates expensive crypto work; AES-GCM's auth
// tag then confirms whether a shape-matching string really is one of
// our ciphertexts. Bad-tag / wrong-key / corrupted payload all return
// the original value so downstream rendering doesn't crash on legit
// base64-looking strings that aren't ours (JWTs, nonces, etc.).
// Legacy `ENC:` prefix is stripped on input for a smooth transition if
// some endpoints haven't migrated yet.
export async function decryptString(value) {
  if (typeof value !== 'string') return value
  const raw = value.startsWith(LEGACY_ENC_PREFIX)
    ? value.slice(LEGACY_ENC_PREFIX.length)
    : value
  if (!CIPHERTEXT_RE.test(raw)) return value
  const key = await ensureKey()
  if (!key) return value // no key yet, leave as-is; caller can decide
  let combined
  try { combined = urlsafeB64Decode(raw) } catch { return value }
  if (combined.length < 29) return value // IV(12) + Tag(16) + ≥1 byte CT
  const iv = combined.slice(0, 12)
  const ctTag = combined.slice(12)
  try {
    const pt = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ctTag,
    )
    return new TextDecoder().decode(pt)
  } catch {
    // Shape matched but auth tag failed — almost certainly not our
    // ciphertext (e.g. a long url-safe-base64 token from another
    // system). Pass through silently; no console noise because the
    // shape heuristic has an acceptable false-positive rate by design.
    return value
  }
}
