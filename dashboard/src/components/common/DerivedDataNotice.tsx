import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Honest banner for screens whose data is not backed by a real endpoint.
 *
 * The SwiftBus API has no stats or transactions resources, so rather than
 * presenting derived/placeholder figures as authoritative, the affected
 * pages say so plainly.
 */
export function DerivedDataNotice({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3',
        className,
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <p className="text-[13px] leading-relaxed text-foreground/80">{children}</p>
    </div>
  )
}
