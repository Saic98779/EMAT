import { decryptString, encryptString } from './apis/pii'

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
//
// ── Response envelope (Aug '26) ──
// Backend now wraps every response as:
//   { status: 200, message: "…", data: <actual payload> }
// `apiFetch` unwraps this transparently so every caller keeps receiving the
// raw payload it always did. Older shape (bare payload) is preserved as a
// fallback — the two are disambiguated by looking for the three envelope
// keys together. Error responses still surface `message` through the
// thrown Error the same way, whether wrapped or not.
export async function apiFetch(path, { method = 'GET', body, token, headers = {}, signal } = {}) {
  const bearer = token === undefined ? getStoredToken() : token
  const skipCrypto = shouldSkipCrypto(path)

  // ── PII encryption middleware ────────────────────────────────────
  // Backend requires PII-marked fields on request bodies to be
  // AES-encrypted (`ENC:<url-safe-b64>` per apis/pii.js) and Long IDs
  // in URL path segments to be encrypted too. Anything in
  // `CRYPTO_SKIP_PATHS` bypasses this middleware — that covers the
  // login handshake (RSA on password), the public-key fetch, captcha,
  // and the AES key fetch itself. Everything else goes through.
  const finalPath = skipCrypto ? path : await encryptPath(path)
  const finalBody = skipCrypto ? body : await encryptRequestBody(body, bodyFieldsForPath(path, method))

  const res = await fetch(`${API_BASE}${finalPath}`, {
    method,
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...headers,
    },
    body: finalBody != null ? JSON.stringify(finalBody) : undefined,
  })

  const text = await res.text()
  const parsed = text ? safeJson(text) : null

  if (!res.ok) {
    // Envelope errors: { status, message, data }. Legacy: { message } or
    // Spring problem+json: { detail, title, message }.
    const msg = messageFrom(parsed) || `Request failed (${res.status})`
    const err = new Error(msg)
    err.status = res.status
    err.data = isEnvelope(parsed) ? parsed.data : parsed
    throw err
  }
  const payload = isEnvelope(parsed) ? parsed.data : parsed
  // Response decryption — walks the payload and decrypts every
  // `ENC:...` string it finds, regardless of key name (safe because
  // plaintext never starts with that prefix). Idempotent for non-ENC
  // strings so keys that weren't in the encrypted set on the DTO get
  // passed through untouched.
  return skipCrypto ? payload : await decryptResponseBody(payload)
}

// ── PII middleware helpers ─────────────────────────────────────────

// Endpoints that must NOT go through the AES middleware.
//   • `/users/login` — password uses RSA-OAEP (see auth.jsx). Response
//     includes the AES key we'd need to *do* the decrypt, so we hand
//     it back raw and let auth.jsx run `setKeyFromBase64` + explicit
//     decrypt calls on `userId` / `email`.
//   • `/auth/public-key`, `/pii-encryption-key`, `/captcha` — carry no
//     PII and either return the keys we need or run pre-auth.
const CRYPTO_SKIP_PATHS = new Set([
  '/users/login',
  '/auth/public-key',
  '/pii-encryption-key',
  '/captcha',
])

// Path prefixes that skip crypto entirely. The `/files/*` endpoint
// family uses multipart uploads (POST/DELETE go through bare `fetch`,
// not apiFetch anyway) and the LIST endpoint (`GET /files/{regId}`)
// returns raw file metadata whose IDs backend serves in plain form —
// applying the "encrypt numeric path segments" rule made every list
// request 404. Skip both directions for safety.
const CRYPTO_SKIP_PREFIXES = [
  '/files',
]

function shouldSkipCrypto(path) {
  const base = String(path).split('?')[0]
  if (CRYPTO_SKIP_PATHS.has(base)) return true
  for (const prefix of CRYPTO_SKIP_PREFIXES) {
    if (base === prefix || base.startsWith(prefix + '/')) return true
  }
  return false
}

