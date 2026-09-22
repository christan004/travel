import { useMemo, useState } from 'react'
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { toNumber } from '@/lib/utils'
import { locationsApi, routesApi } from '@/api/resources'
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
import { RouteFormDialog } from '@/features/operations/RouteFormDialog'
import type { Location, TravelRoute } from '@/types/entities'

const ALL = 'all'
const PAGE_SIZE = 20

function formatDuration(minutes: number): string {
  if (!minutes) return '--'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

/**
 * Routes.
 *
 * A hand-written page rather than a ResourceConfig because a route is now one
 * of two shapes: DIRECT (a single hop) or COMPOSITE (a chain of two or more
 * DIRECT routes, sent as a `segments` array). The generic form renderer has
 * no way to express a repeatable sub-form that appears for only one value of
 * another field, nor the chain rules the API enforces - see RouteFormDialog.
 *
 * Composite rows expand in place to show their legs, which read endpoints
 * embed in full (`segments[].segmentRoute`), so no extra fetch is needed.
 */
export function RoutesPage() {
  const { hasPermission } = useAuth()

  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState<string>(ALL)
  const [statusFilter, setStatusFilter] = useState<string>(ALL)
  const [search, setSearch] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editing, setEditing] = useState<TravelRoute | null>(null)
  const [pendingDelete, setPendingDelete] = useState<TravelRoute | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const params = useMemo(
    () => ({ page, limit: PAGE_SIZE, search: search.trim() || undefined }),
    [page, search],
  )
  const { data, isLoading, error, refetch } = useResourceList(routesApi, params)

  const { data: locationsPage } = useLookup(locationsApi)
  const locations = useMemo(
    () => (locationsPage?.items ?? []) as Location[],
    [locationsPage?.items],
  )
  const locationName = useMemo(() => {
    const byId = new Map(locations.map((l) => [l.id, l.name]))
    return (id: string) => byId.get(id) ?? id.slice(-6)
  }, [locations])

  // The segment picker needs every route, not just this page.
  const { data: allRoutesPage } = useLookup(routesApi)
  const allRoutes = useMemo(
    () => (allRoutesPage?.items ?? []) as TravelRoute[],
    [allRoutesPage?.items],
  )

  const deleteRoute = useDeleteResource(routesApi, 'Route')

  const canCreate = hasPermission('routes.create')
  const canUpdate = hasPermission('routes.update')
  const canDelete = hasPermission('routes.delete')

  const rows = useMemo(() => {
    let items = (data?.items ?? []) as TravelRoute[]
    if (typeFilter !== ALL) items = items.filter((r) => r.routeType === typeFilter)
    if (statusFilter !== ALL) items = items.filter((r) => r.status === statusFilter)
    return items
  }, [data?.items, typeFilter, statusFilter])

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const columns = useMemo<Array<Column<TravelRoute>>>(
    () => [
      {
        id: 'name',
        header: 'Route',
        cell: (row) => {
          const isComposite = row.routeType === 'COMPOSITE'
          const count = row.segments?.length ?? 0
          const isOpen = expanded.has(row.id)

          return (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {isComposite && count > 0 ? (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(row.id)}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? 'Hide' : 'Show'} the ${count} segments of ${row.name}`}
                    className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {isOpen ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </button>
                ) : (
                  <span className="size-4" aria-hidden />
                )}
                <span className="truncate font-medium text-foreground">{row.name}</span>
              </div>

              {isComposite && isOpen && (
                <ol className="mt-2 space-y-1 border-l-2 border-primary-light pl-3">
                  {[...(row.segments ?? [])]
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((segment) => (
                      <li
                        key={segment.id}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <span className="font-semibold text-primary-hover">
                          {segment.sequence}.
                        </span>
                        <span className="truncate">
                          {segment.segmentRoute?.name ?? segment.segmentRouteId.slice(-6)}
                        </span>
                        {segment.segmentRoute && (
                          <span className="flex shrink-0 items-center gap-1">
                            ({locationName(segment.segmentRoute.fromLocationId)}
                            <ArrowRight className="size-3" aria-hidden />
                            {locationName(segment.segmentRoute.toLocationId)})
                          </span>
                        )}
                      </li>
                    ))}
                </ol>
              )}
            </div>
          )
        },
      },
      {
        id: 'type',
        header: 'Type',
        cell: (row) =>
          row.routeType === 'COMPOSITE' ? (
            <Badge variant="warning">
              Composite{row.segments?.length ? ` (${row.segments.length})` : ''}
            </Badge>
          ) : (
            <Badge variant="neutral">Direct</Badge>
          ),
      },
      {
        id: 'path',
        header: 'From / To',
        cell: (row) => (
          <span className="flex items-center gap-1.5 text-sm">
            <span className="truncate">{locationName(row.fromLocationId)}</span>
            <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{locationName(row.toLocationId)}</span>
          </span>
        ),
      },
      {
        id: 'distance',
        header: 'Distance',
        className: 'text-right',
        headerClassName: 'text-right',
        cell: (row) => (
          <span className="tabular-nums text-muted-foreground">
            {toNumber(row.distance).toLocaleString()} km
          </span>
        ),
      },
      {
        id: 'duration',
        header: 'Duration',
        cell: (row) => (
          <span className="text-muted-foreground">
            {formatDuration(row.estimatedTimeInMinutes)}
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
      ...(canUpdate || canDelete
        ? [
            {
              id: 'actions',
              header: <span className="sr-only">Actions</span>,
              className: 'w-12 text-right',
              cell: (row: TravelRoute) => (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Actions for ${row.name}`}
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
            } satisfies Column<TravelRoute>,
          ]
        : []),
    ],
    // toggleExpanded is stable enough here; cells re-render on the state it
    // reads (expanded) and on permission changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locationName, expanded, canUpdate, canDelete],
  )

  const hasFilters = typeFilter !== ALL || statusFilter !== ALL || search.trim().length > 0
  const resetFilters = () => {
    setTypeFilter(ALL)
    setStatusFilter(ALL)
    setSearch('')
    setPage(1)
  }

  const meta =
    typeFilter !== ALL || statusFilter !== ALL
      ? { page: 1, limit: PAGE_SIZE, total: rows.length, totalPages: 1 }
      : data?.meta

  return (
    <div className="space-y-6">
      <PageHeader
        title="Routes"
        description="Corridors between two locations, direct or built from other routes."
        actions={
          canCreate ? (
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="size-4" />
              New route
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
            placeholder="Search routes..."
            aria-label="Search routes"
            className="pl-9"
          />
        </div>

        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="sm:w-44" aria-label="Filter by type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            <SelectItem value="DIRECT">Direct</SelectItem>
            <SelectItem value="COMPOSITE">Composite</SelectItem>
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
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <X className="size-4" />
            Clear
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        error={error as Error | null}
        onRetry={() => void refetch()}
        meta={meta}
        onPageChange={setPage}
        emptyTitle={hasFilters ? 'No matching routes' : 'No routes yet'}
        emptyDescription={
          hasFilters
            ? 'Try a different type, status or search term.'
            : 'Create a direct route first; composites are built from those.'
        }
        emptyAction={
          hasFilters ? (
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Clear filters
            </Button>
          ) : canCreate ? (
            <Button size="sm" onClick={() => setIsFormOpen(true)}>
              <Plus className="size-4" />
              New route
            </Button>
          ) : undefined
        }
      />

      <RouteFormDialog
        route={null}
        locations={locations}
        routes={allRoutes}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
      />

      <RouteFormDialog
        route={editing}
        locations={locations}
        routes={allRoutes}
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      />

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this route?</DialogTitle>
            <DialogDescription>
              {pendingDelete?.name} will be permanently removed. Composite routes built from it
              may break. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteRoute.isPending}
              onClick={async () => {
                if (!pendingDelete) return
                try {
                  await deleteRoute.mutateAsync(pendingDelete.id)
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
