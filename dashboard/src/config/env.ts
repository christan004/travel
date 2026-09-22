/**
 * Typed access to Vite env vars.
 *
 * Validated at module load so a missing base URL fails loudly at startup
 * instead of producing confusing relative-URL 404s at request time.
 */
interface AppEnv {
  /** Base URL axios prefixes onto every request. Empty string in dev when proxying. */
  apiBaseUrl: string
  /** The configured upstream API, regardless of proxying. For display/debugging. */
  apiOrigin: string
  isDev: boolean
  usingDevProxy: boolean
}

function required(name: string, value: string | undefined): string {
  if (!value || !value.trim()) {
    throw new Error(
      `[env] Missing ${name}. Copy .env.example to .env and set it before starting the app.`,
    )
  }
  return value.trim().replace(/\/+$/, '') // never keep a trailing slash
}

const apiOrigin = required('VITE_API_BASE_URL', import.meta.env.VITE_API_BASE_URL)

/**
 * In development the Vite server proxies /api to the upstream host (see
 * vite.config.ts). Requests must then be same-origin relative paths, so the
 * axios baseURL is intentionally empty. In production the app talks to the
 * API directly and needs the absolute origin.
 */
const usingDevProxy = import.meta.env.DEV && import.meta.env.VITE_USE_DEV_PROXY !== 'false'

export const env: AppEnv = {
  apiBaseUrl: usingDevProxy ? '' : apiOrigin,
  apiOrigin,
  isDev: import.meta.env.DEV,
  usingDevProxy,
}
