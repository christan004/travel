# Backend: `/api/v1/trips`

Findings from probing the live API on 2026-09-12, updated 2026-09-13.

> **Updated 2026-09-13:** the write shape shrank to four fields. `hasStops`
> and `arrivalAt` are now REJECTED on create, and PATCH accepts only
> `driverCarId` and `status`. See "Write shape" below.

This endpoint is otherwise well behaved: flat rows, correct `meta.total`,
working pagination and `?status=` filter.

## Write shape (changed)

Create takes exactly four fields:

```json
{ "routeId": "...", "driverCarId": "...",
  "departureAt": "2026-09-12T08:00:00.000Z", "status": "active" }
```

`routeId`, `driverCarId` and `departureAt` are required; `status` defaults to
`active`. Anything else is refused:

```
POST {... "hasStops": false}   -> 400 Unrecognized key: "hasStops"
POST {... "arrivalAt": "..."}  -> 400 Unrecognized key: "arrivalAt"
```

### `arrivalAt` is computed

The API sets it to departure + the route's `estimatedTimeInMinutes`. A trip
on a 200-minute route departing 08:00 came back with `arrivalAt` 11:20 -
exactly 200 minutes.

### `hasStops` is obsolete: `points[]` replaces it

The API now generates a timetabled stop list from the route. A DIRECT route
yields 2 points (origin, destination); a COMPOSITE route yields one per
segment boundary. A 4-segment composite produced 5:

```
1 NYABUGOGO    dep 06:00              AVAILABLE
2 NYIRAGARAMA  arr 09:20  dep 09:20   PENDING
3 GAKENKE      arr 12:40  dep 12:40   PENDING
4 MUSANZE      arr 16:00  dep 16:00   PENDING
5 RUBAVU       arr 19:20              PENDING
```

The first point has no arrival and the last no departure. So a trip "has
stops" exactly when its route has segments - the flag was redundant.

## PATCH accepts only `driverCarId` and `status`

Everything else is an unrecognized key:

```
PATCH {"status":"inactive"}          -> 200
PATCH {"driverCarId":"..."}          -> 200
PATCH {"routeId":"..."}              -> 400 Unrecognized key
PATCH {"departureAt":"..."}          -> 400 Unrecognized key
PATCH {"arrivalAt":"..."}            -> 400 Unrecognized key
```

**A scheduled trip cannot be re-routed or rescheduled** - only reassigned to
a different driver/vehicle, or deactivated. If rescheduling is meant to be
possible, `departureAt` needs to be writable (and `arrivalAt` plus `points`
recomputed with it). Otherwise the workflow is delete-and-recreate, which
loses any tickets already sold against the trip.

## GET-by-id is a different, deeper shape - but strips ids

`GET /trips/{id}` returns far more than a list row: the operating `company`,
the route's `prices` and `segments`, and the whole vehicle - `product`,
`seats`, `baggage`, `controls`, `CarInsurance`.

The catch is that it **removes ids from the nested records**:

| | list row | GET by id |
|---|---|---|
| `route.id` | present | **absent** |
| `vehicle.id` / `carId` / `driverId` | present | **absent** |
| `points[]` | full points (id, sequence, status, times) | **only `location`** |

So the detail response cannot drive anything editable, and cannot link to the
route or vehicle it describes. TripDetailPage therefore makes two requests:
this one for the depth, and `/trip-points` for a timetable with ids.

Returning the ids alongside the expanded objects would remove that second
request and let the page link through to the route and vehicle. Note also
that `CarInsurance` is capitalised while every sibling key (`seats`,
`baggage`, `controls`, `prices`) is not.

## Reads now embed route, vehicle and points

Both LIST and GET-by-id include `route` (with its locations, prices and
segments), `vehicle` (the driver-assignment with its `driver` and `car`), and
`points`. The earlier note that rows carry only a bare `driverCarId` no
longer applies - this is now one of the richest responses in the API.

## Departure dates in the past are accepted

`departureAt: "2020-01-01T08:00:00.000Z"` was created without complaint.
Probably worth rejecting, or at least warning, for new trips.

---

## Earlier finding: `vehicleId` + `driverId` replaced by `driverCarId`

