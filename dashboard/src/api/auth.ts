import { api, unwrap, type ApiSuccess } from '@/lib/axios'
import type {
  AuthUser,
  Company,
  CreateCompanyPayload,
  CreateCompanyResult,
  LoginPayload,
  UpdateCompanyPayload,
} from '@/types/entities'

/**
 * Auth endpoints.
 *
 * Tokens are never handled in JS: the API sets access_token and
 * refresh_token as signed httpOnly cookies. Every call here relies on
 * `withCredentials` on the shared axios instance.
 */

/** POST /api/v1/auth/login - sets both auth cookies. */
export async function login(payload: LoginPayload): Promise<AuthUser> {
  const res = await api.post<ApiSuccess<{ user: AuthUser }>>('/api/v1/auth/login', payload)
  return res.data.data.user
}

/** GET /api/v1/auth/me - used for session restore on boot. */
export function getCurrentUser(): Promise<AuthUser> {
  return unwrap(api.get<ApiSuccess<AuthUser>>('/api/v1/auth/me'))
}

/** POST /api/v1/auth/logout - clears cookies for this session only. */
export async function logout(): Promise<void> {
  await api.post('/api/v1/auth/logout', {})
}

/** POST /api/v1/auth/logout-all - revokes every session for the user. */
export async function logoutAll(): Promise<void> {
  await api.post('/api/v1/auth/logout-all', {})
}

/** GET /api/v1/companies/current - tenant profile for the Settings page. */
export function getCurrentCompany(): Promise<Company> {
  return unwrap(api.get<ApiSuccess<Company>>('/api/v1/companies/current'))
}

/** PATCH /api/v1/companies/current */
export function updateCurrentCompany(payload: UpdateCompanyPayload): Promise<Company> {
  return unwrap(api.patch<ApiSuccess<Company>>('/api/v1/companies/current', payload))
}

/** PNG, JPEG and WebP are the only accepted logo types; the API sniffs content. */
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp']

/** Anything at or above 2MB is refused with "request file too large". */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024

/**
 * PATCH /api/v1/companies/current with a logo file attached.
 *
 * The same endpoint takes multipart: the file goes in a field named `logo`
 * (any other name is "Unexpected file field"), and the API stores it and
 * returns the served path as `logoUrl`, e.g. /uploads/logos/<uuid>.png.
 *
 * At least one TEXT field must accompany the file - a logo on its own fails
 * with "At least one field is required" - so the caller's other values are
 * always appended alongside.
 */
export function updateCurrentCompanyWithLogo(
  payload: UpdateCompanyPayload,
  logo: File,
): Promise<Company> {
  const form = new FormData()
  for (const [key, value] of Object.entries(payload)) {
    // Skip logoUrl: the uploaded file supersedes it, and sending both is
    // contradictory.
    if (key === 'logoUrl' || value === undefined || value === null) continue
    form.append(key, String(value))
  }
  form.append('logo', logo)

  return unwrap(api.patch<ApiSuccess<Company>>('/api/v1/companies/current', form))
}

/**
 * GET /api/v1/companies - every company on the platform.
 *
 * SUPER ADMIN ONLY: a company admin gets 403 here and must use
 * /companies/current instead.
 */
export function listCompanies(): Promise<Company[]> {
  return api
    .get<ApiSuccess<Company[]>>('/api/v1/companies', { params: { limit: 100 } })
    .then(({ data }) => (Array.isArray(data.data) ? data.data : []))
}

/**
 * POST /api/v1/companies - super admin only.
 *
 * Provisions the company, a main branch and the first admin user together,
 * and returns all three.
 */
export function createCompany(payload: CreateCompanyPayload): Promise<CreateCompanyResult> {
  return unwrap(api.post<ApiSuccess<CreateCompanyResult>>('/api/v1/companies', payload))
}
