import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Armchair,
  Briefcase,
  Check,
  ClipboardCheck,
  Clock,
  ShieldCheck,
} from 'lucide-react'
import { cn, toNumber } from '@/lib/utils'
import { tripDetailApi, tripPointsApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { useResourceItem, useResourceList, useUpdateResource } from '@/hooks/useResource'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TripPoint, TripStopStatus } from '@/types/entities'

/**
 * Everything known about one trip.
 *
 * Two requests, because neither endpoint alone is enough:
 *
 *  - GET /trips/{id} carries the depth - operating company, route prices and
 *    segments, the vehicle's product type, seats, baggage, inspections and
 *    insurance - but STRIPS IDS from the nested records, and its `points`
 *    entries contain only `location`: no id, status or times.
 *  - GET /trip-points supplies the timetable with ids, so the stops can be
 *    updated in place.
 *
 * The points list has no `?tripId=` filter, so it is fetched wide and
 * narrowed here. See docs/backend-trips.md.
 */

const STATUS_CHOICES = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Available', value: 'AVAILABLE' },
  { label: 'Closed', value: 'CLOSED' },
  { label: 'Skipped', value: 'SKIPPED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Completed', value: 'COMPLETED' },
]

const TONE: Record<TripStopStatus, string> = {
  PENDING: 'bg-border',
  AVAILABLE: 'bg-primary',
  CLOSED: 'bg-muted-foreground',
  SKIPPED: 'bg-warning',
  CANCELLED: 'bg-destructive',
  COMPLETED: 'bg-primary-hover',
}

const STATUS_LABEL: Record<TripStopStatus, string> = {
  PENDING: 'Pending',
  AVAILABLE: 'Available',
  CLOSED: 'Closed',
  SKIPPED: 'Skipped',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
}

