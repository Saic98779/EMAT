import { apiFetch } from '../api'

// GET /auth/public-key — pre-authentication, no JWT.
// Returns:
//   { publicKey: "<base64 SPKI>", algorithm: "RSA-OAEP", hash: "SHA-256", keySize: 2048 }
//
// The publicKey is a base64-encoded SPKI (SubjectPublicKeyInfo) DER blob —
// NOT PEM. Import directly with `crypto.subtle.importKey('spki', ...)`.
// Used to RSA-encrypt the login password before POST /users/login.
// After login succeeds, the AES `piiKey` in the response takes over for
// every other PII field on every other endpoint — this RSA key is only
// for the login bootstrap.
//
// Cached in memory across renders — the key rotates on backend deploy,
// and re-mounting the login form doesn't need to refetch it. Cleared
// on logout via `clearPublicKey()` so a fresh fetch happens after a
// role change.
let cachedKey = null
let inflight = null

async function importSpki(spkiB64) {
  const raw = Uint8Array.from(atob(spkiB64), (c) => c.charCodeAt(0))
  return window.crypto.subtle.importKey(
    'spki',
    raw,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  )
}

export async function ensurePublicKey() {
  if (cachedKey) return cachedKey
  if (inflight) return inflight
  inflight = apiFetch('/auth/public-key')
    .then((data) => importSpki(data.publicKey))
    .then((k) => { cachedKey = k; return k })
    .finally(() => { inflight = null })
  return inflight
}

export function clearPublicKey() {
  cachedKey = null
  inflight = null
}

// Encrypt a UTF-8 string with the cached RSA public key using
// RSA-OAEP + SHA-256. Returns **standard base64** (no prefix, no
// url-safe substitutions) — that's the format backend expects on the
// `password` field of POST /users/login.
export async function rsaEncryptToBase64(plaintext) {
  const key = await ensurePublicKey()
  const bytes = new TextEncoder().encode(String(plaintext))
  const ct = await window.crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, bytes)
  return btoa(String.fromCharCode(...new Uint8Array(ct)))
}
