# API reference

This dashboard was built against the SwiftBus OpenAPI 3.0.3 contract
(Apidog export). Every type in `src/types/entities.ts` and every call in
`src/api/` mirrors it.

`openapi.placeholder.json` records only the servers and the key caveats --
**it is not the full contract.** The complete export was supplied during
development but is not committed here. To make this directory authoritative,
drop the full export in as `openapi.json` and delete the placeholder.

The API does not serve its own spec (`/openapi.json`, `/docs/json`,
`/documentation/json` and `/swagger.json` all return 404), so it cannot be
fetched automatically.

## Caveats the dashboard works around

See the main README for the full explanation.

- **No statistics endpoint.** Dashboard KPIs are derived client-side from
  `/tickets`, `/routes` and `/cars`.
- **No payments/transactions endpoint.** The Payments page derives real
  amounts from bookings and marks method/fees/transaction-id as placeholders.
- **CORS blocks browsers.** No `access-control-allow-origin` header, and
  preflight allows only `GET,HEAD,POST` -- so `PATCH`/`PUT`/`DELETE` fail.
  Development proxies through Vite to work around this.
