# SwiftBus Dashboard

Admin dashboard for the SwiftBus bus-ticketing and travel-management platform.
React + TypeScript + Vite, talking to the multi-tenant Fastify API at
`https://tickets.quicko.rw`.

---

## Quick start

```bash
npm install
cp .env.example .env     # set VITE_API_BASE_URL if not using the default
npm run dev              # http://localhost:5173
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server with API proxy and HMR |
| `npm run build` | Type-check, then production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Type-check only |

---

## Read this first: one API gap

Every page in this dashboard maps to a real endpoint in the SwiftBus OpenAPI
spec (see `docs/`), with a single exception.

### The Dashboard has no statistics endpoint

There is no `/dashboard` or `/stats` resource, so `src/api/dashboard.ts`
derives every KPI client-side from real `/tickets`, `/routes`, `/trips`,
`/cars` and `/drivers` data.

Consequences worth knowing:

- The API caps `limit` at **100**, so revenue and "tickets sold today" are
  computed over the most recent 100 tickets, not the whole table. Headline
  counts use `meta.total`, which is accurate.
- Cancelled and refunded tickets are excluded from revenue.
- Sources are fetched with `Promise.allSettled`, so a user lacking
  `routes.read` still sees ticket KPIs; the UI flags this via `partial`.

The Dashboard page carries a visible notice explaining this. **To replace it:**
swap the body of `getDashboardStats()` with a single call to a real aggregate
endpoint.

There is also no transactions resource anywhere in the spec, so there is **no
Payments page**. The nearest equivalent is `/company-accounts` (a code and a
name), which has its own page under Administration.

---

## Heads-up: the API's CORS config blocks browsers

Probing the deployed API from a browser origin:

```
OPTIONS /api/v1/auth/login   Origin: http://localhost:5173
  access-control-allow-credentials: true
  access-control-allow-methods: GET,HEAD,POST
  (no access-control-allow-origin)
```

Two problems:

1. **No `access-control-allow-origin` header.** Browsers block every
   cross-origin response without it, even with credentials allowed.
2. **`PATCH`, `PUT` and `DELETE` are missing** from the allowed methods, so
   every edit and delete in this dashboard would be rejected at preflight.

Until the backend is fixed, `npm run dev` proxies `/api` through the Vite
server (`vite.config.ts`), making requests same-origin so CORS does not apply.
`VITE_USE_DEV_PROXY=false` opts out.

**The proxy is a development convenience only.** A production deployment needs
the API to send, for the dashboard's origin:

```
access-control-allow-origin: https://your-dashboard-host
access-control-allow-credentials: true
access-control-allow-methods: GET,HEAD,POST,PATCH,PUT,DELETE
access-control-allow-headers: content-type
```

`access-control-allow-origin` must echo a specific origin — the wildcard `*`
is invalid when credentials are allowed, which is required here because auth
rides on cookies.

---

## Pages map 1:1 to API resources

Every page is named after, and backed by, a single endpoint in the spec --
there is no renaming or aliasing layer:

| Group | Pages |
| --- | --- |
| Operations | Tickets, Trips, Trip stops, Routes, Route prices, Locations, Passengers |
| Fleet | Cars, Seats, Baggage, Product types, Car insurance, Car controls, Drivers, Driver assignments |
| Administration | Branches, Company accounts, Settings (company, users, roles, permissions) |

Sixteen of these are generated from a declarative config rather than written
by hand -- see **Generated CRUD** below. Passengers keeps a bespoke page
because it has a booking-history view, and Settings is tabbed.

---

## Architecture

```
src/
  lib/axios.ts             Axios instance + refresh interceptor (see below)
  lib/queryClient.ts       Query client + query-key registry
  config/env.ts            Validated env access; fails loudly if unset
  providers/               Query, Auth, Sidebar, Theme
  context/                 AuthContext, SidebarContext (no prop drilling)
  api/resource.ts          Generic CRUD client factory
  api/resources.ts         One client per API resource
  hooks/useResource.ts     Generic React Query bindings
  components/ui/           Owned shadcn primitives
  components/common/       DataTable, StatCard, StatusBadge, FormInput, FormSelect
  components/layout/       Sidebar, Topbar, AppShell
  features/resource/       The CRUD generator + per-resource configs
  features/pages/          The 16 generated pages
  routes/                  Route tree, lazy-loaded
  types/entities.ts        Domain types mirroring the OpenAPI schema
