import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, ShieldAlert, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { fetchPermissionCatalog, replaceRolePermissions } from '@/api/resources'
import { resourceKeys } from '@/hooks/useResource'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Role } from '@/types/entities'

/**
 * Assign permissions to a role.
 *
 * PUT /roles/{id}/permissions REPLACES the whole set, so the dialog edits a
 * local copy and sends everything on save - a partial send would silently
 * revoke whatever it omitted.
 *
 * The options come from /permissions/catalog, not /permissions: the catalog
 * is what the API validates against, and it carries three permissions the
 * latter omits. An unknown string fails the entire request, so offering the
 * wrong list would make some rows unsavable.
 */

/** "cars.read" -> "Cars"; "driver_car_assignments.x" -> "Driver car assignments". */
function resourceLabel(resource: string): string {
  const spaced = resource.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const ACTION_ORDER = ['read', 'create', 'update', 'delete', 'assign', 'manage']

function actionRank(action: string): number {
  const i = ACTION_ORDER.indexOf(action)
  return i === -1 ? ACTION_ORDER.length : i
}

export interface RolePermissionsDialogProps {
  role: Role | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RolePermissionsDialog({
  role,
  open,
  onOpenChange,
}: RolePermissionsDialogProps) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const { data: catalog, isLoading } = useQuery({
    queryKey: ['permissions', 'catalog'],
    queryFn: fetchPermissionCatalog,
    // The catalog is fixed by the deployment; no need to refetch per dialog.
    staleTime: 30 * 60_000,
    enabled: open,
  })

  // Reset to the role's current set each time the dialog opens.
  useEffect(() => {
    if (open) {
      setSelected(new Set(role?.permissions ?? []))
      setSearch('')
    }
  }, [open, role])

  /** Catalog grouped by resource, preserving a sensible action order. */
  const groups = useMemo(() => {
    const byResource = new Map<string, string[]>()
    for (const permission of catalog ?? []) {
      const [resource] = permission.split('.')
      const bucket = byResource.get(resource)
      if (bucket) bucket.push(permission)
      else byResource.set(resource, [permission])
    }

    return [...byResource.entries()]
      .map(([resource, permissions]) => ({
        resource,
        label: resourceLabel(resource),
        permissions: permissions.sort(
          (a, b) => actionRank(a.split('.')[1]) - actionRank(b.split('.')[1]),
        ),
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [catalog])

  const term = search.trim().toLowerCase()
  const visible = useMemo(() => {
    if (!term) return groups
    return groups
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter(
          (p) => p.includes(term) || group.label.toLowerCase().includes(term),
        ),
      }))
      .filter((group) => group.permissions.length > 0)
  }, [groups, term])

  if (!role) return null

  const original = new Set(role.permissions ?? [])
  const added = [...selected].filter((p) => !original.has(p))
  const removed = [...original].filter((p) => !selected.has(p))
  const isDirty = added.length > 0 || removed.length > 0

  const toggle = (permission: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(permission)) next.delete(permission)
      else next.add(permission)
      return next
    })

  const toggleGroup = (permissions: string[], allOn: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      for (const p of permissions) {
        if (allOn) next.delete(p)
        else next.add(p)
      }
      return next
    })

  const save = async () => {
    setIsSaving(true)
    try {
      await replaceRolePermissions(role.id, [...selected])
      void queryClient.invalidateQueries({ queryKey: resourceKeys.all('roles') })
      toast.success(
        `Permissions updated for ${role.name}` +
          (added.length || removed.length
            ? ` (+${added.length} / -${removed.length})`
            : ''),
      )
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update permissions')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>Permissions for {role.name}</DialogTitle>
          <DialogDescription>
            {selected.size} of {catalog?.length ?? 0} selected. Saving replaces the role&apos;s
            permissions entirely.
          </DialogDescription>
        </DialogHeader>

        {role.isFixed && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <p className="text-xs text-foreground">
              This is a built-in role. Editing its permissions can lock users out of the system -
              including yourself, if you hold it.
            </p>
          </div>
        )}

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter permissions..."
            aria-label="Filter permissions"
            className="pl-9"
          />
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {isLoading ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : visible.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No permissions match &ldquo;{search}&rdquo;.
            </p>
          ) : (
            visible.map((group) => {
              const chosen = group.permissions.filter((p) => selected.has(p)).length
              const allOn = chosen === group.permissions.length

              return (
                <section key={group.resource}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      {group.label}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {chosen}/{group.permissions.length}
                      </span>
                    </h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => toggleGroup(group.permissions, allOn)}
                    >
                      {allOn ? 'Clear' : 'Select all'}
                    </Button>
                  </div>

                  <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {group.permissions.map((permission) => {
                      const action = permission.split('.')[1]
                      const isOn = selected.has(permission)
                      const wasOn = original.has(permission)

                      return (
                        <label
                          key={permission}
                          className={cn(
                            'flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors',
                            isOn
                              ? 'border-primary/30 bg-primary-light'
                              : 'border-border bg-card hover:bg-background',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isOn}
                            onChange={() => toggle(permission)}
                            className="size-4 shrink-0 rounded border-input accent-primary"
                          />
                          <span
                            className={cn(
                              'truncate',
                              isOn ? 'font-medium text-primary-hover' : 'text-foreground',
                            )}
                          >
                            {action}
                          </span>
                          {/* Flag what this save would change. */}
                          {isOn && !wasOn && (
                            <span className="ml-auto text-xs font-medium text-primary">new</span>
                          )}
                          {!isOn && wasOn && (
                            <span className="ml-auto text-xs font-medium text-destructive">
                              removing
                            </span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </section>
              )
            })
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {added.length > 0 && <Badge variant="success">+{added.length} added</Badge>}
            {removed.length > 0 && <Badge variant="neutral">-{removed.length} removed</Badge>}
            {!isDirty && <span className="text-muted-foreground">No changes</span>}
            {isDirty && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setSelected(new Set(role.permissions ?? []))}
              >
                <X className="size-3" />
                Reset
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" loading={isSaving} disabled={!isDirty} onClick={() => void save()}>
              Save permissions
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
