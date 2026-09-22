import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AuthContext, type AuthContextValue } from '@/context/AuthContext'
import { queryKeys } from '@/lib/queryClient'
import { onAuthFailure, ApiError } from '@/lib/axios'
import * as authApi from '@/api/auth'
import type { AuthUser, LoginPayload } from '@/types/entities'

/**
 * Owns the session.
 *
 * The user object is React Query state, not duplicated into useState, so
 * there is a single source of truth. `enabled` gating is deliberate: after a
 * logout or a failed refresh we stop re-querying /auth/me until the next
 * login, which otherwise produces a 401 loop on the login screen.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  // Starts true so a returning user with valid cookies is restored on boot.
  const [sessionPossible, setSessionPossible] = useState(true)

  const {
    data: user = null,
    isLoading,
    isFetched,
  } = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: authApi.getCurrentUser,
    enabled: sessionPossible,
    retry: false,
    staleTime: 5 * 60_000,
  })

  /** Drop every cached query so one user never sees another user's data. */
  const clearSession = useCallback(() => {
    setSessionPossible(false)
    queryClient.setQueryData(queryKeys.auth.me, null)
    queryClient.clear()
  }, [queryClient])

  // The axios interceptor signals here when a refresh has definitively failed.
  useEffect(() => onAuthFailure(clearSession), [clearSession])

  const login = useCallback(
    async (payload: LoginPayload): Promise<AuthUser> => {
      const loggedIn = await authApi.login(payload)
      // Seed the cache from the login response so the shell renders without
      // waiting on a second /auth/me round trip.
      queryClient.setQueryData(queryKeys.auth.me, loggedIn)
      setSessionPossible(true)
      return loggedIn
    },
    [queryClient],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch (error) {
      // A failed logout still clears locally: the cookies are httpOnly and
      // already expired or unreachable, so keeping the UI signed in is worse.
      if (!(error instanceof ApiError)) throw error
    } finally {
      clearSession()
    }
  }, [clearSession])

  const permissions = useMemo(() => new Set(user?.permissions ?? []), [user])

  /**
   * Super admins arrive with an EMPTY permissions array, so the normal check
   * would deny everything and leave them staring at a blank shell. The flag
   * is the grant.
   */
  const isSuperAdmin = Boolean(user?.isSuperAdmin)

  const hasPermission = useCallback(
    (permission: string) => {
      if (!permission) return true
      if (isSuperAdmin) return true
      if (permissions.has(permission)) return true
      // "cars.manage" implies every cars.* action.
      const [resource] = permission.split('.')
      return resource ? permissions.has(`${resource}.manage`) : false
    },
    [permissions, isSuperAdmin],
  )

  const hasAnyPermission = useCallback(
    (...list: string[]) => list.length === 0 || list.some(hasPermission),
    [hasPermission],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      // Only "initialising" while the very first restore is pending.
      isInitialising: sessionPossible && isLoading && !isFetched,
      isAuthenticated: Boolean(user),
      login,
      logout,
      isSuperAdmin,
      hasPermission,
      hasAnyPermission,
    }),
    [
      user,
      sessionPossible,
      isLoading,
      isFetched,
      login,
      logout,
      isSuperAdmin,
      hasPermission,
      hasAnyPermission,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