```

### Generated CRUD

Sixteen resources share the same screen: a table with a status filter,
per-page search, pagination, a create/edit dialog and a delete confirm. Rather
than sixteen near-identical components, each is a **declarative config** in
`features/resource/configs/` describing its columns, form fields, validation
schema and payload mapping. `ResourcePage` renders it.

Adding a resource is three steps:

1. Add a client in `api/resources.ts` (one line).
2. Write a config: columns, fields, Yup schema, `toPayload`.
3. Export the page and add a route and nav entry.

Foreign keys render as human labels via a shared lookup layer, and appear in
forms as searchable selects. `toPayload` is where a config converts form
strings into what the API expects — ISO-8601 UTC for dates, real booleans,
`null` for blanks, fixed-precision decimal strings.

**State ownership.** React Query owns all server state; fetched data is never
copied into `useState`. `useState` covers UI only — dialog visibility, filters,
sidebar collapse. Auth and sidebar state live in context.

**Permissions.** Each config names a permission prefix, so `trips.create` gates
the New button, `trips.update` the Edit action and `trips.delete` the Delete
action. Nav items and whole sidebar groups hide when a user cannot read any
resource in them.

**The refresh interceptor** (`src/lib/axios.ts`) is the piece worth reading
first. On a 401 it refreshes once and replays the failed request. When several
requests 401 at the same time, an `isRefreshing` flag plus a queue guarantees
exactly one refresh: the rest park and replay after it resolves. Without that,
each failure would rotate the token again and invalidate the cookie the others
are waiting on. The refresh call uses bare `axios`, not the shared instance, so
a failing refresh cannot recurse into itself. Auth endpoints are excluded — a
401 from `/auth/login` is the answer, not a stale-token symptom.

**Errors.** Every call rejects with `ApiError` carrying the API's `code`,
`message` and `requestId`, so UI code never unwraps an `AxiosError`. Terminal
errors (401/403/404, validation, business-rule) are not retried.

**Auth.** Tokens are httpOnly cookies and never touched by JS; every request
sets `withCredentials`. Login takes only email and password — the API resolves
the tenant from the account and returns the user's `companyId`. Permission
strings from `/auth/me` gate sidebar items, with `resource.manage` implying
every `resource.*` action.

---

## Verified behaviour

Checked in a headless browser against a stubbed API:

- All 19 pages render with the right heading and data; no console errors
- Unauthenticated visits redirect to `/login`; protected routes too
- Sidebar collapses 256px → 72px; mobile drawer opens
- No horizontal overflow at 390px on any page
- Formik + Yup validation blocks empty submits and issues no request
- Brand green resolves to exactly `rgb(31, 138, 88)` (`#1F8A58`)
- Exactly one `/auth/me` and one refresh attempt per cold load

A full create was driven through the Trip form and the `POST /api/v1/trips`
body checked against the spec: cuid foreign keys, ISO-8601 UTC timestamps
(local `08:30` correctly sent as `06:30Z`), a real boolean for `hasStops`,
`null` for the blank optional date, and no extra keys — `additionalProperties:
false` would otherwise reject it. 8/8 checks passed.

Route-level code splitting keeps the initial bundle small; recharts loads only
with the dashboard, and the 16 generated pages share one chunk.

---

## Known limits

- **Search is per-page.** Only `/users`, `/roles`, `/cars` and a few others
  accept a `search` parameter; the operations resources do not. Rather than
  send a query the API ignores, search filters the loaded page client-side and
  each page says so.
- **Lookups cap at 100.** Select options and id→label joins load one page of
  each referenced resource. Beyond that a foreign key falls back to showing
  the last 8 characters of its id.
- The notification bell and topbar search are presentational — no endpoint
  backs either.
- Passenger booking history matches on phone number, the only field
  `/passengers` and `/tickets` share.
- Creating a passenger requires at least one existing ticket id
  (`ticketIds`, min 1), per the API.
- `/company-accounts` has no DELETE in the spec (only GET, POST, PATCH and
  PATCH `/:id/status`), so deleting one will fail server-side.
- Trip stops, seats and baggage have no server-side filter by parent, so those
  pages list every record for the company.
