import type { ReactNode } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/toaster'

/**
 * App-wide presentation concerns: tooltip timing and the toast outlet.
 *
 * SwiftBus ships light-only for now. The CSS variables in styles/index.css
 * are already structured for a dark palette, so adding one is a matter of
 * defining the .dark block and toggling the class here.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={300}>
      {children}
      <Toaster />
    </TooltipProvider>
  )
}
