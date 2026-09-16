import { apiFetch } from '../api'

// AES-GCM PII key management for the frontend.
//
// The key is a shared AES-256 (backend-generated, Vault-held) that
// encrypts every PII field on every non-login endpoint. Format on the
// wire (both directions):
//   `ENC:<url-safe-base64(iv[12] || ciphertext || auth-tag[16])>`
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

const ENC_PREFIX = 'ENC:'

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

// Encrypt a string, return `ENC:<url-safe-base64>` wire format.
// No-ops on null / undefined / already-encrypted values so callers can
// pass anything through without pre-checking.
export async function encryptString(plaintext) {
  if (plaintext == null) return plaintext
  const str = String(plaintext)
  if (!str) return str
  if (str.startsWith(ENC_PREFIX)) return str // idempotent
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
  return ENC_PREFIX + urlsafeB64Encode(combined)
}

// Decrypt an `ENC:...` string back to plaintext. Passes plain strings
// through unchanged so the caller can walk arbitrary responses.
export async function decryptString(value) {
  if (typeof value !== 'string' || !value.startsWith(ENC_PREFIX)) return value
  const key = await ensureKey()
  if (!key) return value // no key yet, leave as-is; caller can decide
  const combined = urlsafeB64Decode(value.slice(ENC_PREFIX.length))
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
    // Bad tag / wrong key / corrupted payload. Return the raw string so
    // downstream code can at least see something and not crash — but
    // log so we notice during development.
    // eslint-disable-next-line no-console
    console.warn('PII decrypt failed for value:', value.slice(0, 40) + '…')
    return value
  }
}
