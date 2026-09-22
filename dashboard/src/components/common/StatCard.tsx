import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  /** Signed percentage change vs. the previous period. */
  trend?: number
  trendLabel?: string
  isLoading?: boolean
  /** Accent colour for the icon chip. */
  tone?: 'primary' | 'navy' | 'warning' | 'destructive'
  className?: string
}

const TONE_STYLES: Record<NonNullable<StatCardProps['tone']>, string> = {
  primary: 'bg-primary-light text-primary',
  navy: 'bg-navy/10 text-navy',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
}

/** KPI tile for the dashboard overview. */
export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendLabel = 'vs last period',
  isLoading = false,
  tone = 'primary',
  className,
}: StatCardProps) {
  const hasTrend = typeof trend === 'number' && Number.isFinite(trend)
  const isPositive = hasTrend && trend >= 0

  return (
    <Card className={cn('p-5 transition-shadow hover:shadow-card-hover', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-muted-foreground">{label}</p>

          {isLoading ? (
            <Skeleton className="mt-2 h-8 w-28" />
          ) : (
            <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-foreground">
              {value}
            </p>
          )}
        </div>

        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', TONE_STYLES[tone])}>
          <Icon className="size-5" aria-hidden />
        </span>
      </div>

      {hasTrend && !isLoading && (
        <div className="mt-3 flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium',
              isPositive ? 'bg-primary-light text-primary-hover' : 'bg-destructive/10 text-destructive',
            )}
          >
            {isPositive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
          <span className="truncate text-xs text-muted-foreground">{trendLabel}</span>
        </div>
      )}
    </Card>
  )
}
