import { api, unwrap, unwrapList, type ApiSuccess, type Paginated } from '@/lib/axios'
import type { ListParams, Permission, Role, User } from '@/types/entities'

/** Users, roles and permissions for the Settings page. */

const USERS = '/api/v1/users'
const ROLES = '/api/v1/roles'
const PERMISSIONS = '/api/v1/permissions'

export function listUsers(params: ListParams = {}): Promise<Paginated<User>> {
  return unwrapList(api.get<ApiSuccess<User[]>>(USERS, { params }))
}

export interface CreateUserPayload {
  firstName: string
  lastName: string
  email: string
  gender?: string
  phone?: string
  password: string
  status?: 'active' | 'inactive'
}

export function createUser(payload: CreateUserPayload): Promise<User> {
  return unwrap(api.post<ApiSuccess<User>>(USERS, payload))
}

export function updateUser(id: string, payload: Partial<CreateUserPayload>): Promise<User> {
  return unwrap(api.patch<ApiSuccess<User>>(`${USERS}/${id}`, payload))
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`${USERS}/${id}`)
}

/** PUT /api/v1/users/:id/roles - replaces the full role set. */
export function replaceUserRoles(id: string, roleIds: string[]): Promise<User> {
  return unwrap(api.put<ApiSuccess<User>>(`${USERS}/${id}/roles`, { roleIds }))
}

/* ------------------------------- Roles ------------------------------ */

export function listRoles(params: ListParams = {}): Promise<Paginated<Role>> {
  return unwrapList(api.get<ApiSuccess<Role[]>>(ROLES, { params }))
}

export function createRole(payload: { name: string; isActive?: boolean }): Promise<Role> {
  return unwrap(api.post<ApiSuccess<Role>>(ROLES, payload))
}

export function updateRole(
  id: string,
  payload: { name?: string; isActive?: boolean },
): Promise<Role> {
  return unwrap(api.patch<ApiSuccess<Role>>(`${ROLES}/${id}`, payload))
}

/** PUT /api/v1/roles/:id/permissions - replaces the full permission set. */
export function replaceRolePermissions(id: string, permissions: string[]): Promise<Role> {
  return unwrap(api.put<ApiSuccess<Role>>(`${ROLES}/${id}/permissions`, { permissions }))
}

/* ---------------------------- Permissions --------------------------- */

/** Permissions granted to this company. */
export function listPermissions(): Promise<Permission[]> {
  return unwrap(api.get<ApiSuccess<Permission[]>>(PERMISSIONS))
}

/** The canonical catalogue of every permission the platform defines. */
export function listPermissionCatalog(): Promise<string[]> {
  return unwrap(api.get<ApiSuccess<string[]>>(`${PERMISSIONS}/catalog`))
}
