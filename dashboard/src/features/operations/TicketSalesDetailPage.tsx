import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Armchair, Search, X } from 'lucide-react'
import { cn, toNumber } from '@/lib/utils'
import { tripSalesDetailApi } from '@/api/resources'
import { useResourceItem } from '@/hooks/useResource'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  StatusBar,
  TICKET_STATUS_LABEL,
  formatMoney,
} from '@/features/operations/TicketsPage'
import type { ReportTicket, TripStopStatus } from '@/types/entities'

const ALL = 'all'

/**
 * Every ticket sold on one departure.
 *
 * GET /tickets/trips/{id} returns the trip, its stops, and each ticket with
 * the seats held, the boarding and destination POINTS (not bare ids) and
 * every payment attempt - so this page needs exactly one request.
 *
 * Payments matter as much as tickets here: a ticket can read EXPIRED with a
 * FAILED payment attached, which is the difference between a seat that made
 * money and one that only looked like it would.
 */

const dateTime = (iso: string | null | undefined) => {
  if (!iso) return '--'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--'
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

const timeOnly = (iso: string | null | undefined) => {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}

const TICKET_TONE: Record<string, 'success' | 'warning' | 'neutral' | 'destructive'> = {
  BOOKED: 'success',
  COMPLETED: 'success',
  PENDING_PAYMENT: 'warning',
  EXPIRED: 'neutral',
  CANCELLED: 'destructive',
  REFUNDED: 'neutral',
}

const PAYMENT_TONE: Record<string, 'success' | 'warning' | 'destructive' | 'neutral'> = {
  SUCCESSFUL: 'success',
  PENDING: 'warning',
  FAILED: 'destructive',
  REFUNDED: 'neutral',
}

const STOP_TONE: Record<TripStopStatus, string> = {
  PENDING: 'bg-border',
  AVAILABLE: 'bg-primary',
  CLOSED: 'bg-muted-foreground',
  SKIPPED: 'bg-warning',
  CANCELLED: 'bg-destructive',
  COMPLETED: 'bg-primary-hover',
}

function Section({
  title,
  count,
  children,
}: {
  title: string
  count?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {count && <span className="text-xs text-muted-foreground">{count}</span>}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium text-foreground">{children}</dd>
    </div>
  )
}

/** One sold ticket: who, which seat, which leg, and whether it was paid. */
function TicketCard({ ticket }: { ticket: ReportTicket }) {
  const seats = ticket.ticketSeats?.map((t) => t.seat) ?? []
  // The latest attempt is what decides whether the money arrived.
  const payment = ticket.payments?.[0]

  return (
    <li className="rounded-lg border border-border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{ticket.passengerName}</span>
            <Badge variant={TICKET_TONE[ticket.status] ?? 'neutral'}>
              {TICKET_STATUS_LABEL[ticket.status] ?? ticket.status}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            #{ticket.ticketNumber} · {ticket.passengerPhone}
          </p>
        </div>

        <div className="text-right">
          <p className="font-medium tabular-nums text-foreground">
            {formatMoney(ticket.price, ticket.currency)}
          </p>
          {/* A div, not a p: Badge renders a div and cannot nest inside one. */}
          {payment && (
            <div className="mt-0.5">
              <Badge variant={PAYMENT_TONE[payment.status] ?? 'neutral'}>
                {payment.status}
              </Badge>
            </div>
          )}
        </div>
      </div>

      <dl className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {(ticket.boardingPoint || ticket.destinationPoint) && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <span className="text-foreground">
              {ticket.boardingPoint?.location?.name ?? '--'}
            </span>
            <ArrowRight className="size-3" aria-hidden />
            <span className="text-foreground">
              {ticket.destinationPoint?.location?.name ?? '--'}
            </span>
            {ticket.boardingPoint?.scheduledDepartureAt && (
              <span>({timeOnly(ticket.boardingPoint.scheduledDepartureAt)})</span>
            )}
          </div>
        )}

        {seats.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Armchair className="size-3 text-muted-foreground" aria-hidden />
            {seats.map((seat) => (
              <span
                key={seat.id}
                className="inline-flex items-center rounded bg-primary-light px-1.5 py-0.5 font-medium tabular-nums text-primary-hover"
              >
                {seat.letter ? `${seat.letter}${seat.number}` : seat.number}
              </span>
            ))}
          </div>
        )}

        <span className="text-muted-foreground">Sold {dateTime(ticket.createdAt)}</span>
      </dl>

      {payment?.failureReason && (
        <p className="mt-2 text-xs font-medium text-destructive">
          {payment.provider}: {payment.failureReason}
        </p>
      )}
      {payment?.status === 'SUCCESSFUL' && payment.paidAt && (
        <p className="mt-2 text-xs text-muted-foreground">
          Paid {dateTime(payment.paidAt)} via {payment.provider}
          {payment.payerPhone ? ` (${payment.payerPhone})` : ''}
        </p>
      )}
    </li>
  )
}

