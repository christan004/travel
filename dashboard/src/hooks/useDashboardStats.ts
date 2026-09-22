import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryClient'
import { getDashboardStats } from '@/api/dashboard'

/**
 * Dashboard KPIs.
 *
 * NOTE: the API has no aggregate endpoint, so these figures are derived
 * client-side from /tickets, /routes and /cars. See api/dashboard.ts for the
 * exact derivation and its limits (page size is capped at 100).
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboard.stats,
    queryFn: getDashboardStats,
    staleTime: 60_000,
  })
}
