import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Search, Ticket as TicketIcon, X } from 'lucide-react'
import { cn, toNumber } from '@/lib/utils'
import { tripSalesApi } from '@/api/resources'
import { useResourceList } from '@/hooks/useResource'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable, type Column } from '@/components/common/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { TicketStatus, TripSalesRow } from '@/types/entities'

const PAGE_SIZE = 20

/** Only statuses that actually appear are rendered, so this is a lookup. */
export const TICKET_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Pending payment',
  BOOKED: 'Booked',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
  REFUNDED: 'Refunded',
  EXPIRED: 'Expired',
}

/** Sold vs lost: booked money is real, expired and cancelled are not. */
export const TICKET_STATUS_TONE: Record<string, string> = {
  BOOKED: 'bg-primary',
  COMPLETED: 'bg-primary-hover',
  PENDING_PAYMENT: 'bg-warning',
  EXPIRED: 'bg-border',
  CANCELLED: 'bg-destructive',
  REFUNDED: 'bg-muted-foreground',
}

export function formatMoney(amount: unknown, currency: string | null | undefined): string {
  return `${toNumber(amount as string).toLocaleString()} ${currency ?? 'RWF'}`
}

const dateTime = (iso: string | null | undefined) => {
  if (!iso) return '--'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--'
  // UTC: these are wall-clock times, not instants. See lib/utils formatDateTime.
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

/** A proportional bar of ticket statuses - the shape of a trip's sales. */
export function StatusBar({
  byStatus,
  total,
}: {
  byStatus: Partial<Record<TicketStatus, number>>
  total: number
}) {
  const entries = Object.entries(byStatus).filter(([, n]) => (n ?? 0) > 0)
  if (!entries.length || total <= 0) return null

  return (
    <div className="flex items-center gap-2">
      <span className="flex h-1.5 w-24 overflow-hidden rounded-full bg-border" aria-hidden>
        {entries.map(([status, count]) => (
          <span
            key={status}
            className={cn('h-full', TICKET_STATUS_TONE[status] ?? 'bg-border')}
            style={{ width: `${((count ?? 0) / total) * 100}%` }}
          />
        ))}
      </span>
      <span className="sr-only">
        {entries
          .map(([status, count]) => `${count} ${TICKET_STATUS_LABEL[status] ?? status}`)
          .join(', ')}
      </span>
      <span className="text-xs text-muted-foreground" aria-hidden>
        {entries.map(([status, count]) => `${count} ${TICKET_STATUS_LABEL[status] ?? status}`).join(' · ')}
      </span>
    </div>
  )
}

/**
 * Ticket sales, one row per trip.
 *
 * GET /tickets/trips returns each trip with a `summary` - tickets sold,
 * seats, revenue and a per-status breakdown - which is the shape a sales
 * report wants. The old flat /tickets list could not answer "how did this
 * departure do" without the caller aggregating it.
 *
 * `?startDate=`/`?endDate=` filter by DEPARTURE here (verified: two trips
 * created the same day, only the one departing 23 Sept survived
 * `startDate=2026-09-23`). That differs from /trips, where the same params
 * filter createdAt - so this filter is labelled "Departing", truthfully.
 */
export function TicketsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v)

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(isDate(startDate) ? { startDate } : {}),
      ...(isDate(endDate) ? { endDate } : {}),
    }),
    [page, search, startDate, endDate],
  )

  const { data, isLoading, error, refetch } = useResourceList(tripSalesApi, params)
  const rows = useMemo(() => (data?.items ?? []) as TripSalesRow[], [data?.items])

  /** Totals across the page, so the header answers the obvious question. */
  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          tickets: acc.tickets + (row.summary?.total ?? 0),
          seats: acc.seats + (row.summary?.seats ?? 0),
          revenue: acc.revenue + toNumber(row.summary?.revenue),
          currency: acc.currency ?? row.summary?.currency ?? null,
        }),
        { tickets: 0, seats: 0, revenue: 0, currency: null as string | null },
      ),
    [rows],
  )

  const columns = useMemo<Array<Column<TripSalesRow>>>(
    () => [
      {
        id: 'trip',
        header: 'Trip',
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {row.route?.name ?? 'Trip'}
            </p>
            {row.route?.fromLocation && row.route?.toLocation && (
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                {row.route.fromLocation.name}
                <ArrowRight className="size-3 shrink-0" aria-hidden />
                {row.route.toLocation.name}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'departure',
        header: 'Departs',
        cell: (row) => (
          <div className="min-w-0 whitespace-nowrap">
            <p className="text-sm text-foreground">{dateTime(row.departureAt)}</p>
            {row.arrivalAt && (
              <p className="text-xs text-muted-foreground">
                arrives {dateTime(row.arrivalAt)}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'vehicle',
        header: 'Vehicle',
        cell: (row) => {
          const car = row.vehicle?.car
          const driver = row.vehicle?.driver
          if (!car && !driver) return <span className="text-muted-foreground">--</span>
          return (
            <div className="min-w-0">
              {driver && (
                <p className="truncate text-sm text-foreground">
                  {driver.firstName} {driver.lastName}
                </p>
              )}
              {car && (
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {car.plateNumber}
                </p>
              )}
            </div>
          )
        },
      },
      {
        id: 'sold',
        header: 'Sold',
        cell: (row) => {
          const summary = row.summary
          const capacity = row.vehicle?.car?.totalSeats
          return (
            <div className="min-w-0">
              <p className="text-sm tabular-nums text-foreground">
                {summary?.seats ?? 0}
                {capacity ? (
                  <span className="text-muted-foreground"> / {capacity} seats</span>
                ) : (
                  <span className="text-muted-foreground"> seats</span>
                )}
              </p>
              <StatusBar byStatus={summary?.byStatus ?? {}} total={summary?.total ?? 0} />
            </div>
          )
        },
      },
      {
        id: 'revenue',
        header: 'Revenue',
        className: 'text-right',
        headerClassName: 'text-right',
        cell: (row) => (
          <span className="whitespace-nowrap font-medium tabular-nums text-foreground">
            {formatMoney(row.summary?.revenue, row.summary?.currency)}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => (
          <Badge variant={row.status === 'active' ? 'success' : 'neutral'}>
            {row.status === 'active' ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
    ],
    [],
  )

  const hasFilters = Boolean(search.trim() || startDate || endDate)
  const resetFilters = () => {
    setSearch('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ticket sales"
        description="What each departure sold, and what it earned."
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="relative flex-1 lg:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search trips..."
            aria-label="Search trips"
            className="pl-9"
          />
        </div>

        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="startDate" className="text-xs">
              Departing from
            </Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => {
                setStartDate(event.target.value)
                setPage(1)
              }}
              className="sm:w-40"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endDate" className="text-xs">
              to
            </Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => {
                setEndDate(event.target.value)
                setPage(1)
              }}
              className="sm:w-40"
            />
          </div>
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <X className="size-4" />
            Clear
          </Button>
        )}
      </div>

      {rows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Revenue on this page</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {formatMoney(totals.revenue, totals.currency)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Tickets</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {totals.tickets.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Seats taken</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {totals.seats.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        error={error as Error | null}
        onRetry={() => void refetch()}
        onRowClick={(row) => navigate(`/tickets/${row.id}`)}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle={hasFilters ? 'No matching departures' : 'No ticket sales yet'}
        emptyDescription={
          hasFilters
            ? 'Try a different date range or search term.'
            : 'Sales appear here once tickets are sold against a trip.'
        }
        emptyAction={
          hasFilters ? (
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Clear filters
            </Button>
          ) : undefined
        }
      />

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <TicketIcon className="size-3" aria-hidden />
        Select a departure to see every ticket, seat and payment on it.
      </p>
    </div>
  )
}