// Per-endpoint request-body PII field lists. Matches
// `documentation/ENCRYPT_DECRYPT_FIELDS_FOR_FRONTEND.md` DTO-by-DTO —
// i.e. Create vs Update entries for the same resource use slightly
// different sets and are matched by HTTP method. This precision matters
// because a global "encrypt every field named `stageId`" rule breaks
// endpoints whose backend Jackson has no PII deserializer on that
// column (see eligibility-matrix, sustainability-matrix, where stageId
// is a plain Long).
//
// Each entry declares:
//   • `method`     — HTTP verb (uppercase). Null / undefined = any method.
//   • `matchPath`  — (path: string) => boolean. Match on the base path
//                    (no query string, ID segments still numeric).
//   • `fields`     — array of body field names that must be encrypted.
//
// First entry whose method + matchPath both return true wins.
const ENDPOINT_PII_MAP = [
  // 1. CreateUserRequest
  { method: 'POST', matchPath: (p) => p === '/users',
    fields: ['password', 'email', 'contactNo'] },

  // 3. CreateBseRecommendationRequest
  { method: 'POST', matchPath: (p) => p === '/bse-recommendations',
    fields: ['registrationId', 'userId', 'mobileNumber', 'emailId'] },
  // 4. UpdateBseRecommendationRequest (no registrationId)
  { method: 'PUT', matchPath: (p) => /^\/bse-recommendations\/.+$/.test(p),
    fields: ['userId', 'mobileNumber', 'emailId'] },

  // 5. CreateIndustryAssociationRegistrationRequest
  //    Doc lists top-level fields. Backend also enforces PII on the
  //    nested SecretariatStaffDto (`contact` + `email`) inside the
  //    `secretariatStaff` array — hence `contact` is included so the
  //    recursive walker encrypts it when it enters that array.
  { method: 'POST', matchPath: (p) => p === '/industry-association-registrations',
    fields: ['apexHolderMobile', 'apexHolderEmail', 'nodalMobile', 'nodalEmail',
             'email', 'sidbeApprovedByUserId', 'stageId',
             'contact'] },
  // 6. UpdateIndustryAssociationRegistrationRequest (no sidbeApprovedByUserId)
  { method: 'PUT', matchPath: (p) => /^\/industry-association-registrations\/.+$/.test(p),
    fields: ['apexHolderMobile', 'apexHolderEmail', 'nodalMobile', 'nodalEmail',
             'email', 'stageId',
             'contact'] },

  // 7. CreateIndustryAssociationAppraisalRequest
  //    Same nested SecretariatStaffDto rule applies if the appraisal
  //    ever carries a staff array — cheap to include, no false positive
  //    (no other appraisal field is named `contact`).
  { method: 'POST', matchPath: (p) => p === '/industry-association-appraisals',
    fields: ['registrationId', 'stageId',
             'apexHolderMobile', 'apexHolderEmail', 'nodalMobile', 'nodalEmail',
             'contact'] },
  // 8. UpdateIndustryAssociationAppraisalRequest (no registrationId)
  { method: 'PUT', matchPath: (p) => /^\/industry-association-appraisals\/.+$/.test(p),
    fields: ['stageId',
             'apexHolderMobile', 'apexHolderEmail', 'nodalMobile', 'nodalEmail',
             'contact'] },

  // 9. VendorRequestDTO — doc doesn't split Create/Update, one DTO for both
  { matchPath: (p) => p.startsWith('/vendor'),
    fields: ['spocMobileNo', 'email', 'mobileNo'] },

  // 10. ActivityRequest — POST (submit)
  { method: 'POST', matchPath: (p) => p === '/activity' || p === '/activities',
    fields: ['bseId', 'gtId'] },
  // 11. ActivityStatusUpdateRequest — PATCH (status change)
  { method: 'PATCH', matchPath: (p) => p.startsWith('/activity'),
    fields: ['followupActivityId'] },

  // 12. BseAttendanceManualRequestDTO
  { matchPath: (p) => p.startsWith('/bse-attendance-manual-request'),
    fields: ['id', 'bseRecommendationId'] },

  // 13. BseSalaryUpdateRequest — PUT only
  { method: 'PUT', matchPath: (p) => p.startsWith('/bse-salary'),
    fields: ['bseId'] },

  // 14. DisbursementCapexRequest — Create + Update use same DTO
  { matchPath: (p) => p.startsWith('/disbursement-capex'),
    fields: ['id', 'registrationId'] },

  // 14b. DisbursementNoteCapacityBuildingIa{,Officials}Request — Create +
  //      Update share one DTO each. The prefix deliberately covers both the
  //      `-ia` and `-ia-officials` collections; they take the same PII fields.
  { matchPath: (p) => p.startsWith('/disbursement-note-capacity-building-ia'),
    fields: ['id', 'registrationId'] },

  // 14c. Create/UpdateActionPlanRequest — registrationId is PII-protected,
  //      same as every other registration-keyed collection.
  { matchPath: (p) => p.startsWith('/action-plans'),
    fields: ['id', 'registrationId'] },

  // 15. EligibilityMatrixDto — ONLY registrationId, `stageId` is plain
  { matchPath: (p) => p.startsWith('/eligibility-matrix'),
    fields: ['registrationId'] },

  // 16. MonthlySalaryDetailsRequest — POST
  { method: 'POST', matchPath: (p) => p.startsWith('/monthly-salary-details'),
    fields: ['bseId'] },
  // 17. MonthlySalaryDetailsUpdateRequest — PUT
  { method: 'PUT', matchPath: (p) => p.startsWith('/monthly-salary-details'),
    fields: ['iaId', 'bseId'] },

  // 18. RegionalOfficeRequest — POST
  { method: 'POST', matchPath: (p) => p.startsWith('/regional-office'),
    fields: ['roId', 'contactNo'] },
  // 19. UpdateRegionalOfficeRequest — PUT
  { method: 'PUT', matchPath: (p) => p.startsWith('/regional-office'),
    fields: ['contactNo'] },

  // 20. UpdateBranchRequest — PUT only (Create not listed in doc)
  { method: 'PUT', matchPath: (p) => p.startsWith('/branch'),
    fields: ['contactNo', 'regionalOfficeId'] },

  // 21. UpdateSidbiSdeRequest — PUT only (Create not listed in doc)
  { method: 'PUT', matchPath: (p) => p.startsWith('/sidbi-sde'),
    fields: ['email', 'mobileNo', 'regionalOfficeId'] },

  // 22. SustainabilityMatrixRequest — ONLY appraisalId, `stageId` is plain
  { matchPath: (p) => p.startsWith('/sustainability-matrix'),
    fields: ['appraisalId'] },
]

