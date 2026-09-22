import { useMemo, useState } from 'react'
import { MoreHorizontal, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { carInsuranceApi, carInsuranceItemApi, carsApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import {
  useDeleteResource,
  useLookup,
  useResourceList,
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
import { CarInsuranceFormDialog } from '@/features/fleet/CarInsuranceFormDialog'
import type {
  Car,
  CarInsurance,
  CarInsuranceGroup,
  InsuranceStatus,
} from '@/types/entities'

const ALL = 'all'

/** A policy flattened out of its car group, with the car it belongs to. */
type PolicyRow = {
  id: string
  carId: string
  name: string
  validFrom: string
  validTo: string
  status: InsuranceStatus
  car: Car | null
}

const dateOnly = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Insurance policies.
 *
 * This is a hand-written page rather than a ResourcePage config because the
 * endpoint breaks three assumptions the generic renderer makes:
 *
 * 1. LIST is GROUPED BY CAR - `[{ CarInsurance: [...] }]` - so rows have to be
 *    flattened before they can be tabulated.
 * 2. `meta.total` counts CARS, not policies, so the generic pager would report
 *    the wrong count. We request a large page and paginate client-side.
 * 3. The grouped rows OMIT `carId`, yet PATCH requires it. Editing therefore
 *    fetches the policy by id first (GET by id is the only read that returns
 *    `carId`) rather than trusting the list row.
 *
 * `?status=` and `?carId=` are accepted but not honoured by the API - a bogus
 * carId still returns every row - so both filters are applied client-side.
 */
export function CarInsurancePage() {
  const { hasPermission } = useAuth()

  const [page, setPage] = useState(1)
  const [carFilter, setCarFilter] = useState<string>(ALL)
  const [statusFilter, setStatusFilter] = useState<string>(ALL)
  const [search, setSearch] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editing, setEditing] = useState<(CarInsurance & { carId: string }) | null>(null)
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PolicyRow | null>(null)

  // Groups are per-car and meta counts cars, so fetch wide and page locally.
  const params = useMemo(() => ({ page: 1, limit: 100 }), [])
  const { data, isLoading, error, refetch } = useResourceList(carInsuranceApi, params)

  const { data: carsPage } = useLookup(carsApi)
  const cars = useMemo(() => (carsPage?.items ?? []) as Car[], [carsPage?.items])

  const deletePolicy = useDeleteResource(carInsuranceItemApi, 'Policy')

  const canCreate = hasPermission('car_insurance.create')
  const canUpdate = hasPermission('car_insurance.update')
  const canDelete = hasPermission('car_insurance.delete')

  /**
   * Flatten groups into policy rows.
   *
   * The group itself carries no car identity, so when there is exactly one
   * group and one car the mapping is unambiguous. Otherwise the car stays
   * null and the row renders without a vehicle label - the edit dialog still
   * resolves the real carId from GET by id before saving.
   */
  const allRows = useMemo<PolicyRow[]>(() => {
    const groups = (data?.items ?? []) as CarInsuranceGroup[]
    const soleCar = groups.length === 1 && cars.length === 1 ? cars[0] : null

    return groups.flatMap((group) =>
      (group.CarInsurance ?? []).map((policy) => ({
        ...policy,
        carId: soleCar?.id ?? '',
        car: soleCar,
      })),
    )
  }, [data?.items, cars])

  const filtered = useMemo(() => {
    let rows = allRows

    if (statusFilter !== ALL) rows = rows.filter((r) => r.status === statusFilter)
    if (carFilter !== ALL) rows = rows.filter((r) => r.carId === carFilter)

    const term = search.trim().toLowerCase()
    if (term) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(term) ||
          r.car?.model?.toLowerCase().includes(term) ||
          r.car?.plateNumber?.toLowerCase().includes(term),
      )
    }

    return rows
  }, [allRows, statusFilter, carFilter, search])

  const PAGE_SIZE = 20
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const rows = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  )

  /**
   * Open the edit dialog with a complete policy.
   *
   * PATCH needs `carId` and the list row does not have it, so read the policy
   * back by id first - that response is the only one that includes it.
   */
  const startEdit = async (row: PolicyRow) => {
    setLoadingEditId(row.id)
    try {
      const full = await carInsuranceItemApi.get(row.id)
      setEditing(full as CarInsurance & { carId: string })
    } finally {
      setLoadingEditId(null)
    }
  }

  const columns = useMemo<Array<Column<PolicyRow>>>(
    () => [
      {
        id: 'name',
        header: 'Policy',
        cell: (row) => <span className="font-medium text-foreground">{row.name}</span>,
      },
      {
        id: 'car',
        header: 'Vehicle',
        cell: (row) =>
          row.car ? (
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{row.car.model}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {row.car.plateNumber}
              </p>
            </div>
          ) : (
            <span className="text-muted-foreground">--</span>
          ),
      },
      { id: 'from', header: 'Valid from', cell: (row) => dateOnly(row.validFrom) },
      { id: 'to', header: 'Valid to', cell: (row) => dateOnly(row.validTo) },
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
              cell: (row: PolicyRow) => (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={loadingEditId === row.id}
                      aria-label={`Actions for ${row.name}`}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canUpdate && (
                      <DropdownMenuItem onSelect={() => void startEdit(row)}>
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
            } satisfies Column<PolicyRow>,
          ]
        : []),
    ],
    // startEdit is stable for this table's purposes; the cells only need to
    // re-render on permission or in-flight changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canUpdate, canDelete, loadingEditId],
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Car insurance"
        description="Policies covering your fleet and their validity windows."
        actions={
          canCreate ? (
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="size-4" />
              Add policy
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
            placeholder="Search policies..."
            aria-label="Search policies"
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

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        error={error as Error | null}
        onRetry={() => void refetch()}
        meta={{
          page: safePage,
          limit: PAGE_SIZE,
          total: filtered.length,
          totalPages,
        }}
        onPageChange={setPage}
        emptyTitle={hasFilters ? 'No matching policies' : 'No policies yet'}
        emptyDescription={
          hasFilters
            ? 'Try a different vehicle, status or search term.'
            : 'Add a policy to cover a vehicle.'
        }
        emptyAction={
          hasFilters ? (
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Clear filters
            </Button>
          ) : canCreate ? (
            <Button size="sm" onClick={() => setIsFormOpen(true)}>
              <Plus className="size-4" />
              Add policy
            </Button>
          ) : undefined
        }
      />

      <CarInsuranceFormDialog
        policy={null}
        carOptions={carOptions}
        defaultCarId={carFilter !== ALL ? carFilter : undefined}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
      />

      <CarInsuranceFormDialog
        policy={editing}
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
            <DialogTitle>Delete this policy?</DialogTitle>
            <DialogDescription>
              {pendingDelete?.name} will be permanently removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deletePolicy.isPending}
              onClick={async () => {
                if (!pendingDelete) return
                try {
                  await deletePolicy.mutateAsync(pendingDelete.id)
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
