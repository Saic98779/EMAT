import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiFetch } from './api'
import { ROLES } from './data'

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
  // for now (HO_MAKER / HO_CHECKER / RO don't yet have dedicated screens).
  SDE: 'sde',
  SIDBI_SDE: 'sde',
  SIDBI_RO: 'sde',
  SIDBI_HO_MAKER: 'sde',
  SIDBI_HO_CHECKER: 'sde',
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

  useEffect(() => {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else localStorage.removeItem(STORAGE_KEY)
  }, [session])

  // POST /users/login { username, password } → { token, role, firstName, lastName, ... }
  const login = useCallback(async (username, password) => {
    const data = await apiFetch('/users/login', {
      method: 'POST',
      body: { username, password },
    })
    const role = normalizeRole(data?.role)
    if (!role) throw new Error(`Role “${data?.role}” is not configured in this app.`)
    const user = buildUser(data)
    setSession({
      role,
      user,
      token: data.token || null,
      expiresAt: data.expiresAt || null,
      rawRole: data.role,
    })
    return { role }
  }, [])

  const logout = useCallback(() => setSession(null), [])

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
