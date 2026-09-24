# Backend: `/api/v1/tickets/trips`

Findings from probing the live API (alphaapi.quicko.rw) on 2026-09-23.

## Sales grouped by trip, not a flat ticket list

`GET /tickets/trips` returns one row per departure, each with a `summary`:

```json
{ "id": "...", "departureAt": "...", "arrivalAt": "...", "status": "active",
  "route":   { "name": "NYABUGOGO-RUBAVU", "routeType": "COMPOSITE",
               "fromLocation": {...}, "toLocation": {...} },
  "vehicle": { "car": { "plateNumber": "RAB321A", "totalSeats": 29 },
               "driver": { "firstName": "Uwimana", "phoneNumber": "..." } },
  "summary": { "total": 7, "seats": 7, "revenue": "170.00", "currency": "RWF",
               "byStatus": { "BOOKED": 6, "EXPIRED": 1 } } }
```

`byStatus` only lists non-zero statuses, so a client must not assume every
status key is present.

The flat `/tickets` endpoint still exists, but it cannot answer "how did this
departure do" without the caller aggregating it.

## `?startDate=` / `?endDate=` filter DEPARTURE here

Unlike `/trips`, where the same parameters filter `createdAt` (see
`backend-trips.md`), these filter `departureAt`:

```
two trips, both created 2026-09-22, departing 09-22 and 09-23
?startDate=2026-09-23  ->  1 row (the 09-23 departure)
```

That is the useful behaviour for a sales report, and the dashboard labels the
control "Departing from / to" accordingly.

`?search=` and paging work. `?routeId=` is rejected as an unrecognized key.

## The ticket status enum has SIX values

```
expected one of "PENDING_PAYMENT"|"BOOKED"|"CANCELLED"|"COMPLETED"|"REFUNDED"|"EXPIRED"
```

`PENDING_PAYMENT` and `EXPIRED` were missing from the dashboard's type, which
mislabelled live tickets: a seat is held while payment is attempted, and the
hold lapses to EXPIRED if it never completes.

## GET-by-id adds stops, tickets and payments

`GET /tickets/trips/{id}` returns the same row plus `points` (the trip's
stops, with actual times) and `tickets`. Each ticket carries more than the
flat `/tickets` row:

- `boardingPoint` / `destinationPoint` - full points with location and
  scheduled times, not bare location ids, so the passenger's leg is readable
  without extra lookups
- `ticketSeats[].seat` - `{ number, letter }`, matching the row letters from
  `/seats`
- `payments[]` - every attempt, with `provider`, `status`, `failureReason`
  and `paidAt`

That last one matters: a ticket can read `EXPIRED` with a `FAILED` payment
attached and `"failureReason": "Payment failed"`. Showing the ticket status
alone would hide why the seat was lost.

## Note on accounts

This data lives under company `cm1234567890123456789036` (Tickets Platform).
On alphaapi.quicko.rw, `admin@kigali-transit.rw` returns 401 - only
`superadmin@tickets.local` could read it during testing.
