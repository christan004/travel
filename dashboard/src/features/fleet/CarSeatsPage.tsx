import { useMemo, useState } from 'react'
import { Armchair, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { seatsApi } from '@/api/resources'
import { useResourceList, useUpdateResource } from '@/hooks/useResource'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable, type Column } from '@/components/common/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import type { Car, EmbeddedSeat } from '@/types/entities'

/**
 * GET /api/v1/seats paginates SEATS, but returns them grouped under their
 * car. A car with 28 seats therefore appears on both page 1 (seats 1-20) and
 * page 2 (seats 21-28), and `meta.total` counts seats rather than cars.
 *
 * Requesting the maximum page size collapses that: every car comes back once,
 * with all of its seats. 100 is the API's documented ceiling for `limit`.
 */
const MAX_LIMIT = 100

/**
 * Seat inventory, by vehicle.
 *
 * Reads from /seats rather than /cars: both return the same car-with-seats
 * shape, but /cars caps each embedded `seats` array at 20 regardless of the
 * car's real capacity. /seats?limit=100 returns them all.
 */
export function CarSeatsPage() {
  const { hasPermission } = useAuth()

  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const params = useMemo(() => ({ page: 1, limit: MAX_LIMIT }), [])
  const { data, isLoading, error, refetch } = useResourceList(seatsApi, params)

  /**
   * One entry per car.
   *
   * Even at limit=100 a fleet with more than 100 seats will split a car
   * across pages, so identical cars are merged and their seat arrays
   * concatenated rather than one silently replacing the other.
   */
  const cars = useMemo(() => {
    const byId = new Map<string, Car>()

    for (const car of (data?.items ?? []) as Car[]) {
      const existing = byId.get(car.id)
      if (!existing) {
        byId.set(car.id, { ...car, seats: [...(car.seats ?? [])] })
        continue
      }

      const seen = new Set(existing.seats?.map((seat) => seat.id))
      for (const seat of car.seats ?? []) {
        if (!seen.has(seat.id)) existing.seats?.push(seat)
      }
    }

    return [...byId.values()]
  }, [data?.items])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return cars

    return cars.filter(
      (car) =>
        car.model.toLowerCase().includes(term) ||
        car.plateNumber.toLowerCase().includes(term),
    )
  }, [cars, search])

  /** Re-read the open car from the list so a toggle is reflected immediately. */
  const openCar = useMemo(
    () => (selectedId ? (cars.find((car) => car.id === selectedId) ?? null) : null),
    [selectedId, cars],
  )

  const columns = useMemo<Array<Column<Car>>>(
    () => [
      {
        id: 'car',
        header: 'Vehicle',
        cell: (car) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{car.model}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">{car.plateNumber}</p>
          </div>
        ),
      },
      {
        id: 'seats',
        header: 'Seats',
        className: 'text-right',
        headerClassName: 'text-right',
        cell: (car) => <span className="tabular-nums">{car.seats?.length ?? 0}</span>,
      },
      {
        id: 'active',
        header: 'Active',
        className: 'text-right',
        headerClassName: 'text-right',
        cell: (car) => {
          const seats = car.seats
          if (!seats?.length) return <span className="text-muted-foreground">--</span>

          const active = seats.filter((seat) => seat.status === 'active').length
          return (
            <span className="tabular-nums">
              {active}
              <span className="text-muted-foreground"> / {seats.length}</span>
            </span>
          )
        },
      },
      {
        id: 'preview',
        header: 'Layout',
        cell: (car) => {
          const seats = car.seats
          if (!seats?.length) {
            return <span className="text-xs text-muted-foreground">No seats</span>
          }

          // Rows come from the seat letters; older vehicles have none.
          const rowCount = new Set(
            seats.map((seat) => seat.letter).filter((letter) => letter),
          ).size

          // A compact strip hinting at the layout; the dialog shows it in full.
          const preview = [...seats].sort((a, b) => a.number - b.number).slice(0, 12)
          return (
            <div className="flex items-center gap-1">
              {preview.map((seat) => (
                <span
                  key={seat.id}
                  className={cn(
                    'size-2 rounded-sm',
                    seat.status === 'active' ? 'bg-primary' : 'bg-border',
                  )}
                />
              ))}
              {seats.length > preview.length && (
                <span className="ml-1 text-xs text-muted-foreground">
                  +{seats.length - preview.length}
                </span>
              )}
              {rowCount > 1 && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {rowCount} rows
                </span>
              )}
            </div>
          )
        },
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seats"
        description="Seat inventory by vehicle. Open a vehicle to view and update its seats."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search vehicles..."
            aria-label="Search vehicles"
            className="pl-9"
          />
        </div>

        {search && (
          <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
            <X className="size-4" />
            Clear
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(car) => car.id}
        isLoading={isLoading}
        error={error as Error | null}
        onRetry={() => void refetch()}
        onRowClick={(car) => setSelectedId(car.id)}
        emptyTitle={search ? 'No matching vehicles' : 'No vehicles yet'}
        emptyDescription={
          search
            ? 'Try a different search term.'
            : 'Add a car on the Cars page; its seats appear here.'
        }
      />

      <SeatLayoutDialog
        car={openCar}
        open={Boolean(selectedId)}
        onOpenChange={(open) => !open && setSelectedId(null)}
        canEdit={hasPermission('seats.update')}
      />
    </div>
  )
}

/**
 * Seat grid for one car, with click-to-toggle status.
 *
 * Hand-built rather than generated because the API has no way to list a
 * single car's seats: /seats returns every car with its seats embedded, and
 * only PATCH /seats/{id} addresses one seat. This renders the embedded array
 * and PATCHes a seat at a time.
 */
