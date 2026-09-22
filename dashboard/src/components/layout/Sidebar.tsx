import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Bus, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useSidebar } from '@/context/SidebarContext'
import { NAV_GROUPS } from '@/components/layout/nav-items'
import { SidebarItem } from '@/components/layout/SidebarItem'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'

/** Navy brand header shared by the desktop rail and the mobile drawer. */
function SidebarBrand({ isCollapsed }: { isCollapsed: boolean }) {
  return (
    <div
      className={cn(
        'flex h-16 shrink-0 items-center gap-2.5 bg-navy px-4',
        isCollapsed && 'justify-center px-0',
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary">
        <Bus className="size-5 text-primary-foreground" aria-hidden />
      </span>

      {!isCollapsed && (
        <Link to="/" className="min-w-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="block truncate font-heading text-base font-semibold leading-tight text-navy-foreground">
            SwiftBus
          </span>
          <span className="block truncate text-[11px] leading-tight text-navy-foreground/60">
            Travel management
          </span>
        </Link>
      )}
    </div>
  )
}

/**
 * Grouped nav, filtered by the signed-in user's permissions.
 *
 * Groups whose items are all hidden by permissions disappear entirely, so a
 * limited user never sees an empty "Fleet" heading.
 */
function SidebarNav({
  isCollapsed,
  onNavigate,
}: {
  isCollapsed: boolean
  onNavigate?: () => void
}) {
  const { hasPermission, isSuperAdmin } = useAuth()

  const visibleGroups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          // Flag-gated items are never shown to company admins, even though
          // a super admin's hasPermission returns true for everything.
          if (item.superAdminOnly) return isSuperAdmin
          return !item.permission || hasPermission(item.permission)
        }),
      })).filter((group) => group.items.length > 0),
    [hasPermission, isSuperAdmin],
  )

  return (
    <nav
      aria-label="Main navigation"
      className="flex-1 space-y-4 overflow-y-auto px-3 py-4 scrollbar-none"
    >
      {visibleGroups.map((group, index) => (
        <div key={group.title ?? `group-${index}`} className="space-y-1">
          {group.title &&
            (isCollapsed ? (
              // A heading cannot fit on the rail; a rule keeps the grouping legible.
              <div className="mx-auto my-2 h-px w-6 bg-border" aria-hidden />
            ) : (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </p>
            ))}

          {group.items.map((item) => (
            <SidebarItem
              key={item.to}
              item={item}
              isCollapsed={isCollapsed}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
    </nav>
  )
}

/**
 * Responsive sidebar.
 *
 * Desktop (lg+): a fixed rail that toggles between 16rem and 4.5rem.
 * Mobile: the same content inside an off-canvas Sheet driven by SidebarContext.
 */
export function Sidebar() {
  const { isCollapsed, toggleCollapsed, isMobileOpen, setMobileOpen, closeMobile } = useSidebar()

  return (
    <>
      {/* ---------------------------- Desktop ---------------------------- */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-card transition-[width] duration-200 lg:flex',
          isCollapsed ? 'w-[4.5rem]' : 'w-64',
        )}
      >
        <SidebarBrand isCollapsed={isCollapsed} />
        <SidebarNav isCollapsed={isCollapsed} />

        <div className="border-t border-border p-3">
          <Button
            variant="ghost"
            size={isCollapsed ? 'icon' : 'sm'}
            onClick={toggleCollapsed}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn('w-full text-muted-foreground', isCollapsed && 'mx-auto w-10')}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="size-[18px]" />
            ) : (
              <>
                <PanelLeftClose className="size-[18px]" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>

      {/* ----------------------------- Mobile ---------------------------- */}
      <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0" hideClose>
          {/* Radix requires a title for accessibility even when visually hidden. */}
          <SheetTitle className="sr-only">SwiftBus navigation</SheetTitle>
          <div className="flex h-full flex-col">
            <SidebarBrand isCollapsed={false} />
            <SidebarNav isCollapsed={false} onNavigate={closeMobile} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
