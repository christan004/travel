import { Link } from 'react-router-dom'
import { ArrowRight, Banknote, Bus, IdCard, MapPin, Ticket, TrendingUp } from 'lucide-react'
import { formatCurrency, formatDate, formatCompact } from '@/lib/utils'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { DerivedDataNotice } from '@/components/common/DerivedDataNotice'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { RevenueChart } from '@/features/dashboard/RevenueChart'
import { DataTable, type Column } from '@/components/common/DataTable'
import type { Ticket as TicketRow, TopRoute } from '@/types/entities'

const RECENT_COLUMNS: Array<Column<TicketRow>> = [
  {
    id: 'passenger',
    header: 'Passenger',
    cell: (row) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{row.passengerName}</p>
        <p className="truncate text-xs text-muted-foreground">{row.ticketNumber}</p>
      </div>
    ),
  },
  {
    id: 'date',
    header: 'Date',
    cell: (row) => <span className="text-muted-foreground">{formatDate(row.createdAt)}</span>,
  },
  {
    id: 'amount',
    header: 'Amount',
    className: 'text-right',
    headerClassName: 'text-right',
    cell: (row) => (
      <span className="font-medium tabular-nums">
        {formatCurrency(row.price, row.currency ?? 'RWF')}
      </span>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    cell: (row) => <StatusBadge status={row.status} />,
  },
]

function TopRoutesList({
  routes,
  currency,
  isLoading,
}: {
  routes: TopRoute[]
  currency: string
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (routes.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No route activity yet.
      </p>
    )
  }

  // Share of total, not of the leader: with a single route a max-relative bar
  // would always render full width and read as "100% of revenue".
  const total = routes.reduce((sum, r) => sum + r.revenue, 0) || 1

  return (
    <ul className="space-y-4">
      {routes.map((route, index) => (
        <li key={route.routeId} className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-light text-xs font-semibold text-primary-hover">
            {index + 1}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-medium text-foreground">
                {route.name}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  {route.bookings} ticket{route.bookings === 1 ? '' : 's'}
                </span>
              </p>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                {formatCurrency(route.revenue, currency)}
              </p>
            </div>

            {/* Share-of-top-route bar, for quick visual ranking. */}
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max((route.revenue / total) * 100, 4)}%` }}
                />
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {Math.round((route.revenue / total) * 100)}%
              </span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function DashboardPage() {
  const { data, isLoading, error, refetch } = useDashboardStats()
  const currency = data?.currency ?? 'RWF'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Tickets, revenue and network activity at a glance."
        actions={
          <Button variant="outline" asChild>
            <Link to="/tickets">
              View tickets
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      />

      {/* The API has no stats endpoint - be explicit about where these come from. */}
      <DerivedDataNotice>
        These figures are calculated in the browser from the most recent 100 tickets, plus
        counts from routes, trips, cars and drivers, because the API does not expose an
        aggregate statistics endpoint.
        {data?.partial && ' Some sources could not be loaded, so totals may be incomplete.'}
      </DerivedDataNotice>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total tickets"
          value={data ? formatCompact(data.totalBookings) : '--'}
          icon={Ticket}
          isLoading={isLoading}
          tone="primary"
        />
        <StatCard
          label="Revenue"
          value={data ? formatCurrency(data.totalRevenue, currency) : '--'}
          icon={Banknote}
          isLoading={isLoading}
          tone="navy"
        />
        <StatCard
          label="Tickets sold today"
          value={data ? data.seatsSoldToday : '--'}
          icon={TrendingUp}
          isLoading={isLoading}
          tone="primary"
        />
        <StatCard
          label="Active trips"
          value={data ? data.activeTrips : '--'}
          icon={Bus}
          isLoading={isLoading}
          tone="warning"
        />
        <StatCard
          label="Active routes"
          value={data ? data.activeRoutes : '--'}
          icon={MapPin}
          isLoading={isLoading}
          tone="navy"
        />
        <StatCard
          label="Fleet size"
          value={data ? data.totalCars : '--'}
          icon={Bus}
          isLoading={isLoading}
          tone="primary"
        />
        <StatCard
          label="Active drivers"
          value={data ? data.activeDrivers : '--'}
          icon={IdCard}
          isLoading={isLoading}
          tone="warning"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Revenue trend</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Last 6 months</p>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <RevenueChart data={data?.revenueSeries ?? []} currency={currency} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top routes</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">By revenue</p>
          </CardHeader>
          <CardContent>
            <TopRoutesList
              routes={data?.topRoutes ?? []}
              currency={currency}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Recent tickets</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/tickets">
              See all
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <DataTable
          columns={RECENT_COLUMNS}
          rows={data?.recentBookings ?? []}
          getRowId={(row) => row.id}
          isLoading={isLoading}
          error={error as Error | null}
          onRetry={() => void refetch()}
          skeletonRows={5}
          emptyTitle="No tickets yet"
          emptyDescription="New tickets will appear here as they are sold."
        />
      </section>
    </div>
  )
}
