import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/queryClient'
import { ApiError } from '@/lib/axios'
import * as passengersApi from '@/api/passengers'
import type { CreatePassengerPayload, ListParams, UpdatePassengerPayload } from '@/types/entities'

/** Passengers server state (API model: Passanger). */

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

export function usePassengers(params: ListParams = {}) {
  return useQuery({
    queryKey: queryKeys.passengers.list(params),
    queryFn: () => passengersApi.listPassengers(params),
    placeholderData: (previous) => previous,
  })
}

export function usePassenger(id: string | null) {
  return useQuery({
    queryKey: queryKeys.passengers.detail(id ?? ''),
    queryFn: () => passengersApi.getPassenger(id!),
    enabled: Boolean(id),
  })
}

export function useCreatePassenger() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreatePassengerPayload) => passengersApi.createPassenger(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.passengers.all })
      toast.success('Passenger created')
    },
    onError: (error) =>
      toast.error(
        errorMessage(error, 'Could not create the passenger. At least one ticket id is required.'),
      ),
  })
}

export function useUpdatePassenger() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePassengerPayload }) =>
      passengersApi.updatePassenger(id, payload),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.passengers.all })
      queryClient.setQueryData(queryKeys.passengers.detail(updated.id), updated)
      toast.success('Passenger updated')
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not update the passenger')),
  })
}

export function useDeletePassenger() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => passengersApi.deletePassenger(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.passengers.all })
      toast.success('Passenger deleted')
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not delete the passenger')),
  })
}