export function TicketSalesDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>(ALL)

  const { data: trip, isLoading, error } = useResourceItem(tripSalesDetailApi, id ?? null)

  const tickets = useMemo(() => (trip?.tickets ?? []) as ReportTicket[], [trip?.tickets])

  const filtered = useMemo(() => {
    let items = tickets
    if (statusFilter !== ALL) items = items.filter((t) => t.status === statusFilter)

    const term = search.trim().toLowerCase()
    if (term) {
      items = items.filter(
        (t) =>
          t.passengerName.toLowerCase().includes(term) ||
          t.passengerPhone.includes(term) ||
          t.ticketNumber.includes(term) ||
          (t.ticketSeats ?? []).some((s) =>
            `${s.seat.letter ?? ''}${s.seat.number}`.toLowerCase().includes(term),
          ),
      )
    }
    return items
  }, [tickets, statusFilter, search])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !trip) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline" size="sm">
          <Link to="/tickets">
            <ArrowLeft className="size-4" />
            Back to sales
          </Link>
        </Button>
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-card">
          <p className="font-medium text-foreground">This departure could not be loaded</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {(error as Error | null)?.message ?? 'It may have been deleted.'}
          </p>
        </div>
      </div>
    )
  }

  const route = trip.route
  const car = trip.vehicle?.car
  const driver = trip.vehicle?.driver
  const summary = trip.summary
  const points = [...(trip.points ?? [])].sort((a, b) => a.sequence - b.sequence)
  const statusesPresent = Object.keys(summary?.byStatus ?? {})

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/tickets">
          <ArrowLeft className="size-4" />
          Back to sales
        </Link>
      </Button>

      <PageHeader
        title={route?.name ?? 'Departure'}
        description={
          route?.fromLocation && route?.toLocation
            ? `${route.fromLocation.name} to ${route.toLocation.name} · departs ${dateTime(trip.departureAt)}`
            : `Departs ${dateTime(trip.departureAt)}`
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Revenue</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {formatMoney(summary?.revenue, summary?.currency)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Tickets</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {summary?.total ?? 0}
          </p>
          <StatusBar byStatus={summary?.byStatus ?? {}} total={summary?.total ?? 0} />
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Seats taken</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {summary?.seats ?? 0}
            {car?.totalSeats ? (
              <span className="text-base font-normal text-muted-foreground">
                {' '}
                / {car.totalSeats}
              </span>
            ) : null}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Occupancy</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {car?.totalSeats
              ? `${Math.round(((summary?.seats ?? 0) / car.totalSeats) * 100)}%`
              : '--'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Trip">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Departs">{dateTime(trip.departureAt)}</Field>
            <Field label="Arrives">{dateTime(trip.arrivalAt)}</Field>
            <Field label="Driver">
              {driver ? `${driver.firstName} ${driver.lastName}` : '--'}
            </Field>
            <Field label="Driver phone">{driver?.phoneNumber ?? '--'}</Field>
            <Field label="Vehicle">{car?.model ?? '--'}</Field>
            <Field label="Plate">
              <span className="font-mono">{car?.plateNumber ?? '--'}</span>
            </Field>
            {route && (
              <>
                <Field label="Distance">
                  {toNumber(route.distance).toLocaleString()} km
                </Field>
                <Field label="Route type">
                  {route.routeType === 'COMPOSITE' ? 'Composite' : 'Direct'}
                </Field>
              </>
            )}
          </dl>
        </Section>

        {points.length > 0 && (
          <Section title="Stops" count={`${points.length}`}>
            <ol className="space-y-2">
              {points.map((point) => (
                <li key={point.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      STOP_TONE[point.status] ?? 'bg-border',
                    )}
                    aria-hidden
                  />
                  <span className="text-xs font-semibold text-muted-foreground">
                    {point.sequence}.
                  </span>
                  <span className="truncate text-foreground">
                    {point.location?.name ?? '--'}
                  </span>
                  <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
                    {timeOnly(point.scheduledDepartureAt ?? point.scheduledArrivalAt) ?? '--'}
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        )}
      </div>

      <Section
        title="Tickets"
        count={
          filtered.length === tickets.length
            ? `${tickets.length}`
            : `${filtered.length} of ${tickets.length}`
        }
      >
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Passenger, phone, ticket or seat..."
              aria-label="Search tickets"
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-48" aria-label="Filter by ticket status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {/* Only statuses this trip actually has - no dead options. */}
              {statusesPresent.map((status) => (
                <SelectItem key={status} value={status}>
                  {TICKET_STATUS_LABEL[status] ?? status} (
                  {summary?.byStatus?.[status as keyof typeof summary.byStatus]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(search || statusFilter !== ALL) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('')
                setStatusFilter(ALL)
              }}
            >
              <X className="size-4" />
              Clear
            </Button>
          )}
        </div>

        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {tickets.length === 0
              ? 'No tickets were sold on this departure.'
              : 'No tickets match those filters.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
