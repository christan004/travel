import { Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/context/SidebarContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

/**
 * Authenticated application frame.
 *
 * The main column is offset by the rail width on desktop and sits full-width
 * on mobile, where the sidebar is a drawer instead.
 */
export function AppShell() {
  const { isCollapsed } = useSidebar()

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding] duration-200',
          isCollapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-64',
        )}
      >
        <Topbar />

        <main className="flex-1 p-4 sm:p-6">
          {/* Scoped per-page: a feature crash must not take down the shell. */}
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
