import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from '@/lib/axios'
import type { ResourceClient, ResourceListParams, ResourcePayload } from '@/api/resource'

/**
 * React Query bindings for any resource client.
 *
 * Server state lives entirely in the cache - nothing is copied into
 * useState - and every mutation invalidates its own resource key.
 */

/** Query keys are derived from the resource path, so they never collide. */
export const resourceKeys = {
  all: (path: string) => [path] as const,
  list: (path: string, params: unknown) => [path, 'list', params] as const,
  detail: (path: string, id: string) => [path, 'detail', id] as const,
}

function message(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

/**
 * Resources whose cached lists embed another resource, and so must be
 * refetched when it changes.
 *
 * The API embeds `seats` inside each car, so the Seats page renders from the
 * cars cache. Invalidating only ['seats'] after a seat update would leave
 * that view stale.
 */
const RELATED_INVALIDATIONS: Record<string, string[]> = {
  seats: ['cars'],
  baggage: ['cars'],
  // GET /trips embeds each trip's points, so the trips list (and the trip
  // detail rendered from it) goes stale when a point changes.
  'trip-points': ['trips'],
}

/** Invalidate a resource, anything embedding it, and the derived dashboard. */
function invalidateResource(queryClient: ReturnType<typeof useQueryClient>, path: string) {
  void queryClient.invalidateQueries({ queryKey: resourceKeys.all(path) })
  for (const related of RELATED_INVALIDATIONS[path] ?? []) {
    void queryClient.invalidateQueries({ queryKey: resourceKeys.all(related) })
  }
  void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
}

export function useResourceList<T>(
  client: ResourceClient<T>,
  params: ResourceListParams = {},
  options: { enabled?: boolean; staleTime?: number; keepPreviousData?: boolean } = {},
) {
  const keepPrevious = options.keepPreviousData ?? true

  return useQuery({
    queryKey: resourceKeys.list(client.path, params),
    queryFn: () => client.list(params),
    // Keeps the current page on screen while the next one loads - right for
    // a paginated table, wrong where the same query is re-read after a
    // mutation: the stale page would keep rendering through the refetch and
    // the edit would look like it had not applied. Callers that read a list
    // to drive live records (TripDetailPage's timetable) opt out.
    placeholderData: keepPrevious ? (previous) => previous : undefined,
    enabled: options.enabled ?? true,
    staleTime: options.staleTime,
  })
}

export function useResourceItem<T>(
  client: ResourceClient<T>,
  id: string | null,
) {
  return useQuery({
    queryKey: resourceKeys.detail(client.path, id ?? ''),
    queryFn: () => client.get(id!),
    enabled: Boolean(id),
  })
}

export function useCreateResource<T>(
  client: ResourceClient<T>,
  label: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: ResourcePayload) => client.create(payload),
    onSuccess: () => {
      invalidateResource(queryClient, client.path)
      toast.success(`${label} created`)
    },
    onError: (error) => toast.error(message(error, `Could not create the ${label.toLowerCase()}`)),
  })
}

export function useUpdateResource<T extends { id: string }>(
  client: ResourceClient<T>,
  label: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ResourcePayload }) =>
      client.update(id, payload),
    onSuccess: (updated) => {
      invalidateResource(queryClient, client.path)
      queryClient.setQueryData(resourceKeys.detail(client.path, updated.id), updated)
      toast.success(`${label} updated`)
    },
    onError: (error) => toast.error(message(error, `Could not update the ${label.toLowerCase()}`)),
  })
}

export function useDeleteResource<T>(
  client: ResourceClient<T>,
  label: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => client.remove(id),
    onSuccess: () => {
      invalidateResource(queryClient, client.path)
      toast.success(`${label} deleted`)
    },
    onError: (error) => toast.error(message(error, `Could not delete the ${label.toLowerCase()}`)),
  })
}

/**
 * Loads a full lookup list (capped at the API maximum of 100) for select
 * options and id -> label joins. Long stale time: reference data rarely moves.
 */
export function useLookup<T>(client: ResourceClient<T>, enabled = true) {
  return useQuery({
    queryKey: resourceKeys.list(client.path, { lookup: true }),
    queryFn: () => client.list({ limit: 100 }),
    staleTime: 5 * 60_000,
    enabled,
  })
}
