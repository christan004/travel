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
  /** The deployment proxies /api itself, so requests stay same-origin. */
  isSameOrigin: boolean
}

function required(name: string, value: string | undefined): string {
  if (!value || !value.trim()) {
    throw new Error(
      `[env] Missing ${name}. Copy .env.example to .env and set it before starting the app.`,
    )
  }
  return value.trim().replace(/\/+$/, '') // never keep a trailing slash
}

/**
 * Same-origin mode: `VITE_API_BASE_URL=same-origin`.
 *
 * The deployment serves /api itself (a reverse proxy in front of the
 * dashboard), so requests use relative paths and never leave the origin -
 * which sidesteps CORS entirely. That is how dashboard.quicko.rw is set up:
 * https://dashboard.quicko.rw/api/v1/... already reaches the API.
 *
 * Spelled explicitly rather than as an empty string so it cannot be confused
 * with a variable someone forgot to set.
 */
const SAME_ORIGIN = 'same-origin'

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
const isSameOrigin = rawBaseUrl === SAME_ORIGIN

const apiOrigin = isSameOrigin
  ? ''
  : required('VITE_API_BASE_URL', import.meta.env.VITE_API_BASE_URL)

/**
 * Vite INLINES env vars at build time, so a production bundle built with a
 * local API URL will make every visitor's browser call their OWN machine -
 * which fails as a CORS error naming localhost, far from the real cause.
 *
 * Fail loudly at startup instead, where the message points at the build.
 */
if (
  !import.meta.env.DEV &&
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(apiOrigin)
) {
  throw new Error(
    `[env] This production build points at ${apiOrigin}. ` +
      'VITE_API_BASE_URL was a local address when the bundle was built - ' +
      'set it to the public API URL and rebuild.',
  )
}

/**
 * In development the Vite server proxies /api to the upstream host (see
 * vite.config.ts). Requests must then be same-origin relative paths, so the
 * axios baseURL is intentionally empty. In production the app talks to the
 * API directly and needs the absolute origin.
 */
const usingDevProxy = import.meta.env.DEV && import.meta.env.VITE_USE_DEV_PROXY !== 'false'

export const env: AppEnv = {
  // Empty in dev-proxy and same-origin modes: axios then uses relative paths.
  apiBaseUrl: usingDevProxy || isSameOrigin ? '' : apiOrigin,
  apiOrigin,
  isDev: import.meta.env.DEV,
  usingDevProxy,
  isSameOrigin,
}