function SeatLayoutDialog({
  car,
  open,
  onOpenChange,
  canEdit,
}: {
  car: Car | null
  open: boolean
  onOpenChange: (open: boolean) => void
  canEdit: boolean
}) {
  const updateSeat = useUpdateResource(seatsApi, 'Seat')

  // Which seat is mid-request, so only that tile shows a pending state.
  const [pendingId, setPendingId] = useState<string | null>(null)

  const seats = useMemo(
    () => [...(car?.seats ?? [])].sort((a, b) => a.number - b.number),
    [car?.seats],
  )

  /**
   * Seats grouped into their rows, in letter order.
   *
   * Seats sharing a `letter` are one row of the vehicle, and row widths vary
   * (the driver's row and the door row are shorter), so the layout is drawn
   * row by row rather than as a fixed grid - that way it mirrors the actual
   * bus. Vehicles created before rows existed have `letter: null` throughout
   * and fall back to a single block.
   */
  const rows = useMemo(() => {
    const byLetter = new Map<string, typeof seats>()
    for (const seat of seats) {
      const key = seat.letter ?? ''
      const bucket = byLetter.get(key)
      if (bucket) bucket.push(seat)
      else byLetter.set(key, [seat])
    }
    return [...byLetter.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([letter, rowSeats]) => ({ letter, seats: rowSeats }))
  }, [seats])

  /** Widest row, so every row can share one column count and stay aligned. */
  const widestRow = useMemo(
    () => rows.reduce((max, row) => Math.max(max, row.seats.length), 0),
    [rows],
  )

  const hasRows = rows.length > 1 || rows[0]?.letter !== ''

  if (!car) return null

  const activeCount = seats.filter((seat) => seat.status === 'active').length

  const toggle = async (seat: EmbeddedSeat) => {
    if (!canEdit || pendingId) return

    setPendingId(seat.id)
    try {
      await updateSeat.mutateAsync({
        id: seat.id,
        payload: { status: seat.status === 'active' ? 'inactive' : 'active' },
      })
    } finally {
      // The list is invalidated by the mutation, so the grid refreshes from
      // the server rather than from optimistic local state.
      setPendingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{car.model}</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{car.plateNumber}</span> &middot; seat layout
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span>
            <span className="font-semibold text-foreground">{seats.length}</span>{' '}
            <span className="text-muted-foreground">seat{seats.length === 1 ? '' : 's'}</span>
          </span>
          <span>
            <span className="font-semibold text-foreground">{activeCount}</span>{' '}
            <span className="text-muted-foreground">active</span>
          </span>
          {activeCount < seats.length && (
            <span>
              <span className="font-semibold text-foreground">{seats.length - activeCount}</span>{' '}
              <span className="text-muted-foreground">out of service</span>
            </span>
          )}
          {hasRows && (
            <span>
              <span className="font-semibold text-foreground">{rows.length}</span>{' '}
              <span className="text-muted-foreground">
                row{rows.length === 1 ? '' : 's'} ({rows.map((r) => r.seats.length).join('-')})
              </span>
            </span>
          )}
        </div>

        <Separator />

        {seats.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary-light">
              <Armchair className="size-5 text-primary" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">No seats configured</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Seats are created with the vehicle.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* One <ul> per row so each keeps its real width. */}
            <div className="space-y-2 overflow-x-auto">
              {rows.map((row) => (
                <div key={row.letter || 'all'} className="flex items-center gap-3">
                  {hasRows && (
                    <span
                      className="w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground"
                      aria-hidden
                    >
                      {row.letter}
                    </span>
                  )}

                  <ul
                    className="grid flex-1 gap-2"
                    style={{
                      // Shorter rows leave a gap rather than stretching, so
                      // the shape of the vehicle stays readable.
                      gridTemplateColumns: `repeat(${Math.max(widestRow, 1)}, minmax(2rem, 1fr))`,
                    }}
                  >
                    {row.seats.map((seat) => {
                      const isActive = seat.status === 'active'
                      const isPending = pendingId === seat.id
                      const label = seat.letter
                        ? `Seat ${seat.number}, row ${seat.letter}`
                        : `Seat ${seat.number}`

                      const tile = (
                        <span
                          className={cn(
                            'flex aspect-square items-center justify-center rounded-lg border text-sm font-medium tabular-nums transition-colors',
                            isActive
                              ? 'border-primary/20 bg-primary-light text-primary-hover'
                              : 'border-border bg-muted text-muted-foreground line-through',
                            isPending && 'opacity-50',
                          )}
                        >
                          {seat.number}
                        </span>
                      )

                      if (!canEdit) {
                        return (
                          <li key={seat.id} title={`${label} - ${seat.status}`}>
                            {tile}
                          </li>
                        )
                      }

                      return (
                        <li key={seat.id}>
                          <button
                            type="button"
                            onClick={() => void toggle(seat)}
                            disabled={Boolean(pendingId)}
                            // Announce the action, not just the label, so the
                            // toggle is usable without seeing the colour.
                            aria-label={`${label}, ${seat.status}. Mark as ${
                              isActive ? 'inactive' : 'active'
                            }.`}
                            className={cn(
                              'w-full rounded-lg transition-transform',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                              !pendingId && 'hover:scale-105 active:scale-95',
                              pendingId && 'cursor-wait',
                            )}
                          >
                            {tile}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded border border-primary/20 bg-primary-light" />
                  Active
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded border border-border bg-muted" />
                  Inactive
                </span>
              </div>

              <Badge variant="neutral">
                {canEdit ? 'Click a seat to change its status' : 'Read only'}
              </Badge>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
