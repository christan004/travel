import { api, unwrap, unwrapList, type ApiSuccess, type Paginated } from '@/lib/axios'

/**
 * Generic CRUD client for the SwiftBus API.
 *
 * Every resource in the OpenAPI spec follows the same shape:
 *   GET    /api/v1/<path>        -> { success, data: T[], meta }
 *   POST   /api/v1/<path>        -> { success, data: T }
 *   GET    /api/v1/<path>/:id    -> { success, data: T }
 *   PATCH  /api/v1/<path>/:id    -> { success, data: T }
 *   DELETE /api/v1/<path>/:id    -> 204
 *
 * so one factory covers them all rather than 20 near-identical modules.
 */

export interface ResourceListParams {
  page?: number
  limit?: number
  status?: string
  search?: string
  /**
   * Date-range bounds, inclusive, as YYYY-MM-DD.
   *
   * On /trips these filter by `createdAt` - when the trip was RECORDED - not
   * by `departureAt`. Verified live: a trip departing in November but created
   * today is excluded by `startDate=2026-09-18` and included by
   * `startDate=2026-09-16`. See docs/backend-trips.md.
   *
   * Only resources whose config sets `dateFilter` send these.
   */
  startDate?: string
  endDate?: string
}

/**
 * Payloads are typed as a plain record rather than a per-resource generic.
 *
 * The forms are config-driven, so values arrive as `Record<string, unknown>`
 * anyway, and a contravariant TCreate/TUpdate would make every client
 * incompatible with the generic hooks that consume them. Field-level
 * correctness is enforced by each resource's Yup schema and toPayload.
 */
export type ResourcePayload = Record<string, unknown>

export interface ResourceClient<T> {
  path: string
  list: (params?: ResourceListParams) => Promise<Paginated<T>>
  get: (id: string) => Promise<T>
  create: (payload: ResourcePayload) => Promise<T>
  update: (id: string, payload: ResourcePayload) => Promise<T>
  remove: (id: string) => Promise<void>
}

/**
 * @param path API path segment, e.g. 'trips' for /api/v1/trips.
 */
export function createResourceClient<T>(path: string): ResourceClient<T> {
  const base = `/api/v1/${path}`

  return {
    path,

    list(params: ResourceListParams = {}) {
      // Strip empty values so the API never sees `?status=` with no value.
      const query = Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null),
      )
      return unwrapList(api.get<ApiSuccess<T[]>>(base, { params: query }))
    },

    get(id: string) {
      return unwrap(api.get<ApiSuccess<T>>(`${base}/${id}`))
    },

    create(payload: ResourcePayload) {
      return unwrap(api.post<ApiSuccess<T>>(base, payload))
    },

    update(id: string, payload: ResourcePayload) {
      return unwrap(api.patch<ApiSuccess<T>>(`${base}/${id}`, payload))
    },

    async remove(id: string) {
      await api.delete(`${base}/${id}`)
    },
  }
}
