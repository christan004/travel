import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/axios'

/**
 * Shared query client.
 *
 * Retry policy is deliberate: auth, permission, validation and not-found
 * errors are terminal, so retrying them only delays the error the user
 * needs to see. Transient failures get two retries with backoff.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          if (error.status === 401 || error.status === 403 || error.status === 404) return false
          if (error.code === 'VALIDATION_ERROR' || error.code === 'BUSINESS_RULE_VIOLATION') return false
        }
        return failureCount < 2
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
    mutations: {
      // Mutations are user-initiated; surface failures immediately.
      retry: false,
    },
  },
})

/**
 * Central query-key registry.
 *
 * Keeping keys in one place makes invalidation after a mutation explicit
 * and prevents the subtle cache misses caused by hand-written key arrays.
 */
export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  company: {
    current: ['company', 'current'] as const,
  },
  bookings: {
    all: ['bookings'] as const,
    list: (params: unknown) => ['bookings', 'list', params] as const,
    detail: (id: string) => ['bookings', 'detail', id] as const,
  },
  routes: {
    all: ['routes'] as const,
    list: (params: unknown) => ['routes', 'list', params] as const,
    detail: (id: string) => ['routes', 'detail', id] as const,
  },
  routePrices: {
    all: ['route-prices'] as const,
    list: (params: unknown) => ['route-prices', 'list', params] as const,
  },
  buses: {
    all: ['buses'] as const,
    list: (params: unknown) => ['buses', 'list', params] as const,
    detail: (id: string) => ['buses', 'detail', id] as const,
  },
  seats: {
    all: ['seats'] as const,
    list: (params: unknown) => ['seats', 'list', params] as const,
  },
  passengers: {
    all: ['passengers'] as const,
    list: (params: unknown) => ['passengers', 'list', params] as const,
    detail: (id: string) => ['passengers', 'detail', id] as const,
  },
  payments: {
    all: ['payments'] as const,
    list: (params: unknown) => ['payments', 'list', params] as const,
  },
  locations: {
    all: ['locations'] as const,
    list: (params: unknown) => ['locations', 'list', params] as const,
  },
  trips: {
    all: ['trips'] as const,
    list: (params: unknown) => ['trips', 'list', params] as const,
  },
  drivers: {
    all: ['drivers'] as const,
    list: (params: unknown) => ['drivers', 'list', params] as const,
  },
  users: {
    all: ['users'] as const,
    list: (params: unknown) => ['users', 'list', params] as const,
  },
  roles: {
    all: ['roles'] as const,
    list: (params: unknown) => ['roles', 'list', params] as const,
  },
  permissions: {
    all: ['permissions'] as const,
    catalog: ['permissions', 'catalog'] as const,
  },
  dashboard: {
    stats: ['dashboard', 'stats'] as const,
  },
} as const
