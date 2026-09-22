import { RouterProvider } from 'react-router-dom'
import { QueryProvider } from '@/providers/QueryProvider'
import { AuthProvider } from '@/providers/AuthProvider'
import { SidebarProvider } from '@/providers/SidebarProvider'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { router } from '@/routes'

/**
 * Provider order matters:
 *   QueryProvider  - AuthProvider reads the cache, so it must be outermost.
 *   AuthProvider   - the session the rest of the tree depends on.
 *   SidebarProvider / ThemeProvider - pure UI concerns.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <AuthProvider>
          <SidebarProvider>
            <ThemeProvider>
              <RouterProvider router={router} />
            </ThemeProvider>
          </SidebarProvider>
        </AuthProvider>
      </QueryProvider>
    </ErrorBoundary>
  )
}
