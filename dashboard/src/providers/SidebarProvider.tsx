import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { SidebarContext, type SidebarContextValue } from '@/context/SidebarContext'

const STORAGE_KEY = 'swiftbus.sidebar.collapsed'

/** Read the persisted rail state, tolerating disabled/blocked storage. */
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Pure UI state - deliberately useState, not React Query. Collapsed state
 * persists across reloads; the mobile drawer intentionally does not.
 */
export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isCollapsed))
    } catch {
      // Private mode or blocked storage: the preference is simply not kept.
    }
  }, [isCollapsed])

  const toggleCollapsed = useCallback(() => setIsCollapsed((prev) => !prev), [])
  const openMobile = useCallback(() => setIsMobileOpen(true), [])
  const closeMobile = useCallback(() => setIsMobileOpen(false), [])

  const value = useMemo<SidebarContextValue>(
    () => ({
      isCollapsed,
      toggleCollapsed,
      isMobileOpen,
      openMobile,
      closeMobile,
      setMobileOpen: setIsMobileOpen,
    }),
    [isCollapsed, toggleCollapsed, isMobileOpen, openMobile, closeMobile],
  )

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
}
