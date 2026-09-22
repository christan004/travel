# Backend: `/api/v1/trip-points`

Findings from probing the live API on 2026-09-13.

> **No standalone page.** The dashboard has no trip-points list screen. Points
> are only meaningful within their trip, and this endpoint has no `?tripId=`
> filter to scope them to one, so a flat list of every point of every trip is
> not useful. They are read from the trips response (which embeds them in
> full) and edited in place in the trip detail timetable.

## It replaces `/trip-stops`, which now 404s

```
GET /api/v1/trip-stops  -> 404 Route GET:/api/v1/trip-stops not found
```

The dashboard's Trip stops page had therefore been broken. The shape changed
too: a point has a single `locationId`, not the `fromLocationId` /
`toLocationId` pair the old resource carried.

The permission was renamed with it — `trip_points.read` and
`trip_points.update` are granted; `trip_stops.*` no longer appears.

## Points are generated, not created

There is no POST and no DELETE — both return `404`. Points come into being
when a trip is created, one per route endpoint for a DIRECT route and one per
segment boundary for a COMPOSITE one, and they disappear with it (deleting a
trip removed all five of its points).

The granted permissions match: read and update only.

## PATCH accepts exactly three fields

```
PATCH {"status":"COMPLETED"}                 -> 200
PATCH {"actualArrivalAt":"..."}              -> 200
PATCH {"actualDepartureAt":"..."}            -> 200
PATCH {"scheduledArrivalAt":"..."}           -> 400 Unrecognized key
PATCH {"sequence":9}                         -> 400 Unrecognized key
PATCH {"locationId":"..."}                   -> 400 Unrecognized key
PATCH {}                                     -> 400 At least one field is required
```

The split is deliberate and sensible: the **schedule** is derived from the
route, and you record what **actually** happened against it. `null` clears an
actual time.

### Status enum

`PENDING` | `AVAILABLE` | `CLOSED` | `SKIPPED` | `CANCELLED` | `COMPLETED` —
unchanged from the old trip-stops enum.

## Shape

```json
{ "id": "...", "tripId": "...", "locationId": "...",
  "scheduledArrivalAt": null,
  "scheduledDepartureAt": "2026-10-10T06:00:00.000Z",
  "actualArrivalAt": null, "actualDepartureAt": null,
  "sequence": 1, "status": "AVAILABLE",
  "location": { "id": "...", "name": "NYABUGOGO", ... } }
```

`location` is embedded on both LIST and GET-by-id, so stop names need no
lookup. The first point of a trip has no `scheduledArrivalAt` and the last no
`scheduledDepartureAt` — you do not arrive at the origin or depart the
destination.

`trip` is **not** embedded, so showing which trip a point belongs to still
needs the trips lookup. Embedding at least the trip's route name and
departure would make this page standalone.

## `?tripId=` is rejected

```
GET ?tripId=<id>  -> 400 Unrecognized key: "tripId"
GET ?search=x     -> 400 Unrecognized key: "search"
```

`?status=` works, and paging works. **`?tripId=` is the one filter this
resource really needs** — points are only meaningful grouped by trip, and
without it a client must page through every point of every trip to show one
trip's schedule. Worth adding.

## Contract as it stands

| Verb | Path | Notes |
|---|---|---|
| GET | `/trip-points` | Flat rows embedding `location`; correct `meta.total`; paging and `?status=` work; `?tripId=` and `?search=` **400** |
| GET | `/trip-points/{id}` | Same shape as a list row |
| POST | — | **404**, points are generated with the trip |
| PATCH | `/trip-points/{id}` | Only `status`, `actualArrivalAt`, `actualDepartureAt` |
| DELETE | — | **404**, points are removed with the trip |
