import { Toaster as SonnerToaster } from 'sonner'

/**
 * Toast outlet, themed to the SwiftBus palette.
 * Use via `import { toast } from 'sonner'`.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      closeButton
      richColors={false}
      toastOptions={{
        classNames: {
          toast:
            'group rounded-xl border border-border bg-card text-foreground shadow-card-hover text-sm',
          description: 'text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-muted text-muted-foreground',
          success: 'border-primary/30 [&_[data-icon]]:text-primary',
          error: 'border-destructive/30 [&_[data-icon]]:text-destructive',
          warning: 'border-warning/40 [&_[data-icon]]:text-warning',
        },
      }}
    />
  )
}
