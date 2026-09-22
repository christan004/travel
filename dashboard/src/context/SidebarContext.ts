import { createContext, useContext } from 'react'

export interface SidebarContextValue {
  /** Desktop: collapsed to an icon-only rail. */
  isCollapsed: boolean
  toggleCollapsed: () => void
  /** Mobile: off-canvas drawer visibility. */
  isMobileOpen: boolean
  openMobile: () => void
  closeMobile: () => void
  setMobileOpen: (open: boolean) => void
}

export const SidebarContext = createContext<SidebarContextValue | null>(null)

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used within <SidebarProvider>')
  return ctx
}
