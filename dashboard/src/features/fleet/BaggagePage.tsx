import { useMemo, useState } from 'react'
import { MoreHorizontal, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { cn, toNumber } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { baggageApi, carsApi } from '@/api/resources'
import {
  useDeleteResource,
  useLookup,
  useResourceList,
  useUpdateResource,
} from '@/hooks/useResource'
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
import { BaggageFormDialog } from '@/features/fleet/BaggageFormDialog'
import { BaggageEditDialog } from '@/features/fleet/BaggageEditDialog'
import type { Baggage } from '@/types/entities'

const ALL = 'all'


/**
 * Luggage compartments.
 *
 * GET /api/v1/baggage returns flat rows - one per compartment, each with a
 * `carId` - so this is a normal table with a vehicle filter, not a
 * car-first drill-down like Seats.
 *
 * Creation is the exception: POST takes a discriminated body (one weight for
 * every slot, or a weight per slot) which the API expands into these rows.
 * See BaggageFormDialog.
 */
export function BaggagePage() {
  const { hasPermission } = useAuth()

  const [page, setPage] = useState(1)
  const [carFilter, setCarFilter] = useState<string>(ALL)
  const [search, setSearch] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Baggage | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Baggage | null>(null)

  const params = useMemo(() => ({ page, limit: 20 }), [page])
  const { data, isLoading, error, refetch } = useResourceList(baggageApi, params)

  // Cars supply readable labels for `carId` and the filter options.
  const { data: carsPage } = useLookup(carsApi)
  const carById = useMemo(
    () => new Map((carsPage?.items ?? []).map((car) => [car.id, car])),
    [carsPage?.items],
  )

  const updateBaggage = useUpdateResource(baggageApi, 'Compartment')
  const deleteBaggage = useDeleteResource(baggageApi, 'Compartment')

  const canCreate = hasPermission('baggage.create')
  const canUpdate = hasPermission('baggage.update')
  const canDelete = hasPermission('baggage.delete')

  const rows = useMemo(() => {
    let items = (data?.items ?? []) as Baggage[]

    // The endpoint has no carId filter, so narrow client-side.
    if (carFilter !== ALL) items = items.filter((row) => row.carId === carFilter)

    const term = search.trim().toLowerCase()
    if (term) {
      items = items.filter((row) => {
        const car = carById.get(row.carId)
        return (
          car?.model?.toLowerCase().includes(term) ||
          car?.plateNumber?.toLowerCase().includes(term) ||
          String(row.number).includes(term)
        )
      })
    }

    return items
  }, [data?.items, carFilter, search, carById])

  const toggle = async (row: Baggage) => {
    if (!canUpdate || pendingId) return

    setPendingId(row.id)
    try {
      await updateBaggage.mutateAsync({
        id: row.id,
        payload: { status: row.status === 'active' ? 'inactive' : 'active' },
      })
    } finally {
      setPendingId(null)
    }
  }

  const columns = useMemo<Array<Column<Baggage>>>(
    () => [
      {
        id: 'number',
        header: 'Slot',
        cell: (row) => (
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-primary-light text-xs font-semibold text-primary-hover">
            {row.number}
          </span>
        ),
      },
      {
        id: 'car',
        header: 'Vehicle',
        cell: (row) => {
          const car = carById.get(row.carId)
          if (!car) {
            // Outside the 100-row lookup page; show the tail of the id.
            return (
              <span className="font-mono text-xs text-muted-foreground">
                {row.carId.slice(-8)}
              </span>
            )
          }
          return (
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{car.model}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {car.plateNumber}
              </p>
            </div>
          )
        },
      },
      {
        id: 'maxWeight',
        header: 'Max weight',
        className: 'text-right',
        headerClassName: 'text-right',
        cell: (row) => (
          <span className="font-medium tabular-nums">
            {toNumber(row.maxWeight).toLocaleString()} kg
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => {
          const isActive = row.status === 'active'
          const badge = (
            <Badge variant={isActive ? 'success' : 'neutral'}>
              {isActive ? 'Active' : 'Inactive'}
            </Badge>
          )

          if (!canUpdate) return badge

          return (
            <button
              type="button"
              onClick={() => void toggle(row)}
              disabled={Boolean(pendingId)}
              // State plus action, so it is usable without seeing the colour.
              aria-label={`Slot ${row.number}, ${row.status}. Mark as ${
                isActive ? 'inactive' : 'active'
              }.`}
              className={cn(
                'rounded-full transition-opacity',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                pendingId === row.id && 'opacity-50',
                pendingId ? 'cursor-wait' : 'hover:opacity-80',
              )}
            >
              {badge}
            </button>
          )
        },
      },
      ...(canUpdate || canDelete
        ? [
            {
              id: 'actions',
              header: <span className="sr-only">Actions</span>,
              className: 'w-12 text-right',
              cell: (row: Baggage) => (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Actions for slot ${row.number}`}
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
            } satisfies Column<Baggage>,
          ]
        : []),
    ],
    // `toggle` is stable enough for this table; re-created only on permission
    // or pending changes, which are exactly when the cells must re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [carById, canUpdate, canDelete, pendingId],
  )

  const carOptions = useMemo(
    () =>
      (carsPage?.items ?? []).map((car) => ({
        label: `${car.model} - ${car.plateNumber}`,
        value: car.id,
      })),
    [carsPage?.items],
  )

  const hasFilters = carFilter !== ALL || search.trim().length > 0
  const resetFilters = () => {
    setCarFilter(ALL)
    setSearch('')
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Baggage"
        description="Luggage compartments and their weight limits."
        actions={
          canCreate ? (
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="size-4" />
              Add baggage
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
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search this page..."
            aria-label="Search compartments on the current page"
            className="pl-9"
          />
        </div>

        <Select value={carFilter} onValueChange={setCarFilter}>
          <SelectTrigger className="sm:w-64" aria-label="Filter by vehicle">
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

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <X className="size-4" />
            Clear
          </Button>
        )}
      </div>

      {canUpdate && rows.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Click a status badge to take a compartment in or out of service.
        </p>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        error={error as Error | null}
        onRetry={() => void refetch()}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle={hasFilters ? 'No matching compartments' : 'No baggage configured'}
        emptyDescription={
          hasFilters
            ? 'Try a different vehicle or search term.'
            : 'Add luggage capacity to a vehicle to see it here.'
        }
        emptyAction={
          hasFilters ? (
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Clear filters
            </Button>
          ) : canCreate ? (
            <Button size="sm" onClick={() => setIsFormOpen(true)}>
              <Plus className="size-4" />
              Add baggage
            </Button>
          ) : undefined
        }
      />

      <BaggageFormDialog open={isFormOpen} onOpenChange={setIsFormOpen} />

      <BaggageEditDialog
        baggage={editing}
        car={editing ? (carById.get(editing.carId) ?? null) : null}
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      />

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this compartment?</DialogTitle>
            <DialogDescription>
              Slot {pendingDelete?.number} (
              {toNumber(pendingDelete?.maxWeight).toLocaleString()} kg) will be permanently
              removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteBaggage.isPending}
              onClick={async () => {
                if (!pendingDelete) return
                try {
                  await deleteBaggage.mutateAsync(pendingDelete.id)
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
