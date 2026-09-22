import { useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bell, LogOut, Menu, Search, Settings, User as UserIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn, initials } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useSidebar } from '@/context/SidebarContext'
import { NAV_ITEMS } from '@/components/layout/nav-items'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/** Resolve the current page title from the nav table. */
function usePageTitle(): string {
  const { pathname } = useLocation()

  return useMemo(() => {
    if (pathname === '/') return 'Dashboard'
    const match = NAV_ITEMS.find((item) => item.to !== '/' && pathname.startsWith(item.to))
    return match?.label ?? 'SwiftBus'
  }, [pathname])
}

export function Topbar() {
  const { openMobile } = useSidebar()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const title = usePageTitle()

  // Placeholder until a notifications endpoint exists.
  const unreadCount = 0

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Signed out')
    } catch {
      toast.error('Could not sign out cleanly, but your session was cleared.')
    } finally {
      navigate('/login', { replace: true })
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card px-4 sm:px-6">
      {/* Mobile drawer trigger */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={openMobile}
        aria-label="Open navigation menu"
      >
        <Menu className="size-5" />
      </Button>

      {/*
        A breadcrumb, not the page heading: PageHeader owns the <h1>, so this
        must not be one too - two h1s per page confuses assistive technology.
      */}
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-base font-semibold text-foreground sm:text-lg"
          aria-hidden
        >
          {title}
        </p>
      </div>

      {/* Search is presentational until the API exposes a global search. */}
      <div className="relative hidden max-w-xs flex-1 md:block">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          placeholder="Search..."
          aria-label="Search"
          className="h-9 bg-background pl-9"
        />
      </div>

      <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
        <Bell className="size-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-muted',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            )}
            aria-label="Account menu"
          >
            <Avatar>
              <AvatarFallback>{initials(user?.firstName, user?.lastName)}</AvatarFallback>
            </Avatar>
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block truncate text-sm font-medium leading-tight text-foreground">
                {user ? `${user.firstName} ${user.lastName}` : 'Account'}
              </span>
              <span className="block truncate text-xs leading-tight text-muted-foreground">
                {user?.email ?? ''}
              </span>
            </span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium">
              {user ? `${user.firstName} ${user.lastName}` : 'Signed in'}
            </p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link to="/settings">
              <UserIcon />
              Profile
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link to="/settings">
              <Settings />
              Settings
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={(event) => {
              // Keep the menu from closing before the async work starts.
              event.preventDefault()
              void handleLogout()
            }}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