const dateTime = (iso: string | null | undefined) => {
  if (!iso) return '--'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--'
  // UTC: these are wall-clock times, not instants. See formatDateTime.
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
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

const dateOnly = (iso: string | null | undefined) => {
  if (!iso) return '--'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function formatDuration(minutes: number | undefined): string {
  if (!minutes) return '--'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

/** Minutes late (positive) or early (negative) against the schedule. */
function drift(point: TripPoint): number | null {
  const scheduled = point.scheduledArrivalAt ?? point.scheduledDepartureAt
  const actual = point.actualArrivalAt ?? point.actualDepartureAt
  if (!scheduled || !actual) return null
  const diff = new Date(actual).getTime() - new Date(scheduled).getTime()
  if (Number.isNaN(diff)) return null
  return Math.round(diff / 60_000)
}

/** A titled panel; the page is a stack of these. */
function Section({
  title,
  icon,
  count,
  children,
}: {
  title: string
  icon?: React.ReactNode
  count?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon}
          {title}
        </h2>
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

/** One editable stop. */
function Stop({
  point,
  isLast,
  canUpdate,
}: {
  point: TripPoint
  isLast: boolean
  canUpdate: boolean
}) {
  const updatePoint = useUpdateResource(tripPointsApi, 'Trip point')
  const late = drift(point)
  const save = (payload: Record<string, unknown>) =>
    updatePoint.mutateAsync({ id: point.id, payload })

  // Origin has no arrival, destination no departure.
  const canArrive = point.scheduledArrivalAt !== null
  const canDepart = point.scheduledDepartureAt !== null

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center pt-1.5">
        <span
          className={cn('size-2.5 shrink-0 rounded-full', TONE[point.status] ?? 'bg-border')}
          aria-hidden
        />
        {!isLast && <span className="mt-1 w-px flex-1 bg-border" aria-hidden />}
      </div>

      <div className={cn('min-w-0 flex-1', !isLast && 'pb-5')}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">{point.sequence}.</span>
          <span className="font-medium text-foreground">
            {point.location?.name ?? point.locationId.slice(-6)}
          </span>
          {canUpdate ? (
            <Select
              value={point.status}
              onValueChange={(value) => void save({ status: value })}
              disabled={updatePoint.isPending}
            >
              <SelectTrigger
                className="h-7 w-auto gap-1 px-2 py-0 text-xs"
                aria-label={`Status of stop ${point.sequence}, ${
                  STATUS_LABEL[point.status] ?? point.status
                }`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_CHOICES.map((choice) => (
                  <SelectItem key={choice.value} value={choice.value}>
                    {choice.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant={point.status === 'COMPLETED' ? 'success' : 'neutral'}>
              {STATUS_LABEL[point.status] ?? point.status}
            </Badge>
          )}
        </div>

        <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
          {point.scheduledArrivalAt && (
            <div className="flex gap-1">
              <dt>Arrives</dt>
              <dd className="font-medium tabular-nums text-foreground">
                {timeOnly(point.scheduledArrivalAt)}
              </dd>
            </div>
          )}
          {point.scheduledDepartureAt && (
            <div className="flex gap-1">
              <dt>Departs</dt>
              <dd className="font-medium tabular-nums text-foreground">
                {timeOnly(point.scheduledDepartureAt)}
              </dd>
            </div>
          )}
          {(point.actualArrivalAt || point.actualDepartureAt) && (
            <div className="flex gap-1">
              <dt>Actual</dt>
              <dd className="font-medium tabular-nums text-foreground">
                {timeOnly(point.actualArrivalAt ?? point.actualDepartureAt)}
              </dd>
            </div>
          )}
          {late !== null && late !== 0 && (
            <div className={cn('font-medium', late > 0 ? 'text-destructive' : 'text-primary-hover')}>
              {late > 0 ? `${late} min late` : `${Math.abs(late)} min early`}
            </div>
          )}
        </dl>

        {canUpdate && (
          <div className="mt-2 flex flex-wrap gap-2">
            {canArrive && !point.actualArrivalAt && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                loading={updatePoint.isPending}
                onClick={() =>
                  void save({
                    actualArrivalAt: new Date().toISOString(),
                    ...(point.status === 'PENDING' ? { status: 'AVAILABLE' } : {}),
                  })
                }
              >
                <Clock className="size-3" />
                Arrived now
              </Button>
            )}
            {canDepart && !point.actualDepartureAt && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                loading={updatePoint.isPending}
                onClick={() =>
                  void save({
                    actualDepartureAt: new Date().toISOString(),
                    status: 'COMPLETED',
                  })
                }
              >
                <Check className="size-3" />
                Departed now
              </Button>
            )}
            {(point.actualArrivalAt || point.actualDepartureAt) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                loading={updatePoint.isPending}
                onClick={() => void save({ actualArrivalAt: null, actualDepartureAt: null })}
              >
                Clear actual times
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

export function TripDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { hasPermission } = useAuth()
  const canUpdatePoints = hasPermission('trip_points.update')

  const { data: trip, isLoading, error } = useResourceItem(tripDetailApi, id ?? null)

  /**
   * /trip-points has no ?tripId= filter, so fetch wide and narrow locally.
   *
   * `keepPreviousData: false` matters here. By default useResourceList holds
   * the previous page on screen while refetching, which is right for a
   * paginated table but wrong here: after a status edit the pre-edit value
   * would keep rendering through the refetch, so the change looked like it
   * had not applied.
   */
  const { data: pointsPage } = useResourceList(
    tripPointsApi,
    { page: 1, limit: 100 },
    { keepPreviousData: false },
  )
  const points = useMemo(() => {
    const all = (pointsPage?.items ?? []) as TripPoint[]
    return all.filter((p) => p.tripId === id).sort((a, b) => a.sequence - b.sequence)
  }, [pointsPage?.items, id])

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
          <Link to="/trips">
            <ArrowLeft className="size-4" />
            Back to trips
          </Link>
        </Button>
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-card">
          <p className="font-medium text-foreground">This trip could not be loaded</p>
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
  // The detail response strips point ids, so fall back to its locations for
  // display when /trip-points has not resolved yet.
  const fallbackStops = trip.points ?? []
  const intermediate = Math.max(0, (points.length || fallbackStops.length) - 2)

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/trips">
          <ArrowLeft className="size-4" />
          Back to trips
        </Link>
      </Button>

      <PageHeader
        title={route?.name ?? 'Trip'}
        description={
          route?.fromLocation?.name && route?.toLocation?.name
            ? `${route.fromLocation.name} to ${route.toLocation.name}`
            : 'Scheduled run'
        }
        actions={
          <Badge variant={trip.status === 'active' ? 'success' : 'neutral'}>
            {trip.status === 'active' ? 'Active' : 'Inactive'}
          </Badge>
        }
      />

      <Section title="Schedule">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Departs">{dateTime(trip.departureAt)}</Field>
          <Field label="Arrives">{dateTime(trip.arrivalAt)}</Field>
          <Field label="Duration">{formatDuration(route?.estimatedTimeInMinutes)}</Field>
          <Field label="Distance">
            {route?.distance ? `${toNumber(route.distance).toLocaleString()} km` : '--'}
          </Field>
        </dl>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Driver and vehicle">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Driver">
              {driver ? `${driver.firstName} ${driver.lastName}` : '--'}
            </Field>
            <Field label="Phone">{driver?.phoneNumber ?? '--'}</Field>
            <Field label="Licence">{driver?.licenseNumber ?? '--'}</Field>
            <Field label="Category">{driver?.category ?? '--'}</Field>
            <Field label="Vehicle">{car?.model ?? '--'}</Field>
            <Field label="Plate">
              <span className="font-mono">{car?.plateNumber ?? '--'}</span>
            </Field>
            <Field label="Type">{car?.product?.type ?? '--'}</Field>
            <Field label="Tank">
              {car?.tankCapacity ? `${toNumber(car.tankCapacity).toLocaleString()} L` : '--'}
            </Field>
          </dl>
        </Section>

        <Section title="Capacity">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Seats">
              <span className="inline-flex items-center gap-1.5">
                <Armchair className="size-4 text-muted-foreground" aria-hidden />
                {car?.seats?.length ?? car?.totalSeats ?? '--'}
                {car?.seats?.length ? (
                  <span className="text-xs font-normal text-muted-foreground">
                    ({car.seats.filter((s) => s.status === 'active').length} active)
                  </span>
                ) : null}
              </span>
            </Field>
            <Field label="Baggage slots">
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="size-4 text-muted-foreground" aria-hidden />
                {car?.baggage?.length ?? car?.totalWeightSlots ?? '--'}
              </span>
            </Field>
            {car?.baggage?.length ? (
              <Field label="Max weight">
                {car.baggage
                  .map((b) => `${toNumber(b.maxWeight).toLocaleString()} kg`)
                  .join(', ')}
              </Field>
            ) : null}
            <Field label="Tickets sold">{trip.tickets?.length ?? 0}</Field>
          </dl>
        </Section>
      </div>

      <Section
        title="Timetable"
        count={
          points.length
            ? `${points.length} stops${intermediate > 0 ? `, ${intermediate} en route` : ''}`
            : undefined
        }
      >
        {points.length === 0 ? (
          fallbackStops.length > 0 ? (
            <>
              <ol className="space-y-2">
                {fallbackStops.map((stop, index) => (
                  <li
                    key={stop.location?.id ?? index}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="text-xs font-semibold text-muted-foreground">
                      {index + 1}.
                    </span>
                    <span className="text-foreground">{stop.location?.name ?? '--'}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-muted-foreground">
                Loading stop times and statuses...
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No stops recorded for this trip.</p>
          )
        ) : (
          <>
            <ol>
              {points.map((point, index) => (
                <Stop
                  key={point.id}
                  point={point}
                  isLast={index === points.length - 1}
                  canUpdate={canUpdatePoints}
                />
              ))}
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">
              {canUpdatePoints
                ? 'Stops come from the route and cannot be added or removed. Times are stamped when you mark arrival or departure.'
                : 'Stops are generated from the route.'}
            </p>
          </>
        )}
      </Section>

      {route?.segments?.length ? (
        <Section title="Route segments" count={`${route.segments.length} legs`}>
          <ol className="space-y-2">
            {[...route.segments]
              .sort((a, b) => a.sequence - b.sequence)
              .map((segment) => (
                <li key={segment.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="inline-flex size-6 items-center justify-center rounded-md bg-primary-light text-xs font-semibold text-primary-hover">
                    {segment.sequence}
                  </span>
                  <span className="font-medium text-foreground">
                    {segment.segmentRoute?.name ?? segment.segmentRouteId.slice(-6)}
                  </span>
                  {segment.segmentRoute && (
                    <span className="text-xs text-muted-foreground">
                      {toNumber(segment.segmentRoute.distance).toLocaleString()} km,{' '}
                      {formatDuration(segment.segmentRoute.estimatedTimeInMinutes)}
                    </span>
                  )}
                </li>
              ))}
          </ol>
        </Section>
      ) : null}

      {route?.prices?.length ? (
        <Section title="Fares" count={`${route.prices.length}`}>
          <ul className="space-y-1">
            {route.prices.map((price, index) => (
              <li key={index} className="flex items-center gap-2 text-sm">
                <span className="font-medium tabular-nums text-foreground">
                  {toNumber(price.price).toLocaleString()} {price.currency ?? 'RWF'}
                </span>
                <Badge variant={price.status === 'active' ? 'success' : 'neutral'}>
                  {price.status === 'active' ? 'Active' : 'Inactive'}
                </Badge>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {(car?.controls?.length || car?.CarInsurance?.length) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {car?.CarInsurance?.length ? (
            <Section
              title="Insurance"
              icon={<ShieldCheck className="size-4 text-muted-foreground" aria-hidden />}
            >
              <ul className="space-y-2">
                {car.CarInsurance.map((policy, index) => (
                  <li key={index} className="text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{policy.name}</span>
                      <Badge variant={policy.status === 'active' ? 'success' : 'neutral'}>
                        {policy.status === 'active' ? 'Active' : 'Expired'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {dateOnly(policy.validFrom)} to {dateOnly(policy.validTo)}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {car?.controls?.length ? (
            <Section
              title="Inspections"
              icon={<ClipboardCheck className="size-4 text-muted-foreground" aria-hidden />}
            >
              <ul className="space-y-2">
                {car.controls.map((control, index) => (
                  <li key={index} className="text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{control.location}</span>
                      <Badge variant={control.status === 'active' ? 'success' : 'neutral'}>
                        {control.status === 'active' ? 'Active' : 'Expired'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {dateOnly(control.validFrom)} to {dateOnly(control.validTo)}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
      )}

      {trip.company && (
        <Section title="Operator">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Company">{trip.company.name}</Field>
            <Field label="Phone">{trip.company.phone ?? '--'}</Field>
            <Field label="Email">{trip.company.email ?? '--'}</Field>
            <Field label="Address">{trip.company.address ?? '--'}</Field>
          </dl>
        </Section>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ArrowRight className="size-3" aria-hidden />
        Route, fares and vehicle details are read-only here. Edit them on their own pages.
      </p>
    </div>
  )
}
