import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

/**
 * Gate for authenticated routes.
 *
 * Waits for the initial session restore before deciding, so a page refresh
 * with valid cookies does not bounce the user to /login. The attempted
 * location is preserved so login can return them there.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isInitialising } = useAuth()
  const location = useLocation()

  if (isInitialising) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Restoring your session...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