A trip no longer names a vehicle and a driver separately. It references a
**driver-assignment** (a driver+car pairing) by id:

```json
{ "routeId": "...", "driverCarId": "...", "hasStops": false,
  "departureAt": "2026-09-12T08:00:00.000Z", "arrivalAt": null,
  "status": "active" }
```

The old shape is rejected outright:

```
POST {... "vehicleId": "...", "driverId": "..."}
  -> 400 driverCarId: expected string, received undefined
     Unrecognized keys: "vehicleId", "driverId"
```

`driverCarId` is an id from **`/api/v1/driver-assignments`**, whose list
embeds both sides of the pairing:

```json
{ "id": "cmtykt0e...", "carId": "...", "driverId": "...", "status": "active",
  "car":    { "id": "...", "plateNumber": "RAB321A" },
  "driver": { "id": "...", "firstName": "TWAGIRAMUNGU", "lastName": "Paul" } }
```

The dashboard uses that to label the picker "TWAGIRAMUNGU Paul - RAB321A".

Note the path is `/driver-assignments`; **`/driver-car-assignments` returns
404**, despite `driver_car_assignments.*` being the permission name.

### Trip rows now embed the pairing

Resolved as of 2026-09-13: rows carry `vehicle` with its `driver` and `car`,
so no follow-up fetch is needed.

## A nonexistent `driverCarId` returns a misleading 409

```
POST {... "driverCarId": "cm1234567890123456789007"}
  -> 409 BUSINESS_RULE_VIOLATION "The resource is still referenced by other records"
```

That message describes a delete conflict, not a missing foreign key. Same bug
as `/car-insurance` with a bad `carId`; a `404` or a validation error naming
`driverCarId` would be correct.

## `?startDate=` / `?endDate=` filter `createdAt`, not `departureAt`

Both are accepted as QUERY params (and rejected in the create body:
`POST {... "startDate": "..."}` -> 400 Unrecognized keys). Inclusive bounds,
`YYYY-MM-DD`.

The catch is which column they filter. With four trips all created
2026-09-17 but departing October to December:

```
?startDate=2026-09-16              -> 4 rows   (created after the 16th)
?startDate=2026-09-18              -> 0 rows   (none created after the 18th)
?startDate=2026-09-16&endDate=2026-09-18 -> 4 rows
?startDate=2026-09-01&endDate=2026-09-10 -> 0 rows
?startDate=2026-11-01&endDate=2026-11-30 -> 0 rows  (departures ARE in Nov)
```

The last line is the tell: a November range excludes trips that depart in
November, because they were *recorded* in September. So the filter is on
`createdAt`.

**This is probably not what the UI wants.** An operator asking "which trips
run next week" needs a `departureAt` range; "which trips were entered last
week" is an audit question. The dashboard labels the filter **"Created from
/ to"** and shows a note saying so, rather than implying it filters
departures. A `departureFrom` / `departureTo` pair (or switching these two to
`departureAt`) would make the trips list far more useful - that is the single
highest-value change on this endpoint.

## `?search=` and `?routeId=` are rejected, not ignored

```
GET ?routeId=<id>  -> 400 Unrecognized key: "routeId"
GET ?search=x      -> 400 Unrecognized key: "search"
```

Like `/route-prices`, and unlike `/car-controls`, unknown query keys hard-fail
here, so a client sending one gets no data rather than unfiltered data. A
`?routeId=` filter would be genuinely useful on this resource.

## Contract as it stands

| Verb | Path | Notes |
|---|---|---|
| GET | `/trips` | Flat rows embedding `route`, `vehicle` and `points`; correct `meta.total`; paging, `?status=` and `?startDate=`/`?endDate=` (on **`createdAt`**) work; other query keys **400** |
| GET | `/trips/{id}` | Same shape as a list row |
| POST | `/trips` | Requires `routeId`, `driverCarId`, `departureAt`; `status` defaults `active`. `hasStops` and `arrivalAt` are **rejected** |
| PATCH | `/trips/{id}` | Only `driverCarId` and `status`. Empty body → "At least one field is required" |
| DELETE | `/trips/{id}` | `204 No Content` |

### Status enum

`active` | `inactive` — the app-wide pair, **not** the `active` | `expired`
used by `/car-insurance` and `/car-controls`.
