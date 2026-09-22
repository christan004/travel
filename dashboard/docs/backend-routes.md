# Backend: `/api/v1/routes`

Findings from probing the live API on 2026-09-13.

This endpoint is **well designed**: flat rows, correct `meta.total`, working
pagination and `?search=`, a true partial PATCH, and — unusually for this API
— clear, specific validation messages. The change is that a route now has a
type, and composite routes carry segments.

## `routeType` is required: `DIRECT` | `COMPOSITE`

Omitting it fails:

```
POST {... no routeType}  -> 400 routeType: Invalid option: expected one of "DIRECT"|"COMPOSITE"
```

- **DIRECT** — a single hop. Must send **no** segments.
- **COMPOSITE** — assembled from two or more DIRECT routes via `segments`.

```json
{ "name": "Kigali to Huye", "routeType": "COMPOSITE",
  "fromLocationId": "...", "toLocationId": "...",
  "distance": "125.00", "estimatedTimeInMinutes": 150,
  "latLong": null, "status": "active",
  "segments": [ { "segmentRouteId": "...", "sequence": 1 },
                { "segmentRouteId": "...", "sequence": 2 } ] }
```

## The composite rules, as enforced

Every one of these is checked server-side; the dashboard mirrors all of them
so they surface in the form rather than as a failed submit.

| Rule | Violation response |
|---|---|
| COMPOSITE needs segments | `400 A composite route requires segments` |
| ...at least **2** | `400 Too small: expected array to have >=2 items` |
| DIRECT must have none | `400 A direct route cannot contain segments` |
| `sequence` > 0 | `400 segments.0.sequence: Too small: expected number to be >0` |
| Sequences consecutive from 1 | `422 Route segment sequences must be consecutive starting at 1` |
| No duplicates, no self-reference | `422 A route cannot contain duplicate segments or itself` |
| Segments must be DIRECT routes | `404 Segment route not found` (when given a COMPOSITE id) |
| Chain must connect end to end | `422 Route segments must start and end at the main route locations` |

The last one is the subtle one: each leg must start where the previous ended,
the first must start at the route's `fromLocationId`, and the last must end at
its `toLocationId`. The message does not say **where** the chain broke, so the
dashboard reports that itself ("Segment 2 starts at GAKENKE, but segment 1
ends at NYIRAGARAMA").

### Composites cannot nest

Passing a COMPOSITE route's id as a `segmentRouteId` returns
`404 Segment route not found`. That is presumably deliberate, but the message
is misleading — the route exists; it is just not an eligible segment.
`422` with "segments must be direct routes" would be clearer.

## Reads embed the whole segment route

`segments[]` comes back with the full nested `segmentRoute` object — name,
endpoints, distance, duration — so a composite can be described without any
follow-up fetch:

```json
"segments": [ { "id": "...", "mainRouteId": "...", "segmentRouteId": "...",
                "sequence": 1,
                "segmentRoute": { "id": "...", "name": "SEG A ...",
                                  "routeType": "DIRECT", "distance": "40", ... } } ]
```

DIRECT routes return `"segments": []`. This is the **most useful embedding in
the API** — compare `/trips`, which returns a bare `driverCarId` and forces a
second request.

## Contract as it stands

| Verb | Path | Notes |
|---|---|---|
| GET | `/routes` | Flat rows, correct `meta.total`, paging and `?search=` work; `segments` embedded on every row |
| GET | `/routes/{id}` | Same shape as a list row |
| POST | `/routes` | Requires `name`, `routeType`, `fromLocationId`, `toLocationId`, `distance`, `estimatedTimeInMinutes`. `latLong` nullable, `status` defaults `active` |
| PATCH | `/routes/{id}` | True partial update; `segments` may be replaced wholesale. Empty body → "At least one field is required" |
| DELETE | `/routes/{id}` | `204 No Content` |

### Deleting a route used as a segment

Not probed — worth confirming whether deleting a DIRECT route that a COMPOSITE
depends on is blocked, cascades, or silently orphans the composite. The
dashboard warns the user that composites built from a route may break.

### Status enum

`active` | `inactive` — the app-wide pair, not the `active` | `expired` used
by `/car-insurance` and `/car-controls`.
