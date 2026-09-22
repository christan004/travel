import { api, unwrap, unwrapList, type ApiSuccess, type Paginated } from '@/lib/axios'
import type {
  CreatePassengerPayload,
  ListParams,
  Passenger,
  UpdatePassengerPayload,
} from '@/types/entities'

/**
 * Passengers -> /api/v1/passengers (Prisma model `Passanger`).
 *
 * Tenancy quirk worth knowing: a passenger is only visible to this company
 * when ALL of their tickets belong to it, and creating one requires at least
 * one tenant-owned ticket id. Passwords are write-only - never returned.
 */

const BASE = '/api/v1/passengers'

export function listPassengers(params: ListParams = {}): Promise<Paginated<Passenger>> {
  return unwrapList(api.get<ApiSuccess<Passenger[]>>(BASE, { params }))
}

export function getPassenger(id: string): Promise<Passenger> {
  return unwrap(api.get<ApiSuccess<Passenger>>(`${BASE}/${id}`))
}

export function createPassenger(payload: CreatePassengerPayload): Promise<Passenger> {
  return unwrap(api.post<ApiSuccess<Passenger>>(BASE, payload))
}

/** `ticketIds`, if supplied, REPLACES the linked tickets rather than appending. */
export function updatePassenger(
  id: string,
  payload: UpdatePassengerPayload,
): Promise<Passenger> {
  return unwrap(api.patch<ApiSuccess<Passenger>>(`${BASE}/${id}`, payload))
}

export async function deletePassenger(id: string): Promise<void> {
  await api.delete(`${BASE}/${id}`)
}
