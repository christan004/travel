import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { env } from '@/config/env'

/**
 * Envelope used by every SwiftBus endpoint.
 *   success: true  -> { success, data, meta? }
 *   success: false -> { success, error: { code, message, details, requestId } }
 */
export interface ApiMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ApiSuccess<T> {
  success: true
  data: T
  meta?: ApiMeta
}

export interface ApiErrorBody {
  success: false
  error: {
    code: string
    message: string
    details: unknown
    requestId: string
  }
}

/** Error codes the API returns, per the OpenAPI spec. */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTH_TOKEN_INVALID'
  | 'PERMISSION_DENIED'
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_ALREADY_EXISTS'
  | 'BUSINESS_RULE_VIOLATION'
  | 'NETWORK_ERROR'
  | 'UNKNOWN'

/**
 * Normalised error thrown by every API call, so UI code never has to
 * unwrap an AxiosError to show a message.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly details: unknown
  readonly requestId?: string

  constructor(init: {
    message: string
    code?: ApiErrorCode
    status?: number
    details?: unknown
    requestId?: string
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.code = init.code ?? 'UNKNOWN'
    this.status = init.status ?? 0
    this.details = init.details
    this.requestId = init.requestId
  }

  get isAuthError() {
    return this.status === 401 || this.code === 'AUTH_TOKEN_INVALID'
  }

  get isPermissionError() {
    return this.status === 403 || this.code === 'PERMISSION_DENIED'
  }
}

/**
 * `withCredentials` is essential here: the API issues access_token and
 * refresh_token as signed httpOnly cookies, so the browser must be allowed
 * to attach them cross-origin.
 */
export const api: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

/**
 * Let the browser set the Content-Type for FormData bodies.
 *
 * The instance defaults to application/json, which would override the
 * multipart type AND drop the boundary parameter - the server then cannot
 * parse the parts at all. Deleting the header makes the browser emit
 * `multipart/form-data; boundary=...` itself. Needed by the company logo
 * upload; see updateCurrentCompanyWithLogo.
 */
api.interceptors.request.use((config) => {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

/* ------------------------------------------------------------------ *
 * Refresh-token handling
 *
 * Goal: when N requests fail with 401 at once, fire exactly ONE refresh
 * and replay all N afterwards. Without the queue each failed request
 * would trigger its own refresh, rotating the token repeatedly and
 * invalidating the very cookie the other requests are waiting on.
 * ------------------------------------------------------------------ */

/** Marks a request we have already retried, so a replay cannot loop forever. */
interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

let isRefreshing = false

/** Requests parked while a refresh is in flight. */
type QueueEntry = {
  resolve: (value: AxiosResponse) => void
  reject: (reason: unknown) => void
  config: RetriableConfig
}
let pendingQueue: QueueEntry[] = []

/** Notified when auth is unrecoverable, so AuthProvider can clear + redirect. */
type AuthFailureListener = () => void
const authFailureListeners = new Set<AuthFailureListener>()

export function onAuthFailure(listener: AuthFailureListener): () => void {
  authFailureListeners.add(listener)
  return () => {
    authFailureListeners.delete(listener)
  }
}

function emitAuthFailure() {
  authFailureListeners.forEach((listener) => {
    try {
      listener()
    } catch {
      // A broken listener must never mask the original auth error.
    }
  })
}

/** Replay everything parked during the refresh. */
function flushQueue(error: unknown | null) {
  const queue = pendingQueue
  pendingQueue = []

  queue.forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error)
      return
    }
    // Cookies were rotated by the server; just re-issue the request.
    api(config).then(resolve).catch(reject)
  })
}

/**
 * Endpoints that must never trigger a refresh attempt: a 401 from them IS
 * the answer, not a stale-token symptom.
 */
const NO_REFRESH_PATHS = ['/api/v1/auth/login', '/api/v1/auth/refresh', '/api/v1/auth/logout']

function shouldSkipRefresh(url: string | undefined): boolean {
  if (!url) return false
  return NO_REFRESH_PATHS.some((p) => url.includes(p))
}

function toApiError(error: AxiosError<ApiErrorBody>): ApiError {
  const status = error.response?.status ?? 0
  const body = error.response?.data

  if (body && typeof body === 'object' && 'error' in body && body.error) {
    return new ApiError({
      message: body.error.message || error.message,
      code: (body.error.code as ApiErrorCode) ?? 'UNKNOWN',
      status,
      details: body.error.details,
      requestId: body.error.requestId,
    })
  }

  if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
    return new ApiError({
      message: 'Cannot reach the server. Check your connection and try again.',
      code: 'NETWORK_ERROR',
      status,
    })
  }

  return new ApiError({ message: error.message || 'Something went wrong.', status })
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as RetriableConfig | undefined
    const status = error.response?.status

    // Anything that is not a recoverable 401 short-circuits to a clean error.
    // Note a 401 from /auth/me on boot simply means "no session"; only refresh
    // exhaustion below clears auth state and redirects.
    if (status !== 401 || !original || original._retry || shouldSkipRefresh(original.url)) {
      return Promise.reject(toApiError(error))
    }

    // A refresh is already running: park this request and replay it later.
    if (isRefreshing) {
      return new Promise<AxiosResponse>((resolve, reject) => {
        pendingQueue.push({ resolve, reject, config: original })
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      // Bare axios, not `api`: this must bypass the interceptor so a failed
      // refresh can never recurse back into itself.
      await axios.post(
        `${env.apiBaseUrl}/api/v1/auth/refresh`,
        {},
        { withCredentials: true, timeout: 15_000 },
      )

      flushQueue(null)
      return await api(original) // retry the request that started it all
    } catch (refreshError) {
      const apiError = axios.isAxiosError(refreshError)
        ? toApiError(refreshError as AxiosError<ApiErrorBody>)
        : new ApiError({
            message: 'Session expired. Please sign in again.',
            code: 'AUTH_TOKEN_INVALID',
            status: 401,
          })

      flushQueue(apiError)
      emitAuthFailure() // AuthProvider clears cache and routes to /login
      return Promise.reject(apiError)
    } finally {
      isRefreshing = false
    }
  },
)

/* ------------------------------------------------------------------ *
 * Typed request helpers
 * ------------------------------------------------------------------ */

/** Unwrap `{ success, data }` down to `data`. */
export async function unwrap<T>(promise: Promise<AxiosResponse<ApiSuccess<T>>>): Promise<T> {
  const { data } = await promise
  return data.data
}

/** Paginated list result, preserving `meta` for the table footer. */
export interface Paginated<T> {
  items: T[]
  meta: ApiMeta
}

export async function unwrapList<T>(
  promise: Promise<AxiosResponse<ApiSuccess<T[]>>>,
): Promise<Paginated<T>> {
  const { data } = await promise
  const items = Array.isArray(data.data) ? data.data : []
  return {
    items,
    meta: data.meta ?? { page: 1, limit: items.length, total: items.length, totalPages: 1 },
  }
}
