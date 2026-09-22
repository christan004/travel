import { createContext, useContext } from 'react'
import type { AuthUser, LoginPayload } from '@/types/entities'

export interface AuthContextValue {
  user: AuthUser | null
  /** True only while the initial session-restore request is in flight. */
  isInitialising: boolean
  isAuthenticated: boolean
  login: (payload: LoginPayload) => Promise<AuthUser>
  logout: () => Promise<void>
  /** Permission check against the flat strings on the session user. */
  /** True for platform accounts, which bypass every permission check. */
  isSuperAdmin: boolean
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (...permissions: string[]) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
