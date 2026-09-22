import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import type { ResourceClient } from '@/api/resource'
import {
  carsApi,
  driverAssignmentsApi,
  driversApi,
  locationsApi,
  productTypesApi,
  routesApi,
  seatsApi,
  ticketsApi,
  tripsApi,
} from '@/api/resources'
import {
  useCreateResource,
  useDeleteResource,
  useLookup,
  useResourceList,
  useUpdateResource,
} from '@/hooks/useResource'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable, type Column } from '@/components/common/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SelectOption } from '@/components/common/FormSelect'
import { ResourceFormDialog } from '@/features/resource/ResourceFormDialog'
import type {
  LookupContext,
  LookupKey,
  ResourceConfig,
} from '@/features/resource/field-types'

const PAGE_SIZE = 20
const ALL = 'all'

/**
 * Lookup sources, with the label shown for each record. Only the lookups a
 * config actually declares are fetched.
 */
const LOOKUPS: Record<
  LookupKey,
  { client: ResourceClient<never>; toLabel: (row: never) => string }
> = {
  locations: {
    client: locationsApi as never,
    toLabel: (r: { name: string; address: string }) => `${r.name} - ${r.address}`,
  },
  routes: { client: routesApi as never, toLabel: (r: { name: string }) => r.name },
  trips: {
    client: tripsApi as never,
    toLabel: (r: { id: string; departureAt: string }) =>
      `${new Date(r.departureAt).toLocaleString('en-GB', {
        timeZone: 'UTC',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })} (${r.id.slice(-6)})`,
  },
  cars: {
    client: carsApi as never,
    toLabel: (r: { model: string; plateNumber: string }) => `${r.model} - ${r.plateNumber}`,
  },
  drivers: {
    client: driversApi as never,
    toLabel: (r: { firstName: string; lastName: string }) => `${r.firstName} ${r.lastName}`,
  },
  driverAssignments: {
    client: driverAssignmentsApi as never,
    // The list embeds car and driver, so the pairing labels itself. Falls
    // back to the id tail if a future response drops those.
    toLabel: (r: {
      id: string
      car?: { plateNumber: string }
      driver?: { firstName: string; lastName: string }
    }) =>
      r.driver && r.car
        ? `${r.driver.firstName} ${r.driver.lastName} - ${r.car.plateNumber}`
        : `Assignment ${r.id.slice(-6)}`,
  },
  seats: {
    client: seatsApi as never,
    toLabel: (r: { number: number; id: string }) => `Seat ${r.number} (${r.id.slice(-6)})`,
  },
  productTypes: { client: productTypesApi as never, toLabel: (r: { type: string }) => r.type },
  tickets: {
    client: ticketsApi as never,
    toLabel: (r: { ticketNumber: string; passengerName: string }) =>
      `${r.ticketNumber} - ${r.passengerName}`,
  },
} as never

const EMPTY_LOOKUPS: LookupContext = {
  locations: new Map(),
  routes: new Map(),
  trips: new Map(),
  cars: new Map(),
  drivers: new Map(),
  driverAssignments: new Map(),
  seats: new Map(),
  productTypes: new Map(),
  tickets: new Map(),
}

/**
 * Loads every lookup a config declares.
 *
 * All nine hooks are called unconditionally to honour the rules of hooks;
 * `enabled` keeps the un-needed ones from issuing requests.
 */
