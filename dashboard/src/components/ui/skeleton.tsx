import { cn } from '@/lib/utils'

/** Shimmer placeholder used while queries are loading. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-border/70', className)} {...props} />
}

export { Skeleton }
