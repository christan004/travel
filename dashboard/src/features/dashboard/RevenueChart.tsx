import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCompact, formatCurrency } from '@/lib/utils'
import type { RevenuePoint } from '@/types/entities'

interface RevenueChartProps {
  data: RevenuePoint[]
  currency: string
}

/** Brand green; recharts needs a concrete colour, not a CSS variable. */
const GREEN = '#1F8A58'

interface TooltipPayloadItem {
  payload: RevenuePoint
}

function ChartTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  currency: string
}) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  if (!point) return null

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-card-hover">
      <p className="text-xs font-medium text-muted-foreground">{point.label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">
        {formatCurrency(point.revenue, currency)}
      </p>
      <p className="text-xs text-muted-foreground">
        {point.bookings} booking{point.bookings === 1 ? '' : 's'}
      </p>
    </div>
  )
}

export function RevenueChart({ data, currency }: RevenueChartProps) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GREEN} stopOpacity={0.22} />
              <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" vertical={false} />

          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#667085', fontSize: 12 }}
            dy={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#667085', fontSize: 12 }}
            tickFormatter={(value: number) => formatCompact(value)}
            width={56}
          />

          <Tooltip
            content={<ChartTooltip currency={currency} />}
            cursor={{ stroke: GREEN, strokeWidth: 1, strokeDasharray: '4 4' }}
          />

          <Area
            type="monotone"
            dataKey="revenue"
            stroke={GREEN}
            strokeWidth={2.5}
            fill="url(#revenueFill)"
            dot={false}
            activeDot={{ r: 5, fill: GREEN, stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