function useLookups(keys: LookupKey[]) {
  // Configs pass a fresh array literal each render, so depend on its contents
  // rather than its identity - otherwise the memo below never hits.
  const keySignature = keys.join(',')
  const wants = (key: LookupKey) => keys.includes(key)

  const locations = useLookup(locationsApi, wants('locations'))
  const routes = useLookup(routesApi, wants('routes'))
  const trips = useLookup(tripsApi, wants('trips'))
  const cars = useLookup(carsApi, wants('cars'))
  const drivers = useLookup(driversApi, wants('drivers'))
  const driverAssignments = useLookup(driverAssignmentsApi, wants('driverAssignments'))
  const seats = useLookup(seatsApi, wants('seats'))
  const productTypes = useLookup(productTypesApi, wants('productTypes'))
  const tickets = useLookup(ticketsApi, wants('tickets'))

  const queries: Record<LookupKey, { data?: { items: unknown[] }; isLoading: boolean }> = {
    locations,
    routes,
    trips,
    cars,
    drivers,
    driverAssignments,
    seats,
    productTypes,
    tickets,
  }

  return useMemo(() => {
    const context: LookupContext = { ...EMPTY_LOOKUPS }
    const options: Partial<Record<LookupKey, SelectOption[]>> = {}
    let isLoading = false

    for (const key of keys) {
      const query = queries[key]
      if (query.isLoading) isLoading = true

      const items = (query.data?.items ?? []) as Array<{ id: string }>
      const toLabel = LOOKUPS[key].toLabel as (row: unknown) => string

      context[key] = new Map(items.map((item) => [item.id, toLabel(item)]))
      options[key] = items.map((item) => ({ label: toLabel(item), value: item.id }))
    }

    return { context, options, isLoading }
    // `keys` and `queries` are rebuilt every render; keySignature and the
    // individual query fields below are the values that actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    keySignature,
    locations.data, routes.data, trips.data, cars.data,
    drivers.data, seats.data, productTypes.data, tickets.data,
    locations.isLoading, routes.isLoading, trips.isLoading, cars.isLoading,
    drivers.isLoading, seats.isLoading, productTypes.isLoading, tickets.isLoading,
  ])
}

export interface ResourcePageProps<T extends { id: string }> {
  client: ResourceClient<T>
  config: ResourceConfig<T>
  /**
   * Optional read-only detail view, opened by clicking a row.
   *
   * Supplying this makes rows clickable; without it they are inert, which is
   * the default for most resources. Edit still lives in the row menu, so a
   * click never risks an accidental mutation.
   */
  renderDetail?: (row: T | null, open: boolean, onOpenChange: (open: boolean) => void) => ReactNode
}

/**
 * One CRUD screen, generated from a ResourceConfig: table, status filter,
 * client-side search, pagination, create/edit dialog and delete confirm.
 */
