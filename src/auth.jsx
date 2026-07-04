import { createContext, useContext, useState } from 'react'
import { ROLES } from './data'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [role, setRole] = useState(null)

  const login = (roleKey) => setRole(roleKey)
  const logout = () => setRole(null)

  const value = { role, roleInfo: role ? ROLES[role] : null, login, logout }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
