# Deploying the dashboard

## The API URL is compiled in, not configured at runtime

Vite **inlines** `VITE_API_BASE_URL` into the JS bundle at build time. There is
no runtime config file to edit on the server: whatever the variable held when
`npm run build` ran is the URL the deployed site calls forever.

Concretely, it ends up as a literal inside `dist/assets/button-*.js` (the
chunk that carries axios):

```
grep -o 'https://[a-z.]*' dist/assets/button-*.js
https://tickets.quicko.rw
```

### The failure this causes

Building with a developer's local value produces a live site that asks every
visitor's browser to call **their own machine**:

```
Access to XMLHttpRequest at 'http://localhost:4179/api/v1/auth/login'
from origin 'https://dashboard.quicko.rw' has been blocked by CORS policy
```

The message says CORS, but the cause is the URL. Nothing is wrong with the
server; the bundle is simply pointed at localhost.

`.env.production` now pins the public URL for every production build, and
`src/config/env.ts` throws at startup if a production bundle was built with a
localhost address - so the failure names the build rather than surfacing as a
confusing CORS error.

### Building

```bash
npm run build      # uses .env.production
```

To deploy against a different API, change `.env.production` (or pass the
variable inline) and **rebuild**. Editing files on the server does nothing.

## The API does not yet send CORS headers

Fixing the URL is necessary but **not sufficient**. Probed 2026-09-22 against
the live API:

```
OPTIONS /api/v1/auth/login
  Origin: https://dashboard.quicko.rw
->
  HTTP/1.1 204 No Content
  access-control-allow-credentials: true
  access-control-allow-methods: GET,HEAD,POST
  vary: Origin, Access-Control-Request-Headers
```

Two gaps:

1. **No `access-control-allow-origin` header at all.** The browser rejects
   the response regardless of anything else, so every cross-origin request
   from `dashboard.quicko.rw` fails.
2. **`access-control-allow-methods` omits PATCH, PUT and DELETE.** Even once
   the origin header is added, every edit and delete in the dashboard would
   still be blocked - that is most of the app.

The API needs, for the dashboard's origin:

```
access-control-allow-origin: https://dashboard.quicko.rw
access-control-allow-methods: GET,HEAD,POST,PATCH,PUT,DELETE
access-control-allow-headers: content-type
access-control-allow-credentials: true
vary: Origin
```

`allow-credentials: true` means the origin must be echoed explicitly - `*` is
not permitted with cookies, and this app authenticates with httpOnly cookies.

Note the API already sets `cross-origin-resource-policy: same-origin`, which
also needs relaxing for a cross-origin dashboard.

### Until that is fixed

Two options that avoid CORS entirely by making requests same-origin:

- **Serve the dashboard from the API's domain** (e.g. `tickets.quicko.rw/app`)
  and build with `VITE_API_BASE_URL=` empty so requests use relative paths.
- **Reverse-proxy `/api` on the dashboard host** to the API, the way
  `vite.config.ts` does in development, and build with an empty base URL.

Both keep the browser talking to one origin, so no CORS headers are required.
