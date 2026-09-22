# Backend: `/api/v1/car-controls`

Findings from probing the live API on 2026-09-12.

> **Updated 2026-09-12:** LIST now returns inspections **grouped by car**
> instead of flat rows. See "List shape" below.

**This endpoint is mostly well behaved.** Unlike `/car-insurance` (see
`backend-car-insurance.md`), `meta.total` counts records, `?search=` works,
paging works, and the grouped rows keep enough identity to edit without an
extra round-trip. Two issues remain.

## List shape (changed)

`GET /api/v1/car-controls` returns one entry per CAR:

```json
{ "data": [ { "id": "cmty...", "plateNumber": "RAB321A",
              "controls": [ { "id": "...", "carId": "...", "location": "...",
                              "validFrom": "...", "validTo": "...",
                              "status": "active" } ] } ],
  "meta": { "page": 1, "limit": 20, "total": 2, "totalPages": 1 } }
```

**The nested controls carry no `carId`** (and no `companyId`). The group's
`id` IS the car id, so flattening must stamp it onto each row; reading
`control.carId` yields `undefined`.

Compared with `/car-insurance`:

| | `/car-controls` | `/car-insurance` |
|---|---|---|
| Group identifies its car | yes (`id` + `plateNumber`) | **no** |
| Nested row keeps `carId` | no (use the group's `id`) | no |
| `meta.total` counts | inspections | **cars** |
| Paging | works | **broken** |

Because the group names its car, the dashboard can flatten and edit rows
directly. Insurance cannot: its group identifies nothing, so editing needs a
GET-by-id purely to recover `carId`.

> This shape changed twice on 2026-09-12 — nested controls included `carId`,
> then dropped it. A response shape that moves under consumers is worth
> pinning down; the dashboard now derives `carId` from the group, which holds
> for both variants.

A car with no inspections is returned with `controls: []` (and `total: 0`).
The dashboard uses that to flag "no inspection on record" vehicles, which
would otherwise be invisible — worth keeping.

## 1. The `?status=` query validator contradicts the record body

The two validators disagree about which enum `status` uses:

| Where | Accepted values |
|---|---|
| POST / PATCH body | `active` \| `expired` |
| `?status=` query | `active` \| `inactive` |

So the filter cannot express the data:

```
GET ?status=expired   -> 400  Invalid option: expected one of "active"|"inactive"
GET ?status=inactive  -> 200  but returns ALL rows, including active+expired
GET ?status=active    -> 200  also returns ALL rows (ignored)
```

Filtering by status is impossible server-side: the one value records actually
hold (`expired`) is rejected, and the accepted values are ignored anyway.

**Suggested fix:** point the query validator at the same enum as the body, and
apply it to the query.

**Workaround:** the dashboard filters status client-side, within the current
page.

## 2. `?carId=` is accepted but ignored

`?carId=zzzzzzzz` (nonexistent) still returns every row. Same as
`/car-insurance` item 5. Also filtered client-side.

## Permission name is SINGULAR

The granted permissions are `car_control.read` / `.create` / `.update` /
`.delete` — **not** `car_controls.*`, which the dashboard previously used.
Because the name did not match, the sidebar link was hidden and the page
rendered read-only with no Add button and no row actions.

The same class of bug affected driver assignments: the real permission is
`driver_car_assignments.*`, not `driver_assignments.*`. Both are fixed.

Every other resource's permission prefix was audited against the live
permission list and is correct.

## Contract as it stands

| Verb | Path | Notes |
|---|---|---|
| GET | `/car-controls` | **Grouped by car** (see above); `meta.total` counts inspections; paging works |
| GET | `/car-controls/{id}` | Flat single record; embeds `companyCar` (`id` + `plateNumber`, no model) |
| POST | `/car-controls` | Requires `carId` + `location` + `validFrom` + `validTo`; `status` defaults to `active` |
| PATCH | `/car-controls/{id}` | True partial update — any subset of the five fields. Empty body → "At least one field is required". Unknown-only body is treated as empty |
| DELETE | `/car-controls/{id}` | `204 No Content` |

### Note on PATCH vs `/car-insurance`

These two sibling endpoints have opposite rules, which is easy to trip over:

- `/car-controls` PATCH: `carId` optional, any subset allowed.
- `/car-insurance` PATCH: `carId` **required on every call**.
- `/baggage` PATCH: `carId` **rejected** as an unrecognised key.

Three resources, three different rules for the same field.
