import { useMemo, useState } from 'react'
import { MoreHorizontal, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { carControlItemApi, carControlsApi, carsApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { useDeleteResource, useLookup, useResourceList } from '@/hooks/useResource'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable, type Column } from '@/components/common/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CarControlFormDialog } from '@/features/fleet/CarControlFormDialog'
import type { Car, CarControl, CarControlGroup } from '@/types/entities'

const ALL = 'all'
const PAGE_SIZE = 20

const dateOnly = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Expiry is what an operator actually scans this table for. */
function expiryNote(validTo: string): { label: string; tone: 'danger' | 'warn' | null } {
  const end = new Date(validTo).getTime()
  if (Number.isNaN(end)) return { label: '', tone: null }

  const days = Math.ceil((end - Date.now()) / 86_400_000)
  if (days < 0) return { label: `Expired ${Math.abs(days)}d ago`, tone: 'danger' }
  if (days <= 30) return { label: `${days}d left`, tone: 'warn' }
  return { label: '', tone: null }
}

/**
 * Technical inspections, grouped by vehicle.
 *
 * GET /car-controls returns one entry per CAR - `{ id, plateNumber, controls }`
 * - so rows are flattened out of those groups before being tabulated.
 *
 * The nested controls carry NO `carId` of their own: the group's `id` IS the
 * car id, and flattening stamps it onto each row. Unlike the car-insurance
 * grouping the group also names its plate, so editing still needs no extra
 * GET-by-id.
 *
 * A car with no inspections comes back with `controls: []`. Those vehicles
 * are surfaced as "never inspected" rather than dropped, since an untested
 * vehicle is exactly what this page exists to catch.
 *
 * `meta.total` counts INSPECTIONS and paging works, so paging is server-side.
 * Two filters are not: `?status=` is validated against `active`|`inactive`
 * while records are `active`|`expired` (so `?status=expired` 400s), and
 * `?carId=` is ignored. Both are applied client-side, within the page.
 */
export function CarControlsPage() {
  const { hasPermission } = useAuth()

  const [page, setPage] = useState(1)
  const [carFilter, setCarFilter] = useState<string>(ALL)
  const [statusFilter, setStatusFilter] = useState<string>(ALL)
  const [search, setSearch] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editing, setEditing] = useState<CarControl | null>(null)
  const [pendingDelete, setPendingDelete] = useState<CarControl | null>(null)

  // search and paging are honoured by the API; status/carId are not.
  const params = useMemo(
    () => ({ page, limit: PAGE_SIZE, search: search.trim() || undefined }),
    [page, search],
  )
  const { data, isLoading, error, refetch } = useResourceList(carControlsApi, params)

  const { data: carsPage } = useLookup(carsApi)
  const cars = useMemo(() => (carsPage?.items ?? []) as Car[], [carsPage?.items])
  const carById = useMemo(() => new Map(cars.map((car) => [car.id, car])), [cars])

  const deleteControl = useDeleteResource(carControlItemApi, 'Inspection')

  const canCreate = hasPermission('car_control.create')
  const canUpdate = hasPermission('car_control.update')
  const canDelete = hasPermission('car_control.delete')

  const groups = useMemo(() => (data?.items ?? []) as CarControlGroup[], [data?.items])

  /** Plates come from the group, so they resolve even outside the car lookup. */
  const plateByCarId = useMemo(
    () => new Map(groups.map((g) => [g.id, g.plateNumber])),
    [groups],
  )

  /** Vehicles returned with `controls: []` - nothing on record for them. */
  const uninspected = useMemo(
    () => groups.filter((g) => (g.controls ?? []).length === 0),
    [groups],
  )

  const rows = useMemo(() => {
    // Nested controls do NOT carry carId - only the enclosing group knows the
    // car, via its own `id`. Stamp it onto each row so the vehicle column,
    // the filter and the edit form all have it.
    let items = groups.flatMap((group) =>
      (group.controls ?? []).map((control) => ({ ...control, carId: group.id })),
    )

    // Both filters are client-side: see the note on this component.
    if (statusFilter !== ALL) items = items.filter((r) => r.status === statusFilter)
    if (carFilter !== ALL) items = items.filter((r) => r.carId === carFilter)

    return items
  }, [groups, statusFilter, carFilter])

  const columns = useMemo<Array<Column<CarControl>>>(
    () => [
      {
        id: 'car',
        header: 'Vehicle',
        cell: (row) => {
          const car = carById.get(row.carId)
          // The enclosing group carries the plate, so it resolves even for
          // cars outside the lookup page. companyCar is the GET-by-id form.
          const plate =
            plateByCarId.get(row.carId) ?? car?.plateNumber ?? row.companyCar?.plateNumber
          if (!car && !plate) {
            // Defensive: every known response shape yields a plate or a
            // carId, but never blank the whole page if one is missing.
            return (
              <span className="font-mono text-xs text-muted-foreground">
                {row.carId ? row.carId.slice(-8) : '--'}
              </span>
            )
          }
          return (
            <div className="min-w-0">
              {car?.model && (
                <p className="truncate font-medium text-foreground">{car.model}</p>
              )}
              <p className="truncate font-mono text-xs text-muted-foreground">{plate}</p>
            </div>
          )
        },
      },
      {
        id: 'location',
        header: 'Inspection centre',
        cell: (row) => <span className="font-medium text-foreground">{row.location}</span>,
      },
      { id: 'from', header: 'Valid from', cell: (row) => dateOnly(row.validFrom) },
      {
        id: 'to',
        header: 'Valid to',
        cell: (row) => {
          const note = expiryNote(row.validTo)
          return (
            <div className="min-w-0">
              <p>{dateOnly(row.validTo)}</p>
              {note.label && (
                <p
                  className={
                    note.tone === 'danger'
                      ? 'text-xs font-medium text-destructive'
                      : 'text-xs font-medium text-warning'
                  }
                >
                  {note.label}
                </p>
              )}
            </div>
          )
        },
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => (
          <Badge variant={row.status === 'active' ? 'success' : 'neutral'}>
            {row.status === 'active' ? 'Active' : 'Expired'}
          </Badge>
        ),
      },
      ...(canUpdate || canDelete
        ? [
            {
              id: 'actions',
              header: <span className="sr-only">Actions</span>,
              className: 'w-12 text-right',
              cell: (row: CarControl) => (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Actions for ${row.location}`}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canUpdate && (
                      <DropdownMenuItem onSelect={() => setEditing(row)}>
                        <Pencil />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <DropdownMenuItem
                        onSelect={() => setPendingDelete(row)}
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                      >
                        <Trash2 />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
            } satisfies Column<CarControl>,
          ]
        : []),
    ],
    [carById, plateByCarId, canUpdate, canDelete],
  )

  const carOptions = useMemo(
    () => cars.map((car) => ({ label: `${car.model} - ${car.plateNumber}`, value: car.id })),
    [cars],
  )

  const hasFilters = carFilter !== ALL || statusFilter !== ALL || search.trim().length > 0
  const resetFilters = () => {
    setCarFilter(ALL)
    setStatusFilter(ALL)
    setSearch('')
    setPage(1)
  }

  // Client-side filtering shrinks the page, so report the filtered count
  // rather than the server's total, which would page past empty results.
  const meta =
    statusFilter !== ALL || carFilter !== ALL
      ? { page: 1, limit: PAGE_SIZE, total: rows.length, totalPages: 1 }
      : data?.meta

  return (
    <div className="space-y-6">
      <PageHeader
        title="Car controls"
        description="Technical inspections and their validity."
        actions={
          canCreate ? (
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="size-4" />
              Add inspection
            </Button>
          ) : undefined
        }
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
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search centres..."
            aria-label="Search inspection centres"
            className="pl-9"
          />
        </div>

        <Select
          value={carFilter}
          onValueChange={(v) => {
            setCarFilter(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="sm:w-56" aria-label="Filter by vehicle">
            <SelectValue placeholder="All vehicles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All vehicles</SelectItem>
            {carOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="sm:w-40" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <X className="size-4" />
            Clear
          </Button>
        )}
      </div>

      {uninspected.length > 0 && !hasFilters && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
          <p className="text-sm font-medium text-foreground">
            {uninspected.length === 1
              ? '1 vehicle has no inspection on record'
              : `${uninspected.length} vehicles have no inspection on record`}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {uninspected.map((group) => (
              <span key={group.id} className="font-mono">
                {group.plateNumber}
              </span>
            ))}
          </p>
        </div>
      )}

      {(statusFilter !== ALL || carFilter !== ALL) && (
        <p className="text-xs text-muted-foreground">
          Vehicle and status filters apply to this page of results.
        </p>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        error={error as Error | null}
        onRetry={() => void refetch()}
        meta={meta}
        onPageChange={setPage}
        emptyTitle={hasFilters ? 'No matching inspections' : 'No inspections yet'}
        emptyDescription={
          hasFilters
            ? 'Try a different vehicle, status or search term.'
            : 'Record an inspection to track when it expires.'
        }
        emptyAction={
          hasFilters ? (
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Clear filters
            </Button>
          ) : canCreate ? (
            <Button size="sm" onClick={() => setIsFormOpen(true)}>
              <Plus className="size-4" />
              Add inspection
            </Button>
          ) : undefined
        }
      />

      <CarControlFormDialog
        control={null}
        carOptions={carOptions}
        defaultCarId={carFilter !== ALL ? carFilter : undefined}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
      />

      <CarControlFormDialog
        control={editing}
        carOptions={carOptions}
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      />

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this inspection?</DialogTitle>
            <DialogDescription>
              The record for {pendingDelete?.location} will be permanently removed. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteControl.isPending}
              onClick={async () => {
                if (!pendingDelete) return
                try {
                  await deleteControl.mutateAsync(pendingDelete.id)
                } finally {
                  // Close regardless; the error toast carries the reason.
                  setPendingDelete(null)
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
