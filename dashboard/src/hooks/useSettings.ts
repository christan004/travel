import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/queryClient'
import { ApiError } from '@/lib/axios'
import * as settingsApi from '@/api/settings'
import * as authApi from '@/api/auth'
import type { Company, ListParams } from '@/types/entities'

/** Company profile, users, roles and permissions. */

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

export function useCurrentCompany() {
  return useQuery({
    queryKey: queryKeys.company.current,
    queryFn: authApi.getCurrentCompany,
    staleTime: 5 * 60_000,
  })
}

export function useUpdateCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    /**
     * One mutation, two transports: JSON normally, multipart when a logo file
     * is attached. The endpoint is the same either way - see
     * updateCurrentCompanyWithLogo for why the file must travel with the
     * other fields rather than on its own.
     */
    mutationFn: ({ logo, ...payload }: Partial<Company> & { logo?: File | null }) =>
      logo
        ? authApi.updateCurrentCompanyWithLogo(payload, logo)
        : authApi.updateCurrentCompany(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.company.current, updated)
      toast.success('Company profile updated')
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not update the company profile')),
  })
}

export function useUsers(params: ListParams = {}) {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => settingsApi.listUsers(params),
    placeholderData: (previous) => previous,
  })
}

export function useRoles(params: ListParams = { limit: 100 }) {
  return useQuery({
    queryKey: queryKeys.roles.list(params),
    queryFn: () => settingsApi.listRoles(params),
    staleTime: 5 * 60_000,
  })
}

/** Permissions granted to this company. */
export function usePermissions() {
  return useQuery({
    queryKey: queryKeys.permissions.all,
    queryFn: settingsApi.listPermissions,
    staleTime: 10 * 60_000,
  })
}

/** The platform-wide catalogue of assignable permissions. */
export function usePermissionCatalog() {
  return useQuery({
    queryKey: queryKeys.permissions.catalog,
    queryFn: settingsApi.listPermissionCatalog,
    staleTime: 30 * 60_000,
  })
}
