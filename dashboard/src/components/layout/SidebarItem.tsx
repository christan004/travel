import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { NavItem } from '@/components/layout/nav-items'

export interface SidebarItemProps {
  item: NavItem
  /** Icon-only rail mode; the label is moved into a tooltip. */
  isCollapsed: boolean
  onNavigate?: () => void
}

/**
 * A single nav row.
 *
 * `end` is set for the dashboard so "/" does not stay active on every child
 * route. Active styling is the brand green on a light-green surface, plus a
 * left indicator bar.
 */
export function SidebarItem({ item, isCollapsed, onNavigate }: SidebarItemProps) {
  const { icon: Icon, label, to } = item

  const link = (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card',
          isCollapsed && 'justify-center px-0',
          isActive
            ? 'bg-primary-light text-primary-hover'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Green indicator bar on the active row. */}
          {isActive && (
            <span
              className={cn(
                'absolute left-0 h-6 w-1 rounded-r-full bg-primary',
                isCollapsed && '-left-2',
              )}
              aria-hidden
            />
          )}

          <Icon className={cn('size-[18px] shrink-0', isActive && 'text-primary')} aria-hidden />

          {!isCollapsed && <span className="truncate">{label}</span>}
        </>
      )}
    </NavLink>
  )

  // Collapsed rail relies on a tooltip to stay usable.
  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  return link
}