function bodyFieldsForPath(rawPath, method) {
  const base = String(rawPath).split('?')[0]
  const m = String(method || 'GET').toUpperCase()
  const entry = ENDPOINT_PII_MAP.find((e) => {
    if (e.method && e.method !== m) return false
    return e.matchPath(base)
  })
  return entry ? new Set(entry.fields) : null
}

// Path segments that are entirely digits are assumed to be Long ids
// (per doc: "All @PathVariable Long values in API URLs must be
// encrypted") and get encrypted. Non-digit segments (words, UUIDs)
// pass through. Query values are encrypted only when they're purely
// numeric — matches the "@RequestParam Long" rule; strings stay plain.
async function encryptPath(rawPath) {
  const [base, query] = String(rawPath).split('?')
  const segments = base.split('/')
  const encSegments = await Promise.all(segments.map(async (seg) => {
    if (seg && /^\d+$/.test(seg)) {
      const enc = await encryptString(seg)
      return encodeURIComponent(enc)
    }
    return seg
  }))
  const encBase = encSegments.join('/')
  if (!query) return encBase
  const params = new URLSearchParams(query)
  const encParams = new URLSearchParams()
  for (const [k, v] of params) {
    if (v && /^\d+$/.test(v)) {
      encParams.set(k, await encryptString(v))
    } else {
      encParams.set(k, v)
    }
  }
  return encBase + '?' + encParams.toString()
}

async function encryptRequestBody(body, fields) {
  if (!fields || fields.size === 0) return body
  if (body == null) return body
  if (typeof body !== 'object') return body
  return encryptWalk(body, fields)
}

async function encryptWalk(node, fields) {
  if (node == null) return node
  if (Array.isArray(node)) {
    return Promise.all(node.map((item) => encryptWalk(item, fields)))
  }
  if (typeof node === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(node)) {
      if (v == null) { out[k] = v; continue }
      if (fields.has(k) && (typeof v === 'string' || typeof v === 'number')) {
        out[k] = await encryptString(String(v))
      } else if (typeof v === 'object') {
        out[k] = await encryptWalk(v, fields)
      } else {
        out[k] = v
      }
    }
    return out
  }
  return node
}

async function decryptResponseBody(payload) {
  if (payload == null || typeof payload !== 'object') return payload
  return decryptWalk(payload)
}

async function decryptWalk(node) {
  if (node == null) return node
  if (typeof node === 'string') {
    if (node.startsWith('ENC:')) return decryptString(node)
    return node
  }
  if (Array.isArray(node)) {
    return Promise.all(node.map(decryptWalk))
  }
  if (typeof node === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(node)) {
      out[k] = await decryptWalk(v)
    }
    return out
  }
  return node
}

// Envelope shape check — needs `status`+`data` at minimum (message alone
// isn't enough; a legacy DTO could happen to have a `message` field).
function isEnvelope(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v)
    && 'status' in v && 'data' in v
}

// Best-effort human-readable error message across shapes: envelope,
// Spring problem+json, legacy `{message}`, and plain strings.
function messageFrom(v) {
  if (!v) return null
  if (typeof v === 'string') return v
  return v.message || v.detail || v.error || null
}

function safeJson(t) {
  try { return JSON.parse(t) } catch { return null }
}
