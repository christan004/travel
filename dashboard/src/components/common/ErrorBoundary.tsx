import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { env } from '@/config/env'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Catches render-time crashes so one broken feature cannot blank the whole
 * app. Data-fetching errors are handled by React Query instead - this is
 * strictly the last line of defence.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Replace with a real reporter (Sentry et al.) when one is available.
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  private readonly handleReset = () => {
    this.setState({ error: null })
  }

  override render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-md p-8 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-6 text-destructive" />
          </span>

          <h2 className="mt-4 text-lg font-semibold text-foreground">Something went wrong</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            This page hit an unexpected error. Try again, or reload if it keeps happening.
          </p>

          {env.isDev && (
            <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-muted p-3 text-left text-xs text-destructive">
              {error.message}
            </pre>
          )}

          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={this.handleReset}>
              Try again
            </Button>
            <Button onClick={() => window.location.reload()}>Reload page</Button>
          </div>
        </Card>
      </div>
    )
  }
}
