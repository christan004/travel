import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md p-8 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-light">
          <Compass className="size-6 text-primary" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-foreground">Page not found</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          That route does not exist in the SwiftBus dashboard.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Back to dashboard</Link>
        </Button>
      </Card>
    </div>
  )
}
