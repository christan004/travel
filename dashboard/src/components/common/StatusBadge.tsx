import { Badge, type BadgeProps } from '@/components/ui/badge'
import type { RecordStatus, TicketStatus, TripStopStatus } from '@/types/entities'

type Variant = NonNullable<BadgeProps['variant']>

/**
 * Single mapping from every status the API emits to a brand colour, so a
 * "CANCELLED" booking looks the same everywhere it appears.
 */
const STATUS_VARIANTS: Record<string, Variant> = {
  // Tickets
  BOOKED: 'default',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
  REFUNDED: 'warning',

  // Trip stops
  PENDING: 'warning',
  AVAILABLE: 'default',
  CLOSED: 'neutral',
  SKIPPED: 'warning',

  // Generic record status
  active: 'success',
  inactive: 'neutral',
}

/** Title-case an UPPER_SNAKE or lowercase status for display. */
function humanise(status: string): string {
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export interface StatusBadgeProps {
  status: TicketStatus | TripStopStatus | RecordStatus | string | null | undefined
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  if (!status) return <span className="text-muted-foreground">--</span>

  return (
    <Badge variant={STATUS_VARIANTS[status] ?? 'neutral'} className={className}>
      {humanise(status)}
    </Badge>
  )
}