export function ResourcePage<T extends { id: string }>({
  client,
  config,
  renderDetail,
}: ResourcePageProps<T>) {
  const { hasPermission } = useAuth()
  const navigate = useNavigate()

  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<string>(ALL)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<T | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<T | null>(null)
  const [detailRow, setDetailRow] = useState<T | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Only send a bound once it is a complete date; a half-typed one would
  // filter everything away mid-keystroke.
  const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v)

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(status !== ALL ? { status } : {}),
      ...(config.dateFilter && isDate(startDate) ? { startDate } : {}),
      ...(config.dateFilter && isDate(endDate) ? { endDate } : {}),
    }),
    [page, status, config.dateFilter, startDate, endDate],
  )

  const { data, isLoading, error, refetch } = useResourceList(client, params)

  const lookups = useLookups(config.lookups ?? [])

  const createItem = useCreateResource(client, config.label)
  const updateItem = useUpdateResource(client, config.label)
  const deleteItem = useDeleteResource(client, config.label)

  // A verb the API does not implement is never offered, even with permission.
  const disabled = config.disabledActions ?? []
  const canCreate =
    !disabled.includes('create') && hasPermission(`${config.permission}.create`)
  const canUpdate = hasPermission(`${config.permission}.update`)
  const canDelete =
    !disabled.includes('delete') && hasPermission(`${config.permission}.delete`)
  // A detail link is an action too, so the column must render for it.
  const canMutate = canUpdate || canDelete || Boolean(config.detailPath)

  // The API exposes no `search` parameter, so filtering is per-page and local.
  const rows = useMemo(() => {
    const items = data?.items ?? []
    const term = search.trim().toLowerCase()
    if (!term || !config.searchFields?.length) return items

    return items.filter((row) =>
      config.searchFields!.some((field) =>
        String(row[field] ?? '').toLowerCase().includes(term),
      ),
    )
  }, [data?.items, search, config.searchFields])

  const columns = useMemo<Array<Column<T>>>(() => {
    const base: Array<Column<T>> = config.columns.map((column) => ({
      id: column.id,
      header: column.header,
      className: column.align === 'right' ? 'text-right' : undefined,
      headerClassName: column.align === 'right' ? 'text-right' : undefined,
      cell: (row: T) => column.cell(row, lookups.context),
    }))

    if (!canMutate) return base

    base.push({
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'w-12 text-right',
      cell: (row: T) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label="Row actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {config.detailPath && (
              <DropdownMenuItem onSelect={() => navigate(config.detailPath!(row))}>
                <Eye />
                Show detail
              </DropdownMenuItem>
            )}
            {canUpdate && (
              <DropdownMenuItem
                onSelect={() => {
                  setEditing(row)
                  setIsFormOpen(true)
                }}
              >
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
    })

    return base
  }, [config.columns, lookups.context, canMutate, canUpdate, canDelete])

  const openCreate = () => {
    setEditing(null)
    setIsFormOpen(true)
  }

  /**
   * Values already used by a uniqueBy field, so the form can disable them.
   *
   * Drawn from the current page only: the API offers no "all ids" endpoint,
   * so a duplicate on a later page still surfaces as the API's own 409.
   */
  const takenValues = useMemo(() => {
    if (!config.uniqueBy?.length) return undefined

    const map: Record<string, Set<string>> = {}
    for (const field of config.uniqueBy) {
      map[field] = new Set(
        (data?.items ?? [])
          .map((item) => String((item as Record<string, unknown>)[field] ?? ''))
          .filter(Boolean),
      )
    }
    return map
  }, [config.uniqueBy, data?.items])

  /**
   * The detail row, re-read from the current list data.
   *
   * `detailRow` is the snapshot captured when the row was clicked. A detail
   * view that edits embedded records (trip points, say) would keep showing
   * the pre-edit values after invalidation, because the snapshot never
   * changes. Looking the row up by id each render keeps it live.
   */
  const liveDetailRow = useMemo(() => {
    if (!detailRow) return null
    const fresh = (data?.items ?? []).find((item) => item.id === detailRow.id)
    return fresh ?? detailRow
  }, [detailRow, data?.items])

  const hasFilters =
    status !== ALL || search.trim().length > 0 || Boolean(startDate) || Boolean(endDate)
  const resetFilters = () => {
    setStatus(ALL)
    setSearch('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={config.labelPlural}
        description={config.description}
        actions={
          canCreate ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              New {config.label.toLowerCase()}
            </Button>
          ) : undefined
        }
      />

      {(config.searchFields?.length || config.statusChoices?.length) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {config.searchFields?.length ? (
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
                aria-label={`Search ${config.labelPlural.toLowerCase()} on the current page`}
                className="pl-9"
              />
            </div>
          ) : null}

          {config.statusChoices?.length ? (
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="sm:w-52" aria-label="Filter by status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {config.statusChoices.map((choice) => (
                  <SelectItem key={choice.value} value={choice.value}>
                    {choice.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {config.dateFilter ? (
            <div className="flex items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="startDate" className="text-xs">
                  {config.dateFilter.label} from
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
          ) : null}

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="size-4" />
              Clear
            </Button>
          )}
        </div>
      )}

      {config.dateFilter?.hint && (startDate || endDate) && (
        <p className="text-xs text-muted-foreground">{config.dateFilter.hint}</p>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        error={error as Error | null}
        onRetry={() => void refetch()}
        onRowClick={
          config.detailPath
            ? (row) => navigate(config.detailPath!(row))
            : renderDetail
              ? setDetailRow
              : undefined
        }
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle={
          hasFilters
            ? `No matching ${config.labelPlural.toLowerCase()}`
            : `No ${config.labelPlural.toLowerCase()} yet`
        }
        emptyDescription={
          hasFilters
            ? 'Try a different search term or filter.'
            : `Create your first ${config.label.toLowerCase()} to get started.`
        }
        emptyAction={
          hasFilters ? (
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Clear filters
            </Button>
          ) : canCreate ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              New {config.label.toLowerCase()}
            </Button>
          ) : undefined
        }
      />

      <ResourceFormDialog
        config={config}
        row={editing}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        lookupOptions={lookups.options}
        lookupsLoading={lookups.isLoading}
        takenValues={takenValues}
        onSubmit={async (payload, id) => {
          if (id) {
            await updateItem.mutateAsync({ id, payload })
          } else {
            await createItem.mutateAsync(payload)
          }
        }}
      />

      <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this {config.label.toLowerCase()}?</DialogTitle>
            <DialogDescription>
              This permanently deletes the record. Dependent records follow the API cascade
              rules. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteItem.isPending}
              onClick={async () => {
                if (!pendingDelete) return
                try {
                  await deleteItem.mutateAsync(pendingDelete.id)
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

      {renderDetail?.(liveDetailRow, Boolean(detailRow), (open) => {
        if (!open) setDetailRow(null)
      })}
    </div>
  )
}
