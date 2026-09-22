# Backend: `/api/v1/route-prices`

Findings from probing the live API on 2026-09-12.

Good news first: the list is **flat** (not grouped like `/car-controls` or
`/car-insurance`), `meta.total` is correct, paging works, and `?status=`
actually filters. Three problems remain, one of them serious.

## 1. PATCH without `routeId` always 409s — editing a price is impossible

Changing a price, status or currency on its own is rejected:

```
PATCH {"price":"4000.00"}      -> 409 RESOURCE_ALREADY_EXISTS
PATCH {"status":"inactive"}    -> 409 RESOURCE_ALREADY_EXISTS
PATCH {"currency":"USD"}       -> 409 RESOURCE_ALREADY_EXISTS
PATCH {"routeId":"<same id>","price":"4000.00"}  -> 200 OK
```

Reproduced on two separate records. The uniqueness check evidently runs
against the record's own row when `routeId` is absent from the patch, so a
record collides with itself.

**Impact.** Any client doing a normal partial update cannot edit a fare at
all. This is the one worth fixing first.

**Workaround.** The dashboard resends `routeId` on every edit, unchanged.

## 2. `fromLocationId` / `toLocationId` are derived, and rejected on write

They are copied from the route (verified: they match the route's own
`fromLocationId` / `toLocationId` exactly) and sending them is refused:

```
POST  {... "fromLocationId": "...", "toLocationId": "..."}
  -> 400 Unrecognized keys: "fromLocationId", "toLocationId"
PATCH {"fromLocationId":"..."}
  -> 400 Unrecognized key: "fromLocationId"
```

They are still returned on reads. Treated as read-only echoes: the form asks
only for the route, and the table shows the endpoints as columns.

## 3. `?search=` and `?routeId=` are rejected, not ignored

```
GET ?search=3500   -> 400 Unrecognized key: "search"
GET ?routeId=<id>  -> 400 Unrecognized key: "routeId"
```

Note this differs from `/car-controls` and `/car-insurance`, where unknown
query keys are silently ignored. Here they hard-fail, so a client that sends
a search param gets no data at all rather than unfiltered data.

The dashboard sends neither.

## One price per route

A second POST for a route that already has a price returns
`409 RESOURCE_ALREADY_EXISTS`. That looks intentional. The dashboard greys out
already-priced routes in the picker so the error is not reachable from the UI
(within the loaded page; a duplicate on a later page still surfaces the 409).

## Contract as it stands

| Verb | Path | Notes |
|---|---|---|
| GET | `/route-prices` | Flat rows, correct `meta.total`, paging and `?status=` work; unknown query keys **400** |
| GET | `/route-prices/{id}` | Same shape as a list row |
| POST | `/route-prices` | `{ routeId, price, currency?, status? }`. `routeId` + `price` required; `currency` defaults to `null`, `status` to `active`. Accepts `price` as string or number; returns it unpadded (`"3500"`) |
| PATCH | `/route-prices/{id}` | **Must include `routeId`** (see 1). Empty body → "At least one field is required" |
| DELETE | `/route-prices/{id}` | `204 No Content` |

### Status enum

`active` | `inactive` here — the app-wide pair, **not** the `active` |
`expired` used by `/car-insurance` and `/car-controls`.
