import { useMemo, useState } from 'react'
import { KeyRound, Lock, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useQueries } from '@tanstack/react-query'
import { roleDetailApi, rolesApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { resourceKeys, useDeleteResource, useResourceList } from '@/hooks/useResource'
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
import { RoleFormDialog } from '@/features/settings/RoleFormDialog'
import { RolePermissionsDialog } from '@/features/settings/RolePermissionsDialog'
import type { Role } from '@/types/entities'

const ALL = 'all'
const PAGE_SIZE = 20

/**
 * Roles and what each one can do.
 *
 * Hand-written rather than a ResourceConfig because the main action here is
 * not create/edit but assigning permissions, which is its own endpoint
 * (PUT /roles/{id}/permissions) and its own dialog.
 *
 * Fixed roles are read-mostly: the API refuses to rename or delete them
 * (422), so those actions are hidden. It does NOT refuse a permission change
 * on them, which is how an admin can lock themselves out - the permissions
 * dialog warns before saving.
 */
export function RolesPage() {
  const { hasPermission, user } = useAuth()

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>(ALL)
  const [search, setSearch] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const [permissionsFor, setPermissionsFor] = useState<Role | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Role | null>(null)

  const params = useMemo(() => ({ page, limit: PAGE_SIZE }), [page])
  const { data, isLoading, error, refetch } = useResourceList(rolesApi, params)

  /**
   * `isFixed` and `_count.users` are ONLY on GET-by-id - the list omits both.
   * Without them the page cannot tell which roles are protected, and would
   * offer Edit/Delete on built-ins that answer 422. So each visible role is
   * read once; that is a handful of small cached requests per page.
   */
  const listed = useMemo(() => (data?.items ?? []) as Role[], [data?.items])
  const details = useQueries({
    queries: listed.map((role) => ({
      queryKey: resourceKeys.detail('roles', role.id),
      queryFn: () => roleDetailApi.get(role.id),
      staleTime: 60_000,
      // A just-deleted role can be refetched before the list refreshes; that
      // 404 is expected and must not be retried or surfaced.
      retry: false,
    })),
  })

  /** List row plus the two fields only the detail endpoint returns. */
  const enriched = useMemo(
    () =>
      listed.map((role, index) => {
        const detail = details[index]?.data
        return detail
          ? { ...role, isFixed: detail.isFixed, _count: detail._count }
          : role
      }),
    // `details` is a fresh array each render; its contents are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listed, details.map((d) => d.data?.id).join(','), details.map((d) => d.status).join(',')],
  )

  const deleteRole = useDeleteResource(rolesApi, 'Role')

  const canCreate = hasPermission('roles.create')
  const canUpdate = hasPermission('roles.update')
  const canDelete = hasPermission('roles.delete')
  const canAssign = hasPermission('permissions.assign')

  const rows = useMemo(() => {
    let items = enriched

    if (statusFilter !== ALL) {
      const wantActive = statusFilter === 'active'
      items = items.filter((role) => role.isActive === wantActive)
    }

    const term = search.trim().toLowerCase()
    if (term) items = items.filter((role) => role.name.toLowerCase().includes(term))

    return items
  }, [enriched, statusFilter, search])

  const columns = useMemo<Array<Column<Role>>>(
    () => [
      {
        id: 'name',
        header: 'Role',
        cell: (row) => (
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{row.name}</span>
            {row.isFixed && (
              <span
                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                title="Built-in role: cannot be renamed or deleted"
              >
                <Lock className="size-3" aria-hidden />
                Built-in
              </span>
            )}
          </div>
        ),
      },
      {
        id: 'permissions',
        header: 'Permissions',
        cell: (row) => {
          const count = row.permissions?.length ?? 0
          if (count === 0) {
            return (
              <span className="text-xs text-warning">None assigned</span>
            )
          }
          // The resource spread says more than a bare count.
          const resources = new Set((row.permissions ?? []).map((p) => p.split('.')[0]))
          return (
            <span className="text-sm text-foreground">
              {count}
              <span className="ml-1 text-xs text-muted-foreground">
                across {resources.size} area{resources.size === 1 ? '' : 's'}
              </span>
            </span>
          )
        },
      },
      {
        id: 'users',
        header: 'Users',
        cell: (row) =>
          typeof row._count?.users === 'number' ? (
            <span className="tabular-nums text-foreground">{row._count.users}</span>
          ) : (
            <span className="text-muted-foreground">--</span>
          ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => (
          <Badge variant={row.isActive ? 'success' : 'neutral'}>
            {row.isActive ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      ...(canUpdate || canDelete || canAssign
        ? [
            {
              id: 'actions',
              header: <span className="sr-only">Actions</span>,
              className: 'w-12 text-right',
              cell: (row: Role) => (
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
                    {canAssign && (
                      <DropdownMenuItem onSelect={() => setPermissionsFor(row)}>
                        <KeyRound />
                        Permissions
                      </DropdownMenuItem>
                    )}
                    {/* Fixed roles cannot be renamed or deleted (422). */}
                    {canUpdate && !row.isFixed && (
                      <DropdownMenuItem onSelect={() => setEditing(row)}>
                        <Pencil />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {canDelete && !row.isFixed && (
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
            } satisfies Column<Role>,
          ]
        : []),
    ],
    [canUpdate, canDelete, canAssign],
  )

  const hasFilters = statusFilter !== ALL || search.trim().length > 0
  const resetFilters = () => {
    setStatusFilter(ALL)
    setSearch('')
    setPage(1)
  }

  const meta = hasFilters
    ? { page: 1, limit: PAGE_SIZE, total: rows.length, totalPages: 1 }
    : data?.meta

  const usersOnRole = pendingDelete?._count?.users ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles"
        description="What each role can do, and who holds it."
        actions={
          canCreate ? (
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="size-4" />
              New role
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
            placeholder="Search roles..."
            aria-label="Search roles"
            className="pl-9"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value)
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
        emptyTitle={hasFilters ? 'No matching roles' : 'No roles yet'}
        emptyDescription={
          hasFilters
            ? 'Try a different status or search term.'
            : 'Create a role, then choose what it can do.'
        }
        emptyAction={
          hasFilters ? (
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Clear filters
            </Button>
          ) : canCreate ? (
            <Button size="sm" onClick={() => setIsFormOpen(true)}>
              <Plus className="size-4" />
              New role
            </Button>
          ) : undefined
        }
      />

      <RoleFormDialog
        role={null}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        // A new role has no permissions, so go straight to choosing them.
        onCreated={(created) => canAssign && setPermissionsFor(created)}
      />

      <RoleFormDialog
        role={editing}
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      />

      <RolePermissionsDialog
        role={permissionsFor}
        open={Boolean(permissionsFor)}
        onOpenChange={(open) => !open && setPermissionsFor(null)}
      />

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {pendingDelete?.name}?</DialogTitle>
            <DialogDescription>
              {usersOnRole > 0
                ? `${usersOnRole} user${usersOnRole === 1 ? '' : 's'} currently hold this role and will lose its permissions.`
                : 'This role is not assigned to anyone.'}{' '}
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteRole.isPending}
              onClick={async () => {
                if (!pendingDelete) return
                try {
                  await deleteRole.mutateAsync(pendingDelete.id)
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

      {user && (
        <p className="text-xs text-muted-foreground">
          Changing a role you hold takes effect on your next sign-in.
        </p>
      )}
    </div>
  )
}
