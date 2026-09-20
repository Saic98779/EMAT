import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './api'
import { ROLES } from './data'
import { clearPublicKey, rsaEncryptToBase64 } from './apis/publicKey'
import {
  clearKey as clearPiiKey,
  decryptString,
  ensureKey as ensurePiiKey,
  setKeyFromBase64,
} from './apis/pii'

const AuthContext = createContext(null)
const STORAGE_KEY = 'emat.session'

// Backend role codes → internal role keys used by the router and sidebar nav.
// Extend as more roles are wired up on the backend. Unknown codes are rejected
// at login time (we don't want to store a role that has no matching workspace,
// otherwise the router would redirect in a loop).
// Backend role enum (see user-controller) → internal workspace key used by
// the router / sidebar nav. Keep both the new SIDBI_* / GT_* names and the
// legacy short codes so existing sessions keep working.
const ROLE_MAP = {
  // Field / capture
  GT: 'gt',
  GT_FIELD_TEAM: 'gt',
  GT_PMU: 'gt',
  // SIDBI appraisal / disbursement chain — all land on the SDE workspace
  // for now (HO_MAKER / RO don't yet have dedicated screens).
  SDE: 'sde',
  SIDBI_SDE: 'sde',
  SIDBI_RO: 'sde',
  SIDBI_HO_MAKER: 'sde',
  // SIDBI HO Checker owns the DIA content approval workspace.
  SIDBI_HO_CHECKER: 'checker',
  // Field officer
  BSE: 'bse',
  // Industry Association nodal user
  IA: 'ia',
  // Manpower Agency owns the salary-disbursement workspace (formerly DIA).
  MANPOWER_AGENCY: 'mpa',
  MPA: 'mpa',
  // Cluster experts see the SDE appraisal surface.
  CLUSTER_EXPERT: 'sde',
}

function normalizeRole(raw) {
  if (!raw) return null
  return ROLE_MAP[String(raw).toUpperCase()] || null
}

// Build the user object the layout expects from the backend response.
function buildUser(data) {
  const first = data.firstName || ''
  const last = data.lastName || ''
  const name = [first, last].filter(Boolean).join(' ').trim() || data.username || 'User'
  const initials = ((first[0] || '') + (last[0] || '')).toUpperCase()
    || (data.username?.[0]?.toUpperCase() || 'U')
  return {
    name,
    initials,
    title: data.role || '',
    email: data.email || '',
    username: data.username || '',
    userId: data.userId,
    district: data.district,
    state: data.state,
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Discard a stored session whose role no longer maps — prevents router loops.
    if (!parsed.role || !Object.values(ROLE_MAP).includes(parsed.role)) return null
    return parsed
  } catch { return null }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadSession())
  const qc = useQueryClient()

  useEffect(() => {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else localStorage.removeItem(STORAGE_KEY)
  }, [session])

  // POST /users/login { username, password, captchaId, captchaAnswer }
  //   → { token, piiKey, role, userId (ENC:...), email (ENC:...), ... }
  //
  // Two crypto layers wrapped around this call:
  //   • Password is RSA-OAEP-SHA256 encrypted with the backend's public
  //     key (fetched from GET /auth/public-key) and sent as raw standard
  //     base64 — no prefix. Backend RSA-decrypts using the Vault-held
  //     private key. This is only for the login bootstrap; no other
  //     endpoint uses RSA.
  //   • Response carries `piiKey` (base64 AES-256) alongside the JWT.
  //     We import it into Web Crypto and cache in memory. From this
  //     point on every PII field in every request/response uses AES-GCM
  //     with that key (see apis/pii.js).
  //
  // `userId` and `email` come back as `ENC:...` strings — decrypt with
  // the freshly-cached AES key before storing on the session object.
  const login = useCallback(async (username, password, captcha = {}) => {
    // 1. RSA-encrypt the password with the backend's public key.
    const encryptedPassword = await rsaEncryptToBase64(password)

    // 2. POST /users/login — username stays plaintext (it's an
    //    identifier, not PII). Password is the RSA base64 blob.
    const data = await apiFetch('/users/login', {
      method: 'POST',
      body: {
        username,
        password: encryptedPassword,
        captchaId: captcha.id || '',
        captchaAnswer: captcha.answer || '',
      },
    })

    // 3. Prime the AES cache. Preferred path is the `piiKey` field on
    //    the login response — one round trip, atomic with the JWT.
    //    Fallback (current backend state): fetch it separately from
    //    /pii-encryption-key, passing the fresh JWT explicitly since
    //    the session hasn't been persisted yet.
    if (data?.piiKey) {
      await setKeyFromBase64(data.piiKey)
    } else if (data?.token) {
      await ensurePiiKey({ token: data.token })
    } else {
      throw new Error('Login response missing both token and piiKey — cannot proceed.')
    }

    // 4. Decrypt the two encrypted response fields the doc mandates.
    //    Everything else on the response is plaintext (role, names, etc.).
    const decryptedEmail = data.email ? await decryptString(data.email) : ''
    const decryptedUserId = data.userId != null ? await decryptString(String(data.userId)) : null

    const role = normalizeRole(data?.role)
    if (!role) throw new Error(`Role “${data?.role}” is not configured in this app.`)
    const user = buildUser({ ...data, email: decryptedEmail, userId: decryptedUserId })
    // Nuke the react-query cache before the new session starts. Prevents
    // the classic "logged out as GT, logged back in as SDE, still see
    // GT's IA list until I hit refresh" bug — every query was cached in
    // memory keyed only on its query key, not on the auth token, so the
    // stale data from the previous user got served instantly.
    qc.clear()
    setSession({
      role,
      user,
      token: data.token || null,
      expiresAt: data.expiresAt || null,
      rawRole: data.role,
    })
    return { role }
  }, [qc])

  // Same cache reset on logout so nothing from the previous session
  // lingers into the next login attempt. Also wipes the in-memory RSA
  // + AES keys so a follow-up login re-fetches fresh material.
  const logout = useCallback(() => {
    qc.clear()
    clearPiiKey()
    clearPublicKey()
    setSession(null)
  }, [qc])

  // The value object is memoized on session identity so consumers of
  // useAuth() don't re-render whenever an unrelated parent re-renders.
  const value = useMemo(() => {
    const role = session?.role || null
    const rawRole = session?.rawRole || null
    const user = session?.user || null
    const token = session?.token || null
    // Static metadata (label/tag/short) from ROLES; user info always from API.
    const roleInfo = role
      ? { ...(ROLES[role] || {}), user: user || ROLES[role]?.user || null }
      : null
    return { role, rawRole, user, token, roleInfo, login, logout }
  }, [session, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
